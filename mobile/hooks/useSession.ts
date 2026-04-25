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

const AUDIO_CHUNK_MS = 250;

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
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  const setStatus = (status: SessionStatus) =>
    setState((s) => ({ ...s, status }));

  // ── Audio playback queue ──────────────────────────────────────
  const playNextChunk = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    const chunk = audioQueueRef.current.shift()!;
    isPlayingRef.current = true;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/pcm;base64,${chunk}` },
        { shouldPlay: true, rate: 1.0 }
      );
      playbackRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) {
          isPlayingRef.current = false;
          sound.unloadAsync();
          playNextChunk();
        }
      });
    } catch {
      isPlayingRef.current = false;
      playNextChunk();
    }
  }, []);

  const onMessage = useCallback(
    (msg: any) => {
      if (msg.type === "audio") {
        audioQueueRef.current.push(msg.data);
        playNextChunk();
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
    [playNextChunk]
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
    if (!recordingRef.current || !wsRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      if (uri) {
        const response = await fetch(uri);
        const buffer = await response.arrayBuffer();
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(buffer))
        );
        wsRef.current.sendAudio(base64);
      }
      // Start next recording chunk immediately
      const newRec = new Audio.Recording();
      await newRec.prepareToRecordAsync(RECORDING_OPTIONS);
      await newRec.startAsync();
      recordingRef.current = newRec;
    } catch {}
  }, []);

  // ── Start session ─────────────────────────────────────────────
  const start = useCallback(async () => {
    setStatus("connecting");
    setState((s) => ({ ...s, error: null }));

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) throw new Error("Microphone permission denied");

      const ws = new FoodlyWebSocket(onMessage, onDisconnect);
      wsRef.current = ws;
      await ws.connect(recipe);

      // Start first recording chunk
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(RECORDING_OPTIONS);
      await rec.startAsync();
      recordingRef.current = rec;

      // Send a chunk every AUDIO_CHUNK_MS
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

  return { ...state, start, end };
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
