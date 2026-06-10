/*
 * Artist COLLAB tab - collaboration recommendations.
 *
 * Recommends other artists to collaborate with based solely on genre
 * similarity. Each artist has a genre_vector JSONB column on their profile
 * (e.g. {"pop": 0.6, "indie": 0.4}) that is maintained by releases.tsx
 * whenever a release is saved.
 *
 * Scoring: cosine similarity between the signed-in artist's genre_vector and
 * each candidate's genre_vector. Artists with no genre_vector are excluded.
 * Reason chips show the top shared genres ranked by the geometric mean of
 * both artists' weights for that genre.
 *
 * For larger datasets this scoring would move to a Postgres RPC with
 * pgvector. At current scale client-side is fast enough.
 *
 * Stretch goal (messaging) is surfaced as a clearly-labelled "coming soon"
 * action rather than a dead button.
 */

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GenreVector = Record<string, number>;

interface ArtistProfile {
  id: string;
  name: string | null;
  username: string | null;
  genre_vector: GenreVector | null;
}

interface SharedGenre {
  slug: string;
  score: number; // geometric mean of both artists' weights
}

interface Recommendation {
  id: string;
  name: string;
  username: string | null;
  similarity: number;
  sharedGenres: SharedGenre[];
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

function cosineSimilarity(a: GenreVector, b: GenreVector): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const k of keys) {
    const va = a[k] ?? 0;
    const vb = b[k] ?? 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Shared genres sorted by geometric mean of both weights, descending.
function sharedGenres(a: GenreVector, b: GenreVector): SharedGenre[] {
  const results: SharedGenre[] = [];
  for (const slug of Object.keys(a)) {
    if (b[slug] && b[slug] > 0) {
      results.push({ slug, score: Math.sqrt(a[slug] * b[slug]) });
    }
  }
  return results.sort((x, y) => y.score - x.score);
}

// Capitalise a slug for display: "indie-pop" -> "Indie Pop"
function slugToLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MAX_RESULTS = 12;

export default function Collaborate() {
  const mounted = useRef(true);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasVector, setHasVector] = useState(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  async function fetchRecommendations() {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted.current) return;

      // Fetch all artist profiles that have a genre_vector.
      const { data: artists, error: artistsError } = await supabase
        .from("profiles")
        .select("id, name, username, genre_vector")
        .eq("role", "artist")
        .not("genre_vector", "is", null);

      if (artistsError) throw artistsError;

      const allArtists = (artists ?? []) as ArtistProfile[];
      const myProfile = allArtists.find((a) => a.id === user.id);

      if (!myProfile?.genre_vector) {
        if (mounted.current) {
          setHasVector(false);
          setRecs([]);
        }
        return;
      }

      if (mounted.current) setHasVector(true);

      const myVector = myProfile.genre_vector;

      const scored: Recommendation[] = allArtists
        .filter((a) => a.id !== user.id && a.genre_vector)
        .map((a) => {
          const similarity = cosineSimilarity(myVector, a.genre_vector!);
          const shared = sharedGenres(myVector, a.genre_vector!);
          return {
            id: a.id,
            name: a.name ?? a.username ?? "Unknown artist",
            username: a.username,
            similarity,
            sharedGenres: shared,
          };
        })
        .filter((r) => r.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, MAX_RESULTS);

      if (mounted.current) setRecs(scored);
    } catch (e: any) {
      if (mounted.current)
        setError(e?.message ?? "Could not load recommendations.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  function onMessage(name: string) {
    Alert.alert(
      "Coming soon",
      `Direct messaging with ${name} isn't available yet. It's on the way.`,
    );
  }

  // Similarity 0-1 -> percentage label
  function similarityLabel(s: number): string {
    return `${Math.round(s * 100)}% match`;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.topLabel}>COLLABORATE</Text>
        <Text style={styles.title}>Artists to work with</Text>
        <Text style={styles.subtitle}>
          Matched by genre similarity across your releases.
        </Text>

        {loading && (
          <View style={styles.centerBox}>
            <Text style={styles.mutedText}>Finding collaborators...</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerBox}>
            <Ionicons
              name="alert-circle-outline"
              size={26}
              color={theme.colors.darkMuted}
            />
            <Text style={styles.emptyTitle}>Couldn't load recommendations</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={fetchRecommendations}>
              <Text style={styles.retryLabel}>Try again</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && !hasVector && (
          <View style={styles.centerBox}>
            <Ionicons
              name="musical-notes-outline"
              size={26}
              color={theme.colors.darkMuted}
            />
            <Text style={styles.emptyTitle}>No genre profile yet</Text>
            <Text style={styles.emptyText}>
              Log some releases with genres in the Releases tab and we'll match
              you with artists who share your sound.
            </Text>
          </View>
        )}

        {!loading && !error && hasVector && recs.length === 0 && (
          <View style={styles.centerBox}>
            <Ionicons
              name="people-outline"
              size={26}
              color={theme.colors.darkMuted}
            />
            <Text style={styles.emptyTitle}>No matches yet</Text>
            <Text style={styles.emptyText}>
              No other artists with a matching genre profile yet. Check back as
              more artists add releases.
            </Text>
          </View>
        )}

        {!loading &&
          !error &&
          recs.map((rec) => (
            <View key={rec.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(rec.name ?? "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {rec.name}
                  </Text>
                  <Text style={styles.cardHandle} numberOfLines={1}>
                    {rec.username ? `@${rec.username}, ` : ""}
                    {similarityLabel(rec.similarity)}
                  </Text>
                </View>
              </View>

              {rec.sharedGenres.length > 0 && (
                <View style={styles.reasonRow}>
                  {rec.sharedGenres.slice(0, 3).map((g) => (
                    <View key={g.slug} style={styles.reasonChip}>
                      <Ionicons
                        name="musical-note"
                        size={12}
                        color={theme.colors.primary}
                      />
                      <Text style={styles.reasonText}>
                        {slugToLabel(g.slug)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.messageButton,
                  pressed && styles.messageButtonPressed,
                ]}
                onPress={() => onMessage(rec.name)}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={15}
                  color={theme.colors.darkText}
                />
                <Text style={styles.messageLabel}>Message soon</Text>
              </Pressable>
            </View>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.darkBackground },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },

  topLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.title,
    color: theme.colors.darkText,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    lineHeight: 20,
    color: theme.colors.darkMuted,
    marginBottom: 24,
  },

  centerBox: {
    alignItems: "center",
    gap: 10,
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  mutedText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkMuted,
  },
  emptyTitle: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
  },
  emptyText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: theme.colors.secondary,
  },
  retryLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.secondary,
  },

  card: {
    backgroundColor: theme.colors.darkCard,
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: theme.fonts.sansBold,
    fontSize: theme.fontSizes.subtitle,
    color: "#fff",
  },
  cardInfo: { flex: 1 },
  cardName: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.subtitle,
    color: theme.colors.darkText,
    marginBottom: 2,
  },
  cardHandle: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 0,
  },

  reasonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  reasonChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reasonText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkText,
    letterSpacing: 0,
  },

  messageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    height: 42,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  messageButtonPressed: { opacity: 0.8 },
  messageLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkText,
  },
});
