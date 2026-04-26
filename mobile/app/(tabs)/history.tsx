import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { getHistory, deleteSession, CookingSession } from "@/services/api";

const C = {
  cream: "#FAF5EE",
  white: "#FFFFFF",
  brown: "#3D2010",
  mid: "#8B5E3C",
  accent: "#C4813A",
  light: "#F0E2C8",
  border: "#E8D5B0",
  green: "#5A9E5A",
  greenBg: "#EAF4EA",
  amber: "#C4813A",
  amberBg: "#FDF0E0",
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SessionCard({ item, onDelete }: { item: CookingSession; onDelete: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(opacity, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }).start();
  }, []);

  const isGood = item.completion_percentage >= 80;

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }).start()}
        onPress={() => router.push(`/history/${item.id}` as any)}
        style={styles.card}
      >
        <View style={styles.cardTop}>
          <Text style={styles.recipeName} numberOfLines={1}>
            {item.recipe_name ?? "Free session"}
          </Text>
          <View style={styles.cardTopRight}>
            <View style={[styles.badge, { backgroundColor: isGood ? C.greenBg : C.amberBg }]}>
              <Text style={[styles.badgeText, { color: isGood ? C.green : C.amber }]}>
                {item.completion_percentage}%
              </Text>
            </View>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onDelete(); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.deleteIcon}>🗑</Text>
            </TouchableOpacity>
          </View>
        </View>

        {item.summary ? (
          <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text>
        ) : null}

        <View style={styles.meta}>
          <View style={styles.metaChip}>
            <Text style={styles.metaText}>📅  {formatDate(item.created_at)}</Text>
          </View>
          <View style={styles.metaChip}>
            <Text style={styles.metaText}>⏱  {formatDuration(item.duration_seconds)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<CookingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    getHistory()
      .then((d) => setSessions(d.sessions))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function confirmDelete(session: CookingSession) {
    Alert.alert(
      "Delete Session",
      `Remove "${session.recipe_name ?? "this session"}" from your history?\n\nFoodly won't remember it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSession(session.id);
              setSessions((prev) => prev.filter((s) => s.id !== session.id));
            } catch {
              Alert.alert("Error", "Could not delete session. Try again.");
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Cooking History</Text>
          <Text style={styles.subtitle}>Your past sessions & memories</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={C.accent} size="large" style={{ marginTop: 48 }} />
        ) : error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>⚠️</Text>
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptyText}>Start cooking to build your history!</Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(s) => s.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <SessionCard item={item} onDelete={() => confirmDelete(item)} />
            )}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 30, fontWeight: "900", color: C.brown },
  subtitle: { fontSize: 13, color: C.mid, marginTop: 2, fontWeight: "600" },
  list: { paddingHorizontal: 24, paddingBottom: 32, gap: 12, paddingTop: 4 },
  card: {
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 18,
    shadowColor: C.brown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardTopRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  recipeName: { fontSize: 16, fontWeight: "800", color: C.brown, flex: 1, marginRight: 8 },
  badge: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: "800" },
  deleteIcon: { fontSize: 17 },
  summary: { fontSize: 13, color: C.mid, lineHeight: 19, marginBottom: 12 },
  meta: { flexDirection: "row", gap: 8 },
  metaChip: {
    backgroundColor: C.light,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaText: { fontSize: 12, color: C.mid, fontWeight: "600" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 60, marginBottom: 14 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: C.brown, marginBottom: 6 },
  emptyText: { fontSize: 14, color: C.mid, textAlign: "center" },
});
