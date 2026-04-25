import { useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Alert,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useSession } from "@/hooks/useSession";
import { FoodlyWebSocket } from "@/services/websocket";

const { width } = Dimensions.get("window");

export default function SessionScreen() {
  const { recipe } = useLocalSearchParams<{ recipe?: string }>();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const wsRef = useRef<FoodlyWebSocket | null>(null);
  const videoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { status, sessionId, durationSeconds, error, start, end } = useSession(recipe);

  // Pulse animation for the recording indicator
  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: pulse.value,
  }));

  useEffect(() => {
    if (status === "active") {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) })
        ),
        -1
      );
    } else {
      pulse.value = withTiming(1);
    }
  }, [status]);

  // Request camera permission and start session on mount
  useEffect(() => {
    (async () => {
      if (!cameraPermission?.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          Alert.alert(
            "Camera Required",
            "Foodly needs camera access to watch your cooking technique.",
            [{ text: "OK", onPress: () => router.back() }]
          );
          return;
        }
      }
      await start();
    })();
  }, []);

  // Send video frames while session is active
  useEffect(() => {
    if (status !== "active" || !cameraRef.current) return;

    let capturing = false;

    videoIntervalRef.current = setInterval(async () => {
      // Never interrupt Foodly mid-sentence — skip frame if audio is playing
      if (capturing || !cameraRef.current || (global as any).__foodlyIsPlaying) return;
      capturing = true;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.05,   // minimum quality — smaller file = shorter preview pause
          base64: true,
          skipProcessing: true,
          exif: false,
        });
        if (photo?.base64) {
          (global as any).__foodlyWs?.sendVideo(photo.base64);
        }
      } catch {}
      capturing = false;
    }, 4000); // one frame every 4s — reduces shutter clicks and JS thread contention

    return () => {
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    };
  }, [status]);

  // Expose ws for video sending (see interval above)
  useEffect(() => {
    return () => {
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
      delete (global as any).__foodlyWs;
    };
  }, []);

  function handleEnd() {
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    end();
  }

  useEffect(() => {
    if (status === "ended") {
      setTimeout(() => router.replace("/(tabs)/history"), 1500);
    }
  }, [status]);

  if (status === "ended") {
    return (
      <LinearGradient colors={["#0A0A0A", "#0F1A0A"]} style={styles.centerFill}>
        <Text style={styles.doneEmoji}>✅</Text>
        <Text style={styles.doneTitle}>Session saved!</Text>
        <Text style={styles.doneSub}>Check your history for the summary.</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.fill}>
      {/* Camera fills the screen */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        animateShutter={false}
      />

      {/* Dark gradient overlay at top and bottom */}
      <LinearGradient
        colors={["rgba(0,0,0,0.7)", "transparent"]}
        style={styles.topOverlay}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={styles.bottomOverlay}
        pointerEvents="none"
      />

      {/* Top bar */}
      <SafeAreaView style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.recipeTag}>
          <Text style={styles.recipeTagText} numberOfLines={1}>
            {recipe || "Free cooking"}
          </Text>
        </View>
        {status === "active" && (
          <Animated.View style={[styles.recordingDot, pulseStyle]} />
        )}
      </SafeAreaView>

      {/* Status overlay */}
      <View style={styles.statusOverlay} pointerEvents="none">
        {status === "connecting" && (
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>Connecting to Foodly...</Text>
          </View>
        )}
        {status === "active" && (
          <View style={[styles.statusPill, styles.activePill]}>
            <Text style={styles.statusText}>🎤 Foodly is listening</Text>
          </View>
        )}
        {status === "ending" && (
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>Saving session...</Text>
          </View>
        )}
        {error && (
          <View style={[styles.statusPill, styles.errorPill]}>
            <Text style={styles.statusText}>⚠️ {error}</Text>
          </View>
        )}
      </View>

      {/* Bottom controls */}
      <SafeAreaView style={styles.bottomBar}>
        <Text style={styles.hint}>
          {status === "active"
            ? "Speak naturally — Foodly can see and hear you"
            : status === "connecting"
            ? "Starting your session..."
            : ""}
        </Text>
        <TouchableOpacity
          style={[styles.endButton, status !== "active" && styles.endButtonDisabled]}
          onPress={handleEnd}
          disabled={status !== "active"}
        >
          <Text style={styles.endButtonText}>End Session</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A0A0A",
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 260,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  recipeTag: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  recipeTagText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF3D00",
  },
  statusOverlay: {
    position: "absolute",
    top: "45%",
    left: 24,
    right: 24,
    alignItems: "center",
  },
  statusPill: {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  activePill: { backgroundColor: "rgba(255,107,53,0.3)", borderWidth: 1, borderColor: "#FF6B35" },
  errorPill: { backgroundColor: "rgba(255,0,0,0.3)" },
  statusText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 12,
  },
  hint: { color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center" },
  endButton: {
    backgroundColor: "#FF3D00",
    borderRadius: 30,
    paddingHorizontal: 48,
    paddingVertical: 16,
    width: width - 48,
    alignItems: "center",
  },
  endButtonDisabled: { backgroundColor: "#333" },
  endButtonText: { color: "#FFF", fontSize: 17, fontWeight: "700" },
  doneEmoji: { fontSize: 64, marginBottom: 16 },
  doneTitle: { fontSize: 24, fontWeight: "800", color: "#FFF", marginBottom: 8 },
  doneSub: { fontSize: 15, color: "#666" },
});
