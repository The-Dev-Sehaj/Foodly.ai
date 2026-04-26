import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
} from "react-native";
import { router } from "expo-router";
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

const QUICK_RECIPES = [
  { emoji: "🍝", name: "Pasta carbonara" },
  { emoji: "🥦", name: "Stir-fried vegetables" },
  { emoji: "🍗", name: "Chicken tikka masala" },
  { emoji: "🥑", name: "Avocado toast" },
  { emoji: "🍳", name: "Omelette" },
  { emoji: "🍜", name: "Ramen" },
];

export default function HomeScreen() {
  const [recipe, setRecipe] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const mascotFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 9, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(mascotFloat, { toValue: -6, duration: 1800, useNativeDriver: true }),
        Animated.timing(mascotFloat, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  function startSession(recipeName?: string) {
    const name = recipeName ?? recipe.trim();
    router.push({ pathname: "/session", params: { recipe: name || undefined } });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Ready to cook? 👨‍🍳</Text>
              <Text style={styles.sub}>Your AI kitchen companion</Text>
            </View>
            <Animated.Text style={[styles.mascot, { transform: [{ translateY: mascotFloat }] }]}>
              🦫
            </Animated.Text>
          </View>

          {/* Main input card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>What are you making?</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Chicken tikka masala..."
              placeholderTextColor={C.mid + "70"}
              value={recipe}
              onChangeText={setRecipe}
              returnKeyType="go"
              onSubmitEditing={() => startSession()}
            />
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => startSession()}
                onPressIn={() =>
                  Animated.spring(buttonScale, { toValue: 0.95, useNativeDriver: true }).start()
                }
                onPressOut={() =>
                  Animated.spring(buttonScale, { toValue: 1, friction: 3, useNativeDriver: true }).start()
                }
                activeOpacity={1}
              >
                <Text style={styles.startText}>🍳  Start Cooking</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Quick start */}
          <Text style={styles.sectionTitle}>Quick Start</Text>
          <View style={styles.quickGrid}>
            {QUICK_RECIPES.map((r) => (
              <QuickChip key={r.name} emoji={r.emoji} name={r.name} onPress={() => startSession(r.name)} />
            ))}
          </View>

          {/* Feature cards */}
          <View style={styles.featureRow}>
            <FeatureCard emoji="👁️" title="Live Vision" desc="Watches your technique in real-time" />
            <FeatureCard emoji="🧠" title="Remembers You" desc="Learns your habits each session" />
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickChip({ emoji, name, onPress }: { emoji: string; name: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.quickChip}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }).start()}
        activeOpacity={1}
      >
        <Text style={styles.chipEmoji}>{emoji}</Text>
        <Text style={styles.quickText}>{name}</Text>
      </TouchableOpacity>
    </Animated.View>
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
  safe: { flex: 1, backgroundColor: C.cream },
  scroll: { padding: 24, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    marginTop: 8,
  },
  greeting: { fontSize: 22, fontWeight: "800", color: C.brown },
  sub: { fontSize: 13, color: C.mid, marginTop: 2, fontWeight: "600" },
  mascot: { fontSize: 52 },
  card: {
    backgroundColor: C.white,
    borderRadius: 28,
    padding: 22,
    marginBottom: 28,
    shadowColor: C.brown,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 5,
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: C.brown, marginBottom: 14 },
  input: {
    backgroundColor: C.light,
    borderRadius: 16,
    padding: 15,
    fontSize: 16,
    color: C.brown,
    borderWidth: 1.5,
    borderColor: C.border,
    marginBottom: 12,
  },
  startButton: {
    backgroundColor: C.accent,
    borderRadius: 20,
    padding: 17,
    alignItems: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 5,
  },
  startText: { color: "#FFF", fontSize: 17, fontWeight: "800", letterSpacing: 0.2 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: C.brown, marginBottom: 12 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 28 },
  quickChip: {
    backgroundColor: C.white,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: C.brown,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  chipEmoji: { fontSize: 16 },
  quickText: { color: C.brown, fontSize: 13, fontWeight: "700" },
  featureRow: { flexDirection: "row", gap: 12 },
  featureCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 22,
    padding: 16,
    shadowColor: C.brown,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  featureEmoji: { fontSize: 28, marginBottom: 8 },
  featureTitle: { fontSize: 13, fontWeight: "800", color: C.brown, marginBottom: 4 },
  featureDesc: { fontSize: 12, color: C.mid, lineHeight: 16 },
});
