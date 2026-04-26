import { useRef, useState, useCallback, useEffect } from "react";
import { Audio } from "expo-av";
import { FoodlyWebSocket } from "@/services/websocket";

type SessionStatus = "idle" | "connecting" | "active" | "ending" | "ended";

interface SessionState {
  status: SessionStatus;
  sessionId: string | null;
  durationSeconds: number;
  error: string | null;
}

const AUDIO_CHUNK_MS = 2000;

// Safe base64 encoder — avoids stack overflow from spread on large arrays
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Wrap raw PCM bytes in a WAV header (Gemini returns 24kHz 16-bit mono)
function buildWav(pcm: Uint8Array): Uint8Array {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const wav = new Uint8Array(44 + dataSize);
  const v = new DataView(wav.buffer);
  const setStr = (offset: number, s: string) =>
    s.split("").forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)));
  setStr(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  setStr(8, "WAVE");
  setStr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, numChannels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, byteRate, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bitsPerSample, true);
  setStr(36, "data");
  v.setUint32(40, dataSize, true);
  wav.set(pcm, 44);
  return wav;
}

export function useSession(recipe?: string) {
  const [state, setState] = useState<SessionState>({
    status: "idle",
    sessionId: null,
    durationSeconds: 0,
    error: null,
  });

  const wsRef = useRef<FoodlyWebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const playbackRef = useRef<Audio.Sound | null>(null);
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pcmBufferRef = useRef<number[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(false);

  const setStatus = (status: SessionStatus) =>
    setState((s) => ({ ...s, status }));

  // ── Audio playback: buffer PCM chunks, flush as one WAV file after 80ms silence ──
  const flushAndPlay = useCallback(async () => {
    if (isPlayingRef.current || pcmBufferRef.current.length === 0) return;
    const pcm = new Uint8Array(pcmBufferRef.current);
    pcmBufferRef.current = [];
    isPlayingRef.current = true;
    try {
      // Switch to music mode so Android routes audio to the loudspeaker at full volume.
      // allowsRecordingIOS:true puts Android in MODE_IN_COMMUNICATION (earpiece/quiet).
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpiece: false,
      });
      const wavBase64 = toBase64(buildWav(pcm));
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${wavBase64}` },
        { shouldPlay: true, volume: 1.0 }
      );
      playbackRef.current = sound;
      (global as any).__foodlyIsPlaying = true;
      sound.setOnPlaybackStatusUpdate(async (s) => {
        if (s.isLoaded && s.didJustFinish) {
          // Clear the stale recording first, while isPlayingRef is still true,
          // so the chunk interval can't race with us.
          try { await recordingRef.current?.stopAndUnloadAsync(); } catch {}
          recordingRef.current = null;
          // Now safe to clear the playing flag
          isPlayingRef.current = false;
          (global as any).__foodlyIsPlaying = false;
          sound.unloadAsync();
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            playThroughEarpiece: false,
          }).catch(() => {});
          // sendAudioChunk will see null ref and start a fresh recording on next tick
          if (pcmBufferRef.current.length > 0) flushAndPlay();
        }
      });
    } catch (e) {
      console.warn("[audio] playback failed:", e);
      try { await recordingRef.current?.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
      isPlayingRef.current = false;
      (global as any).__foodlyIsPlaying = false;
      Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpiece: false,
      }).catch(() => {});
    }
  }, []);

  const onMessage = useCallback(
    (msg: any) => {
      if (msg.type === "audio") {
        // Decode base64 PCM and accumulate bytes
        const raw = atob(msg.data);
        for (let i = 0; i < raw.length; i++) {
          pcmBufferRef.current.push(raw.charCodeAt(i));
        }
        // Debounce: play 80ms after the last chunk in this response
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
        flushTimerRef.current = setTimeout(flushAndPlay, 80);
      } else if (msg.type === "session_end") {
        setState((s) => ({
          ...s,
          status: "ended",
          sessionId: msg.session_id,
          durationSeconds: msg.duration_seconds,
        }));
        stopRecording();
      }
    },
    [flushAndPlay]
  );

  const onDisconnect = useCallback(() => {
    stopRecording();
    setStatus("ended");
  }, []);

  // ── Audio recording in chunks ─────────────────────────────────
  const stopRecording = useCallback(() => {
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }
    recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    recordingRef.current = null;
  }, []);

  const sendAudioChunk = useCallback(async () => {
    if (!wsRef.current) return;
    if (isPlayingRef.current) return;
    // Recording was cleared during playback cleanup — start fresh, send next tick
    if (!recordingRef.current) {
      try {
        const newRec = new Audio.Recording();
        await newRec.prepareToRecordAsync(RECORDING_OPTIONS);
        await newRec.startAsync();
        recordingRef.current = newRec;
      } catch {}
      return;
    }
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      if (uri) {
        const response = await fetch(uri);
        const buffer = await response.arrayBuffer();
        wsRef.current.sendAudio(toBase64(new Uint8Array(buffer)));
      }
      const newRec = new Audio.Recording();
      await newRec.prepareToRecordAsync(RECORDING_OPTIONS);
      await newRec.startAsync();
      recordingRef.current = newRec;
    } catch {
      recordingRef.current = null;
    }
  }, []);

  // ── Start session ─────────────────────────────────────────────
  const start = useCallback(async () => {
    setStatus("connecting");
    setState((s) => ({ ...s, error: null }));

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpiece: false,
      });
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) throw new Error("Microphone permission denied");

      const ws = new FoodlyWebSocket(onMessage, onDisconnect);
      wsRef.current = ws;
      await ws.connect(recipe);

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(RECORDING_OPTIONS);
      await rec.startAsync();
      recordingRef.current = rec;

      chunkIntervalRef.current = setInterval(sendAudioChunk, AUDIO_CHUNK_MS);
      setStatus("active");
    } catch (err: any) {
      setState((s) => ({ ...s, status: "idle", error: err.message }));
    }
  }, [recipe, onMessage, onDisconnect, sendAudioChunk]);

  // ── End session ───────────────────────────────────────────────
  const end = useCallback(() => {
    setStatus("ending");
    wsRef.current?.end();
    stopRecording();
    setTimeout(() => wsRef.current?.disconnect(), 3000);
  }, [stopRecording]);

  useEffect(() => {
    return () => {
      stopRecording();
      wsRef.current?.disconnect();
    };
  }, [stopRecording]);

  const sendVideo = useCallback((base64: string) => {
    wsRef.current?.sendVideo(base64);
  }, []);

  return { ...state, start, end, sendVideo };
}

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: ".wav",
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: ".wav",
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};
