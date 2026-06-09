/*
 * Artist COLLAB tab — collaboration recommendations.
 *
 * Recommends other artists for the signed-in artist to collaborate with, based
 * on AGGREGATED fan data (never individual fan records, to stay aligned with
 * the product's privacy model):
 *
 *   1. Shared fanbase — how many of the artist's consenting fans also consent
 *      to share with a candidate artist (fanbase overlap).
 *   2. Taste alignment — how well a candidate's own genres match the genres the
 *      signed-in artist's fans actually listen to (from their top artists).
 *
 * Candidates are scored (shared fans weighted higher) and ranked. The graph is
 * aggregated client-side here, mirroring the INSIGHTS screen; for larger data
 * sets this would move to a Postgres RPC.
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

interface ArtistProfile {
  id: string;
  name: string | null;
  username: string | null;
  genre: string | null;
  city: string | null;
  country: string | null;
}

interface Recommendation {
  id: string;
  name: string;
  username: string | null;
  location: string;
  sharedFans: number;
  genreMatches: string[];
  score: number;
}

const SHARED_FAN_WEIGHT = 3;
const MAX_RESULTS = 12;

export default function Collaborate() {
  const mounted = useRef(true);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [consentingFans, setConsentingFans] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  async function fetchRecommendations() {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !mounted.current) return;

      // 1. The full consenting fan <-> artist graph.
      const { data: follows, error: followsError } = await supabase
        .from("fan_follows")
        .select("fan_id, artist_id")
        .not("consented_at", "is", null);
      if (followsError) throw followsError;

      // artist_id -> set of consenting fan ids
      const artistFans = new Map<string, Set<string>>();
      for (const f of follows ?? []) {
        if (!f?.artist_id || !f?.fan_id) continue;
        if (!artistFans.has(f.artist_id)) artistFans.set(f.artist_id, new Set());
        artistFans.get(f.artist_id)!.add(f.fan_id);
      }
      const myFans = artistFans.get(user.id) ?? new Set<string>();
      if (mounted.current) setConsentingFans(myFans.size);

      // 2. Aggregate the genres MY fans actually listen to (from their top
      //    artists) — used for taste alignment with candidate artists.
      const myGenreCounts: Record<string, number> = {};
      if (myFans.size > 0) {
        const { data: spotifyRows } = await supabase
          .from("fan_spotify_data")
          .select("top_artists")
          .in("fan_id", [...myFans]);
        for (const row of spotifyRows ?? []) {
          for (const artist of row?.top_artists ?? []) {
            for (const g of artist?.genres ?? []) {
              const key = String(g).toLowerCase();
              myGenreCounts[key] = (myGenreCounts[key] ?? 0) + 1;
            }
          }
        }
      }

      // 3. All other artists are candidates.
      const { data: artists, error: artistsError } = await supabase
        .from("profiles")
        .select("id, name, username, genre, city, country")
        .eq("role", "artist");
      if (artistsError) throw artistsError;

      // 4. Score each candidate by shared fans + genre alignment.
      const scored: Recommendation[] = (artists ?? [])
        .filter((a: ArtistProfile) => a.id !== user.id)
        .map((a: ArtistProfile) => {
          const theirFans = artistFans.get(a.id) ?? new Set<string>();
          let sharedFans = 0;
          for (const f of myFans) if (theirFans.has(f)) sharedFans += 1;

          const theirGenres = (a.genre ?? "")
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean);
          const genreMatches = theirGenres.filter(
            (g) => myGenreCounts[g.toLowerCase()],
          );

          const score = sharedFans * SHARED_FAN_WEIGHT + genreMatches.length;
          return {
            id: a.id,
            name: a.name ?? a.username ?? "Unknown artist",
            username: a.username,
            location: [a.city, a.country].filter(Boolean).join(", "),
            sharedFans,
            genreMatches,
            score,
          };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
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
      `Direct messaging with ${name} isn't available yet — it's on the way.`,
    );
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
          Suggested from overlapping fanbases and what your fans listen to —
          aggregated only, never individual data.
        </Text>

        {loading && (
          <View style={styles.centerBox}>
            <Text style={styles.mutedText}>Finding collaborators…</Text>
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

        {!loading && !error && recs.length === 0 && (
          <View style={styles.centerBox}>
            <Ionicons
              name="people-outline"
              size={26}
              color={theme.colors.darkMuted}
            />
            <Text style={styles.emptyTitle}>No matches yet</Text>
            <Text style={styles.emptyText}>
              {consentingFans === 0
                ? "Once fans share their listening with you, we'll suggest artists whose fanbases overlap with yours."
                : "We couldn't find artists with overlapping fans or matching genres yet. Check back as more artists and fans join."}
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
                    {rec.name.charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {rec.name}
                  </Text>
                  {rec.username ? (
                    <Text style={styles.cardHandle} numberOfLines={1}>
                      @{rec.username}
                      {rec.location ? ` · ${rec.location}` : ""}
                    </Text>
                  ) : rec.location ? (
                    <Text style={styles.cardHandle} numberOfLines={1}>
                      {rec.location}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.reasonRow}>
                {rec.sharedFans > 0 && (
                  <View style={styles.reasonChip}>
                    <Ionicons
                      name="people"
                      size={12}
                      color={theme.colors.secondary}
                    />
                    <Text style={styles.reasonText}>
                      {rec.sharedFans} shared{" "}
                      {rec.sharedFans === 1 ? "fan" : "fans"}
                    </Text>
                  </View>
                )}
                {rec.genreMatches.slice(0, 2).map((g) => (
                  <View key={g} style={styles.reasonChip}>
                    <Ionicons
                      name="musical-note"
                      size={12}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.reasonText}>{g}</Text>
                  </View>
                ))}
              </View>

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
                <Text style={styles.messageLabel}>Message · soon</Text>
              </Pressable>
            </View>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.darkBackground },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },

  topLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 1,
    marginBottom: 6,
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
    borderRadius: 16,
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
    letterSpacing: 0.3,
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
    letterSpacing: 0.2,
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
