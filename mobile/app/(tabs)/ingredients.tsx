import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { generateRecipe, getRecipes, deleteRecipe, SavedRecipe } from "@/services/api";

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
};

const DIFFICULTY_COLOR: Record<string, { bg: string; text: string }> = {
  beginner: { bg: "#EAF4EA", text: "#5A9E5A" },
  intermediate: { bg: "#FDF0E0", text: "#C4813A" },
  advanced: { bg: "#FAE5E5", text: "#C0392B" },
};

function DifficultyBadge({ level }: { level: string | null }) {
  const style = DIFFICULTY_COLOR[level ?? ""] ?? { bg: C.light, text: C.mid };
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.badgeText, { color: style.text }]}>
        {level ?? "—"}
      </Text>
    </View>
  );
}

function RecipeCard({
  recipe,
  onDelete,
}: {
  recipe: SavedRecipe;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;

  function toggle() {
    if (!expanded) {
      setExpanded(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
        setExpanded(false)
      );
    }
  }

  return (
    <Animated.View style={{ transform: [{ scale: cardScale }] }}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={toggle}
        onPressIn={() =>
          Animated.spring(cardScale, { toValue: 0.98, useNativeDriver: true }).start()
        }
        onPressOut={() =>
          Animated.spring(cardScale, { toValue: 1, friction: 4, useNativeDriver: true }).start()
        }
      >
        {/* Card header */}
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <Text style={styles.recipeTitle} numberOfLines={expanded ? undefined : 1}>
              {recipe.title}
            </Text>
            <View style={styles.metaRow}>
              {recipe.cooking_time ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaText}>⏱ {recipe.cooking_time}</Text>
                </View>
              ) : null}
              {recipe.servings ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaText}>🍽 {recipe.servings} servings</Text>
                </View>
              ) : null}
              <DifficultyBadge level={recipe.difficulty} />
            </View>
          </View>
          <View style={styles.cardTopRight}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.deleteIcon}>🗑</Text>
            </TouchableOpacity>
            <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
          </View>
        </View>

        {recipe.description ? (
          <Text style={styles.description} numberOfLines={expanded ? undefined : 2}>
            {recipe.description}
          </Text>
        ) : null}

        {/* Expanded content */}
        {expanded && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <View style={styles.divider} />

            {/* Ingredients */}
            {recipe.ingredients?.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>🧂  Ingredients</Text>
                <View style={styles.ingredientGrid}>
                  {recipe.ingredients.map((ing, i) => (
                    <View key={i} style={styles.ingredientChip}>
                      <Text style={styles.ingredientAmount}>{ing.amount}</Text>
                      <Text style={styles.ingredientName}>{ing.name}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Steps */}
            {recipe.steps?.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>👨‍🍳  Steps</Text>
                <View style={styles.stepList}>
                  {recipe.steps.map((step, i) => (
                    <View key={i} style={styles.stepRow}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Tips */}
            {recipe.tips?.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>💡  Tips</Text>
                <View style={styles.tipList}>
                  {recipe.tips.map((tip, i) => (
                    <View key={i} style={styles.tipRow}>
                      <Text style={styles.tipBullet}>•</Text>
                      <Text style={styles.tipText}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function IngredientsScreen() {
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    getRecipes()
      .then(setRecipes)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    const q = query.trim();
    if (!q) return;
    setGenerating(true);
    setError(null);
    try {
      const recipe = await generateRecipe(q);
      setRecipes((prev) => [recipe, ...prev]);
      setQuery("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  function confirmDelete(recipe: SavedRecipe) {
    Alert.alert(
      "Delete Recipe",
      `Remove "${recipe.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRecipe(recipe.id);
              setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
            } catch {
              Alert.alert("Error", "Could not delete recipe.");
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Recipes</Text>
            <Text style={styles.subtitle}>Ask Foodly for any recipe</Text>
          </View>

          {/* Ask input */}
          <View style={styles.inputCard}>
            <TextInput
              style={styles.input}
              placeholder="e.g. spicy chicken tacos, quick pasta, vegan curry…"
              placeholderTextColor={C.mid + "70"}
              value={query}
              onChangeText={setQuery}
              returnKeyType="go"
              onSubmitEditing={handleGenerate}
              editable={!generating}
            />
            <TouchableOpacity
              style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
              onPress={handleGenerate}
              disabled={generating || !query.trim()}
              activeOpacity={0.85}
            >
              {generating ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.generateBtnText}>Get Recipe →</Text>
              )}
            </TouchableOpacity>
            {error ? <Text style={styles.errorText}>⚠️  {error}</Text> : null}
          </View>

          {/* Recipe list */}
          {loading ? (
            <ActivityIndicator color={C.accent} size="large" style={{ marginTop: 48 }} />
          ) : recipes.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🥘</Text>
              <Text style={styles.emptyTitle}>No recipes yet</Text>
              <Text style={styles.emptyText}>Ask Foodly for a recipe above to get started!</Text>
            </View>
          ) : (
            <FlatList
              data={recipes}
              keyExtractor={(r) => r.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <RecipeCard recipe={item} onDelete={() => confirmDelete(item)} />
              )}
            />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },

  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 30, fontWeight: "900", color: C.brown },
  subtitle: { fontSize: 13, color: C.mid, marginTop: 2, fontWeight: "600" },

  inputCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    shadowColor: C.brown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 3,
    gap: 10,
  },
  input: {
    backgroundColor: C.light,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 15,
    color: C.brown,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  generateBtn: {
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 8,
    elevation: 4,
  },
  generateBtnDisabled: {
    backgroundColor: "rgba(196,129,58,0.45)",
    shadowOpacity: 0,
  },
  generateBtnText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  errorText: { fontSize: 13, color: "#C0392B", fontWeight: "600", textAlign: "center" },

  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 12, paddingTop: 4 },

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
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  cardTopLeft: { flex: 1, marginRight: 10 },
  cardTopRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  recipeTitle: { fontSize: 16, fontWeight: "800", color: C.brown, marginBottom: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaChip: {
    backgroundColor: C.light,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaText: { fontSize: 11, color: C.mid, fontWeight: "600" },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
  deleteIcon: { fontSize: 16 },
  chevron: { fontSize: 11, color: C.mid, fontWeight: "800" },
  description: { fontSize: 13, color: C.mid, lineHeight: 19 },

  divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: C.accent,
    marginBottom: 10,
    marginTop: 4,
  },

  ingredientGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  ingredientChip: {
    backgroundColor: C.light,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  ingredientAmount: { fontSize: 11, fontWeight: "800", color: C.accent, marginBottom: 1 },
  ingredientName: { fontSize: 12, fontWeight: "600", color: C.brown },

  stepList: { gap: 10, marginBottom: 14 },
  stepRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumberText: { fontSize: 11, fontWeight: "900", color: "#FFF" },
  stepText: { flex: 1, fontSize: 13, color: C.brown, lineHeight: 20, fontWeight: "500" },

  tipList: { gap: 8, marginBottom: 6 },
  tipRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  tipBullet: { fontSize: 16, color: C.accent, lineHeight: 20 },
  tipText: { flex: 1, fontSize: 13, color: C.mid, lineHeight: 20, fontWeight: "500" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 60, marginBottom: 14 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: C.brown, marginBottom: 6 },
  emptyText: { fontSize: 14, color: C.mid, textAlign: "center", lineHeight: 21 },
});
