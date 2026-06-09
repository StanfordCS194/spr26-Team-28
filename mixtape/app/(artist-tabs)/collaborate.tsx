/*
 * Artist COLLAB tab - collaboration recommendations.
 *
 * Recommends other artists for the signed-in artist to collaborate with, based
 * on AGGREGATED fan data (never individual fan records, to stay aligned with
 * the product's privacy model):
 *
 *   1. Fan genre fit - how well a candidate artist's genres match the genres
 *      the signed-in artist's consenting fans actually listen to.
 *   2. Release activity - whether that candidate has public release data that
 *      makes them look active enough to act on.
 *
 * Candidates are scored and ranked client-side from aggregate data only,
 * mirroring the INSIGHTS screen. For larger data sets this would move to a
 * Postgres RPC.
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

interface FanGenreMatch {
  genre: string;
  count: number;
}

interface ReleaseRow {
  artist_id: string;
  title: string;
  release_type: string;
  release_date: string | null;
  created_at: string | null;
}

interface ReleaseActivity {
  releaseCount: number;
  recentReleaseCount: number;
  latestRelease: ReleaseRow | null;
}

interface Recommendation {
  id: string;
  name: string;
  username: string | null;
  location: string;
  fanGenreMatches: FanGenreMatch[];
  releaseActivity: ReleaseActivity;
  score: number;
}

const GENRE_WEIGHT = 2;
const RECENT_RELEASE_BONUS = 2;
const MAX_RESULTS = 12;
const RECENT_RELEASE_WINDOW_MS = 1000 * 60 * 60 * 24 * 365;

function splitGenres(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
}

function releaseTypeLabel(value: string): string {
  if (value === "ep") return "EP";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function releaseSortValue(row: ReleaseRow): number {
  const value = row.release_date ?? row.created_at ?? "";
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function emptyReleaseActivity(): ReleaseActivity {
  return {
    releaseCount: 0,
    recentReleaseCount: 0,
    latestRelease: null,
  };
}

function buildReleaseActivity(rows: ReleaseRow[]): Map<string, ReleaseActivity> {
  const now = Date.now();
  const activity = new Map<string, ReleaseActivity>();

  for (const row of rows) {
    const current = activity.get(row.artist_id) ?? emptyReleaseActivity();
    const sortValue = releaseSortValue(row);
    const isRecent =
      sortValue > 0 &&
      sortValue <= now &&
      now - sortValue <= RECENT_RELEASE_WINDOW_MS;

    activity.set(row.artist_id, {
      releaseCount: current.releaseCount + 1,
      recentReleaseCount: current.recentReleaseCount + (isRecent ? 1 : 0),
      latestRelease:
        !current.latestRelease ||
        sortValue > releaseSortValue(current.latestRelease)
          ? row
          : current.latestRelease,
    });
  }

  return activity;
}

function releaseScore(activity: ReleaseActivity): number {
  return (
    Math.min(activity.releaseCount, 3) +
    (activity.recentReleaseCount > 0 ? RECENT_RELEASE_BONUS : 0)
  );
}

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

      // 1. Only this artist's consenting fans are readable under RLS.
      const { data: follows, error: followsError } = await supabase
        .from("fan_follows")
        .select("fan_id")
        .eq("artist_id", user.id)
        .not("consented_at", "is", null);
      if (followsError) throw followsError;

      const myFanIds = [
        ...new Set((follows ?? []).map((f) => f?.fan_id).filter(Boolean)),
      ] as string[];
      if (mounted.current) setConsentingFans(myFanIds.length);

      // 2. Aggregate the genres MY fans actually listen to (from their top
      //    artists). This stays inside the artist's consent boundary.
      const fanGenreCounts = new Map<string, FanGenreMatch>();
      if (myFanIds.length > 0) {
        const { data: spotifyRows } = await supabase
          .from("fan_spotify_data")
          .select("top_artists")
          .in("fan_id", myFanIds);
        for (const row of spotifyRows ?? []) {
          for (const artist of row?.top_artists ?? []) {
            for (const g of artist?.genres ?? []) {
              const genre = String(g).trim();
              if (!genre) continue;
              const key = genre.toLowerCase();
              const current = fanGenreCounts.get(key);
              fanGenreCounts.set(key, {
                genre: current?.genre ?? genre,
                count: (current?.count ?? 0) + 1,
              });
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

      const candidateArtists = ((artists ?? []) as ArtistProfile[]).filter(
        (a) => a.id !== user.id,
      );

      // 4. Public releases add an activity signal and a fallback when fan
      //    genre data is sparse.
      let releaseActivityByArtist = new Map<string, ReleaseActivity>();
      const candidateIds = candidateArtists.map((a) => a.id);
      if (candidateIds.length > 0) {
        const { data: releaseRows, error: releaseError } = await supabase
          .from("releases")
          .select("artist_id, title, release_type, release_date, created_at")
          .in("artist_id", candidateIds);

        if (releaseError && releaseError.code !== "42P01") {
          throw releaseError;
        }

        releaseActivityByArtist = buildReleaseActivity(
          (releaseRows ?? []) as ReleaseRow[],
        );
      }

      // 5. Score each candidate by fan genre fit, with release activity as a
      //    fallback when genre data is still thin.
      const scored: Recommendation[] = (artists ?? [])
        .filter((a: ArtistProfile) => a.id !== user.id)
        .map((a: ArtistProfile) => {
          const fanGenreMatches = splitGenres(a.genre)
            .map((genre) => fanGenreCounts.get(genre.toLowerCase()))
            .filter((match): match is FanGenreMatch => Boolean(match))
            .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre));
          const genreScore = fanGenreMatches.reduce(
            (sum, match) => sum + match.count,
            0,
          );
          const releaseActivity =
            releaseActivityByArtist.get(a.id) ?? emptyReleaseActivity();
          const score = genreScore * GENRE_WEIGHT + releaseScore(releaseActivity);
          return {
            id: a.id,
            name: a.name ?? a.username ?? "Unknown artist",
            username: a.username,
            location: [a.city, a.country].filter(Boolean).join(", "),
            fanGenreMatches,
            releaseActivity,
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
      `Direct messaging with ${name} isn't available yet. It's on the way.`,
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
          Suggested from your fans' top genres and artists who are actively
          releasing music. Aggregated only, never individual data.
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
                ? "Once fans share their listening with you, we'll use their top genres to find artists with active releases."
                : "We could not find artists with matching audience genres or release activity yet. Check back as more artists add releases and more fans share."}
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
                      {rec.location ? `, ${rec.location}` : ""}
                    </Text>
                  ) : rec.location ? (
                    <Text style={styles.cardHandle} numberOfLines={1}>
                      {rec.location}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.reasonRow}>
                {rec.fanGenreMatches.slice(0, 2).map((match) => (
                  <View key={match.genre} style={styles.reasonChip}>
                    <Ionicons
                      name="musical-note"
                      size={12}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.reasonText}>
                      Fan genre: {match.genre}
                    </Text>
                  </View>
                ))}
                {rec.releaseActivity.latestRelease && (
                  <View style={styles.reasonChip}>
                    <Ionicons
                      name="radio-outline"
                      size={12}
                      color={theme.colors.secondary}
                    />
                    <Text style={styles.reasonText}>
                      Latest{" "}
                      {releaseTypeLabel(
                        rec.releaseActivity.latestRelease.release_type,
                      )}
                    </Text>
                  </View>
                )}
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
                <Text style={styles.messageLabel}>Message soon</Text>
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
    letterSpacing: 0,
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
