import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { supabase } from "@/services/supabase";
import { getProfile, updateProfile, UserProfile } from "@/services/api";

const C = {
  cream: "#FAF5EE",
  white: "#FFFFFF",
  brown: "#3D2010",
  mid: "#8B5E3C",
  accent: "#C4813A",
  light: "#F0E2C8",
  border: "#E8D5B0",
};

const SKILL_LEVELS = [
  { key: "beginner", emoji: "🌱", label: "Beginner" },
  { key: "intermediate", emoji: "🔥", label: "Intermediate" },
  { key: "advanced", emoji: "⭐", label: "Advanced" },
];

const DIETARY_OPTIONS = [
  { key: "vegetarian", emoji: "🥗" },
  { key: "vegan", emoji: "🌿" },
  { key: "gluten-free", emoji: "🌾" },
  { key: "dairy-free", emoji: "🥛" },
  { key: "nut-free", emoji: "🥜" },
  { key: "halal", emoji: "☪️" },
  { key: "kosher", emoji: "✡️" },
];

function Chip({
  label,
  emoji,
  active,
  onPress,
}: {
  label: string;
  emoji?: string;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.chip, active && styles.chipActive]}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }).start()}
        activeOpacity={1}
      >
        {emoji ? <Text style={styles.chipEmoji}>{emoji}</Text> : null}
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
    getProfile()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function setSkill(level: string) {
    if (!profile) return;
    setProfile({ ...profile, skill_level: level });
    await updateProfile({ skill_level: level }).catch(() => {});
  }

  async function toggleDietary(item: string) {
    if (!profile) return;
    const current = profile.dietary_restrictions;
    const next = current.includes(item) ? current.filter((d) => d !== item) : [...current, item];
    setProfile({ ...profile, dietary_restrictions: next });
    await updateProfile({ dietary_restrictions: next }).catch(() => {});
  }

  async function signOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>My Profile</Text>
            <Text style={styles.subtitle}>Customize your cooking experience</Text>
          </View>
          <Text style={styles.mascot}>🦫</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={C.accent} size="large" style={{ marginTop: 40 }} />
        ) : profile ? (
          <>
            {/* Email card */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Signed in as</Text>
              <Text style={styles.email}>{profile.email}</Text>
            </View>

            {/* Skill level */}
            <Text style={styles.section}>🎯  Skill Level</Text>
            <View style={styles.skillRow}>
              {SKILL_LEVELS.map(({ key, emoji, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.skillCard, profile.skill_level === key && styles.skillCardActive]}
                  onPress={() => setSkill(key)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.skillEmoji}>{emoji}</Text>
                  <Text style={[styles.skillLabel, profile.skill_level === key && styles.skillLabelActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Dietary restrictions */}
            <Text style={styles.section}>🥗  Dietary Restrictions</Text>
            <View style={styles.chipWrap}>
              {DIETARY_OPTIONS.map(({ key, emoji }) => (
                <Chip
                  key={key}
                  label={key}
                  emoji={emoji}
                  active={profile.dietary_restrictions.includes(key)}
                  onPress={() => toggleDietary(key)}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.8}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  scroll: { padding: 24, paddingBottom: 48 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    marginTop: 8,
  },
  title: { fontSize: 30, fontWeight: "900", color: C.brown },
  subtitle: { fontSize: 13, color: C.mid, marginTop: 2, fontWeight: "600" },
  mascot: { fontSize: 48 },
  card: {
    backgroundColor: C.white,
    borderRadius: 22,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: C.border,
    shadowColor: C.brown,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  cardLabel: { fontSize: 11, fontWeight: "700", color: C.mid, letterSpacing: 1, marginBottom: 4 },
  email: { fontSize: 15, fontWeight: "700", color: C.brown },
  section: { fontSize: 16, fontWeight: "800", color: C.brown, marginBottom: 12 },
  skillRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  skillCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: C.border,
  },
  skillCardActive: { borderColor: C.accent, backgroundColor: "#FDF0E0" },
  skillEmoji: { fontSize: 26, marginBottom: 6 },
  skillLabel: { fontSize: 12, fontWeight: "700", color: C.mid, textTransform: "capitalize" },
  skillLabelActive: { color: C.accent },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 28 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipEmoji: { fontSize: 14 },
  chipText: { color: C.mid, fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
  chipTextActive: { color: "#FFF" },
  signOutBtn: {
    padding: 17,
    borderRadius: 20,
    backgroundColor: C.white,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E8C0C0",
  },
  signOutText: { color: "#C0392B", fontWeight: "800", fontSize: 16 },
});
