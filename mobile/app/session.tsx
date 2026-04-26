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
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
} from "react-native-reanimated";
import { useSession } from "@/hooks/useSession";

const { width } = Dimensions.get("window");

const C = {
  accent: "#C4813A",
  brown: "#3D2010",
  cream: "#FAF5EE",
  white: "#FFFFFF",
};

export default function SessionScreen() {
  const { recipe } = useLocalSearchParams<{ recipe?: string }>();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const videoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { status, sessionId, durationSeconds, error, start, end, sendVideo } = useSession(recipe);

  // Pulse for the recording dot
  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: pulse.value > 1.1 ? 1 : 0.7 + (pulse.value - 1) * 3,
  }));

  // Status pill slide-in
  const pillY = useSharedValue(20);
  const pillOpacity = useSharedValue(0);
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pillY.value }],
    opacity: pillOpacity.value,
  }));

  useEffect(() => {
    if (status === "active") {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 700, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 700, easing: Easing.in(Easing.ease) })
        ),
        -1
      );
      pillY.value = withSpring(0, { damping: 14 });
      pillOpacity.value = withTiming(1, { duration: 400 });
    } else {
      pulse.value = withTiming(1);
    }
  }, [status]);

  // Request camera + start session on mount
  useEffect(() => {
    (async () => {
      if (!cameraPermission?.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          Alert.alert(
            "Camera Required",
            "Foodly needs camera access to watch your cooking.",
            [{ text: "OK", onPress: () => router.back() }]
          );
          return;
        }
      }
      await start();
    })();
  }, []);

  // Video frame capture
  useEffect(() => {
    if (status !== "active" || !cameraRef.current) return;
    let capturing = false;

    videoIntervalRef.current = setInterval(async () => {
      if (capturing || !cameraRef.current || (global as any).__foodlyIsPlaying) return;
      capturing = true;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.4,
          base64: true,
          skipProcessing: true,
          exif: false,
        });
        if (photo?.base64) sendVideo(photo.base64);
      } catch {}
      capturing = false;
    }, 4000);

    return () => {
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    };
  }, [status, sendVideo]);

  useEffect(() => {
    return () => {
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
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
      <View style={styles.doneBg}>
        <Text style={styles.doneEmoji}>🎉</Text>
        <Text style={styles.doneTitle}>Session saved!</Text>
        <Text style={styles.doneSub}>Check your history for the summary.</Text>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {/* Camera full-screen */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        animateShutter={false}
      />

      {/* Soft dark vignette at top & bottom */}
      <View style={styles.topGradient} />
      <View style={styles.bottomGradient} />

      {/* Top bar */}
      <SafeAreaView style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.recipeTag}>
          <Text style={styles.recipeTagText} numberOfLines={1}>
            {recipe ? `🍳 ${recipe}` : "🦫 Free cooking"}
          </Text>
        </View>

        {status === "active" && (
          <Animated.View style={[styles.recordingDot, pulseStyle]} />
        )}
      </SafeAreaView>

      {/* Status pill */}
      <Animated.View style={[styles.statusWrap, pillStyle]} pointerEvents="none">
        {status === "connecting" && (
          <View style={styles.pill}>
            <Text style={styles.pillText}>Connecting to Foodly...</Text>
          </View>
        )}
        {status === "active" && (
          <View style={[styles.pill, styles.pillActive]}>
            <Text style={styles.pillText}>🎤  Foodly is listening</Text>
          </View>
        )}
        {status === "ending" && (
          <View style={styles.pill}>
            <Text style={styles.pillText}>Saving your session...</Text>
          </View>
        )}
        {error && (
          <View style={[styles.pill, styles.pillError]}>
            <Text style={styles.pillText}>⚠️  {error}</Text>
          </View>
        )}
      </Animated.View>

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
          activeOpacity={0.85}
        >
          <Text style={styles.endButtonText}>
            {status === "active" ? "End Session" : "Please wait..."}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },

  // Vignette overlays
  topGradient: {
    position: "absolute", top: 0, left: 0, right: 0, height: 180,
    backgroundColor: "transparent",
    // soft shadow via border trick
    shadowColor: "#000",
  },
  bottomGradient: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: 260,
  },

  // Top bar
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(250,245,238,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  backText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  recipeTag: {
    flex: 1,
    backgroundColor: "rgba(250,245,238,0.2)",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  recipeTagText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  recordingDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },

  // Status pill
  statusWrap: {
    position: "absolute",
    top: "44%",
    left: 28,
    right: 28,
    alignItems: "center",
  },
  pill: {
    backgroundColor: "rgba(61,32,16,0.75)",
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(232,213,176,0.3)",
  },
  pillActive: {
    backgroundColor: "rgba(196,129,58,0.85)",
    borderColor: "rgba(232,213,176,0.5)",
  },
  pillError: { backgroundColor: "rgba(192,57,43,0.8)" },
  pillText: { color: "#FFF", fontSize: 15, fontWeight: "700" },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 12,
  },
  hint: { color: "rgba(250,245,238,0.7)", fontSize: 13, textAlign: "center", fontWeight: "600" },
  endButton: {
    backgroundColor: C.accent,
    borderRadius: 32,
    paddingHorizontal: 48,
    paddingVertical: 17,
    width: width - 48,
    alignItems: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 5,
  },
  endButtonDisabled: {
    backgroundColor: "rgba(61,32,16,0.5)",
    shadowOpacity: 0,
  },
  endButtonText: { color: "#FFF", fontSize: 17, fontWeight: "800" },

  // Done screen
  doneBg: {
    flex: 1,
    backgroundColor: C.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  doneEmoji: { fontSize: 72, marginBottom: 16 },
  doneTitle: { fontSize: 26, fontWeight: "900", color: C.brown, marginBottom: 8 },
  doneSub: { fontSize: 15, color: "#8B5E3C" },
});
