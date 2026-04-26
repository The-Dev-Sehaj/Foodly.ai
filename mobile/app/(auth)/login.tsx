import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { supabase } from "@/services/supabase";

const C = {
  cream: "#FAF5EE",
  white: "#FFFFFF",
  brown: "#3D2010",
  mid: "#8B5E3C",
  accent: "#C4813A",
  light: "#F0E2C8",
  border: "#E8D5B0",
};

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const mascotBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(mascotBounce, { toValue: -8, duration: 1200, useNativeDriver: true }),
        Animated.timing(mascotBounce, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  async function handleSubmit() {
    if (!email || !password) return;
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) Alert.alert("Check your email", "We sent you a confirmation link.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.root}
    >
      <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Mascot & branding */}
        <View style={styles.hero}>
          <Animated.Text style={[styles.mascot, { transform: [{ translateY: mascotBounce }] }]}>
            🦫
          </Animated.Text>
          <Text style={styles.logo}>foodly.ai</Text>
          <Text style={styles.tagline}>LET IT COOK</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {mode === "login" ? "Welcome back! 👋" : "Join foodly! 🎉"}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={C.mid + "80"}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={C.mid + "80"}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === "login" ? "Sign In →" : "Create Account →"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode(mode === "login" ? "signup" : "login")}>
            <Text style={styles.toggle}>
              {mode === "login"
                ? "New here? Create an account"
                : "Already have an account? Sign in"}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  inner: { flex: 1, justifyContent: "center", padding: 28 },
  hero: { alignItems: "center", marginBottom: 36 },
  mascot: { fontSize: 80, marginBottom: 4 },
  logo: {
    fontSize: 40,
    fontWeight: "900",
    color: C.brown,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 12,
    fontWeight: "800",
    color: C.mid,
    letterSpacing: 4,
    marginTop: 4,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 28,
    padding: 24,
    shadowColor: C.brown,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
    gap: 12,
  },
  cardTitle: { fontSize: 20, fontWeight: "800", color: C.brown, marginBottom: 4 },
  input: {
    backgroundColor: C.light,
    borderRadius: 16,
    padding: 15,
    fontSize: 16,
    color: C.brown,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  button: {
    backgroundColor: C.accent,
    borderRadius: 18,
    padding: 17,
    alignItems: "center",
    marginTop: 4,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonText: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  toggle: { color: C.mid, textAlign: "center", fontSize: 14, fontWeight: "600", marginTop: 4 },
});
