import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@/services/supabase";
import { getProfile, updateProfile, UserProfile } from "@/services/api";

const SKILL_LEVELS = ["beginner", "intermediate", "advanced"];
const DIETARY_OPTIONS = ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free", "halal", "kosher"];

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function setSkill(level: string) {
    if (!profile) return;
    const updated = { ...profile, skill_level: level };
    setProfile(updated);
    await updateProfile({ skill_level: level }).catch(() => {});
  }

  async function toggleDietary(item: string) {
    if (!profile) return;
    const current = profile.dietary_restrictions;
    const next = current.includes(item)
      ? current.filter((d) => d !== item)
      : [...current, item];
    setProfile({ ...profile, dietary_restrictions: next });
    await updateProfile({ dietary_restrictions: next }).catch(() => {});
  }

  async function signOut() {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  }

  return (
    <LinearGradient colors={["#0A0A0A", "#0F0F1A"]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>My Profile</Text>

          {loading ? (
            <ActivityIndicator color="#FF6B35" style={{ marginTop: 40 }} />
          ) : profile ? (
            <>
              <View style={styles.card}>
                <Text style={styles.email}>{profile.email}</Text>
              </View>

              <Text style={styles.section}>Skill Level</Text>
              <View style={styles.row}>
                {SKILL_LEVELS.map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[styles.chip, profile.skill_level === level && styles.chipActive]}
                    onPress={() => setSkill(level)}
                  >
                    <Text
                      style={[styles.chipText, profile.skill_level === level && styles.chipTextActive]}
                    >
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.section}>Dietary Restrictions</Text>
              <View style={styles.row}>
                {DIETARY_OPTIONS.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.chip,
                      profile.dietary_restrictions.includes(item) && styles.chipActive,
                    ]}
                    onPress={() => toggleDietary(item)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        profile.dietary_restrictions.includes(item) && styles.chipTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "800", color: "#FFF", marginBottom: 20 },
  card: {
    backgroundColor: "#141414",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#222",
  },
  email: { color: "#999", fontSize: 15 },
  section: { fontSize: 16, fontWeight: "700", color: "#FFF", marginBottom: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2E2E2E",
  },
  chipActive: { backgroundColor: "#FF6B35", borderColor: "#FF6B35" },
  chipText: { color: "#888", fontSize: 13, textTransform: "capitalize" },
  chipTextActive: { color: "#FFF", fontWeight: "700" },
  signOutBtn: {
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  signOutText: { color: "#FF4444", fontWeight: "700", fontSize: 16 },
});
