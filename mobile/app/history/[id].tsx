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
import { router, useLocalSearchParams } from "expo-router";
import { getSessionDetail, deleteSession } from "@/services/api";

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
  red: "#C0392B",
  redBg: "#FAE5E5",
};

interface SessionDetails {
  summary: string;
  steps: string[];
  highlights: string[];
  tips: string[];
  ingredients: string[];
}

interface SessionData {
  id: string;
  recipe_name: string | null;
  summary: string | null;
  details: SessionDetails | null;
  created_at: string;
  duration_seconds: number;
  completion_percentage: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {emoji}  {title}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function BulletItem({ text, index, numbered }: { text: string; index: number; numbered?: boolean }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot}>
        <Text style={styles.bulletDotText}>{numbered ? index + 1 : "•"}</Text>
      </View>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!id) return;
    getSessionDetail(id)
      .then((data) => {
        setSession(data.session);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 11, useNativeDriver: true }),
        ]).start();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function confirmDelete() {
    if (!session) return;
    Alert.alert(
      "Delete Session",
      `Remove "${session.recipe_name ?? "this session"}" from your history?\n\nFoodly won't remember it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteSession(session.id);
              router.back();
            } catch {
              setDeleting(false);
              Alert.alert("Error", "Could not delete session. Try again.");
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Details</Text>
        <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn} disabled={deleting || !session}>
          <Text style={styles.deleteBtnText}>{deleting ? "..." : "🗑"}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={C.accent} size="large" style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !session ? null : (
        <Animated.ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          {/* Hero card */}
          <View style={styles.heroCard}>
            <Text style={styles.recipeName} numberOfLines={2}>
              {session.recipe_name ?? "Free Cooking Session"}
            </Text>
            <Text style={styles.dateText}>{formatDate(session.created_at)}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Text style={styles.statEmoji}>⏱</Text>
                <Text style={styles.statText}>{formatDuration(session.duration_seconds)}</Text>
              </View>
              <View
                style={[
                  styles.statChip,
                  {
                    backgroundColor:
                      session.completion_percentage >= 80 ? C.greenBg : C.light,
                  },
                ]}
              >
                <Text style={styles.statEmoji}>✓</Text>
                <Text
                  style={[
                    styles.statText,
                    { color: session.completion_percentage >= 80 ? C.green : C.mid },
                  ]}
                >
                  {session.completion_percentage}% complete
                </Text>
              </View>
            </View>
          </View>

          {/* Summary */}
          {session.summary ? (
            <Section emoji="📝" title="Summary">
              <Text style={styles.summaryText}>{session.summary}</Text>
            </Section>
          ) : null}

          {/* Recipe steps */}
          {session.details?.steps?.length ? (
            <Section emoji="🍳" title="Recipe Steps">
              {session.details.steps.map((step, i) => (
                <BulletItem key={i} text={step} index={i} numbered />
              ))}
            </Section>
          ) : null}

          {/* Highlights */}
          {session.details?.highlights?.length ? (
            <Section emoji="💬" title="What We Discussed">
              {session.details.highlights.map((h, i) => (
                <BulletItem key={i} text={h} index={i} />
              ))}
            </Section>
          ) : null}

          {/* Tips */}
          {session.details?.tips?.length ? (
            <Section emoji="💡" title="Tips to Remember">
              {session.details.tips.map((tip, i) => (
                <BulletItem key={i} text={tip} index={i} />
              ))}
            </Section>
          ) : null}

          {/* Ingredients */}
          {session.details?.ingredients?.length ? (
            <Section emoji="🧂" title="Ingredients">
              <View style={styles.ingredientGrid}>
                {session.details.ingredients.map((ing, i) => (
                  <View key={i} style={styles.ingredientChip}>
                    <Text style={styles.ingredientText}>{ing}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {/* Fallback for old sessions without details */}
          {!session.details && !session.summary ? (
            <View style={styles.center}>
              <Text style={styles.errorEmoji}>🦫</Text>
              <Text style={styles.emptyText}>
                No details available for this session.{"\n"}Future sessions will show full breakdowns!
              </Text>
            </View>
          ) : null}

          <View style={{ height: 32 }} />
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.cream,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: C.border,
  },
  backText: { fontSize: 18, color: C.brown, fontWeight: "700" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
    color: C.brown,
  },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E8C0C0",
  },
  deleteBtnText: { fontSize: 17 },

  scroll: { padding: 20, paddingBottom: 40 },

  heroCard: {
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 22,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    shadowColor: C.brown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  recipeName: {
    fontSize: 24,
    fontWeight: "900",
    color: C.brown,
    marginBottom: 6,
  },
  dateText: {
    fontSize: 13,
    color: C.mid,
    fontWeight: "600",
    marginBottom: 16,
  },
  statsRow: { flexDirection: "row", gap: 10 },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.light,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statEmoji: { fontSize: 13 },
  statText: { fontSize: 13, fontWeight: "700", color: C.mid },

  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.accent,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    shadowColor: C.brown,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },

  summaryText: {
    fontSize: 14,
    color: C.brown,
    lineHeight: 22,
    fontWeight: "500",
  },

  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.light,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  bulletDotText: { fontSize: 11, fontWeight: "800", color: C.accent },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: C.brown,
    lineHeight: 21,
    fontWeight: "500",
  },

  ingredientGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ingredientChip: {
    backgroundColor: C.light,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  ingredientText: { fontSize: 13, color: C.brown, fontWeight: "600" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  errorEmoji: { fontSize: 52, marginBottom: 12 },
  errorText: { fontSize: 14, color: C.mid, textAlign: "center" },
  emptyText: { fontSize: 14, color: C.mid, textAlign: "center", lineHeight: 22 },
});
