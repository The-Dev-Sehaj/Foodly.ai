import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { getHistory, deleteSession, CookingSession } from "@/services/api";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<CookingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHistory()
      .then((d) => setSessions(d.sessions))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function confirmDelete(session: CookingSession) {
    Alert.alert(
      "Delete Session",
      `Remove "${session.recipe_name ?? "this session"}" from your history? Foodly won't remember it.`,
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
    <LinearGradient colors={["#0A0A0A", "#0F0F1A"]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Cooking History</Text>
          <Text style={styles.subtitle}>Your past sessions & memories</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#FF6B35" style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : sessions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={styles.emptyText}>No sessions yet</Text>
            <Text style={styles.emptySubtext}>Start cooking to build your history!</Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(s) => s.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/history/${item.id}` as any)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.recipeName} numberOfLines={1}>
                    {item.recipe_name ?? "Unnamed session"}
                  </Text>
                  <View style={styles.cardTopRight}>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: item.completion_percentage >= 80 ? "#1A3A1A" : "#2A2A1A" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: item.completion_percentage >= 80 ? "#4CAF50" : "#FFC107" },
                        ]}
                      >
                        {item.completion_percentage}%
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); confirmDelete(item); }}
                      style={styles.deleteBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.deleteBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {item.summary ? (
                  <Text style={styles.summary} numberOfLines={2}>
                    {item.summary}
                  </Text>
                ) : null}
                <View style={styles.meta}>
                  <Text style={styles.metaText}>📅 {formatDate(item.created_at)}</Text>
                  <Text style={styles.metaText}>⏱ {formatDuration(item.duration_seconds)}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { padding: 24, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: "800", color: "#FFF" },
  subtitle: { fontSize: 14, color: "#555", marginTop: 2 },
  list: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  card: {
    backgroundColor: "#141414",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#222",
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardTopRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  deleteBtn: { padding: 2 },
  deleteBtnText: { fontSize: 16 },
  recipeName: { fontSize: 16, fontWeight: "700", color: "#FFF", flex: 1, marginRight: 8 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  summary: { fontSize: 13, color: "#777", lineHeight: 18, marginBottom: 10 },
  meta: { flexDirection: "row", gap: 16 },
  metaText: { fontSize: 12, color: "#555" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 20, fontWeight: "700", color: "#FFF", marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: "#555" },
  errorText: { color: "#FF4444", textAlign: "center", marginTop: 40, padding: 24 },
});
