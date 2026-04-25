import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "@/services/supabase";

const QUICK_RECIPES = [
  "Pasta carbonara",
  "Stir-fried vegetables",
  "Chicken tikka masala",
  "Avocado toast",
  "Omelette",
];

export default function HomeScreen() {
  const [recipe, setRecipe] = useState("");

  function startSession(recipeName?: string) {
    const name = recipeName ?? recipe.trim();
    router.push({ pathname: "/session", params: { recipe: name || undefined } });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <LinearGradient colors={["#0A0A0A", "#0F0F1A"]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.greeting}>Ready to cook?</Text>
            <Text style={styles.logo}>🍳 foodly</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>What are you making?</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Chicken tikka masala..."
              placeholderTextColor="#555"
              value={recipe}
              onChangeText={setRecipe}
              returnKeyType="go"
              onSubmitEditing={() => startSession()}
            />
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => startSession()}
            >
              <LinearGradient
                colors={["#FF6B35", "#FF3D00"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startGradient}
              >
                <Text style={styles.startText}>Start Cooking  →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Quick Start</Text>
          <View style={styles.quickGrid}>
            {QUICK_RECIPES.map((r) => (
              <TouchableOpacity
                key={r}
                style={styles.quickChip}
                onPress={() => startSession(r)}
              >
                <Text style={styles.quickText}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.featureRow}>
            <FeatureCard emoji="👁️" title="Live Vision" desc="Foodly watches your technique in real-time" />
            <FeatureCard emoji="🧠" title="Remembers You" desc="Learns your habits across every session" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function FeatureCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <View style={styles.featureCard}>
      <Text style={styles.featureEmoji}>{emoji}</Text>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDesc}>{desc}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
    marginTop: 8,
  },
  greeting: { fontSize: 28, fontWeight: "800", color: "#FFFFFF" },
  logo: { fontSize: 16, color: "#FF6B35", fontWeight: "700" },
  card: {
    backgroundColor: "#141414",
    borderRadius: 20,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#222",
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#FFF", marginBottom: 12 },
  input: {
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#FFF",
    borderWidth: 1,
    borderColor: "#2E2E2E",
    marginBottom: 12,
  },
  startButton: { borderRadius: 14, overflow: "hidden" },
  startGradient: { padding: 16, alignItems: "center" },
  startText: { color: "#FFF", fontSize: 17, fontWeight: "700" },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 12,
  },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 32 },
  quickChip: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#2E2E2E",
  },
  quickText: { color: "#CCC", fontSize: 14 },
  featureRow: { flexDirection: "row", gap: 12 },
  featureCard: {
    flex: 1,
    backgroundColor: "#141414",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#222",
  },
  featureEmoji: { fontSize: 28, marginBottom: 8 },
  featureTitle: { fontSize: 14, fontWeight: "700", color: "#FFF", marginBottom: 4 },
  featureDesc: { fontSize: 12, color: "#666", lineHeight: 16 },
});
