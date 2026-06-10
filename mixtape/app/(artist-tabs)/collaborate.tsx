/*
 * Artist COLLAB tab - collaboration recommendations.
 *
 * Recommends other artists for the signed-in artist to collaborate with, based
 * on internal Mixtape data that is already available to the artist:
 *
 *   1. Fan city fit - whether a candidate is based in a city where the artist
 *      already has consenting fans.
 *   2. Artist genre fit - whether the candidate's self-selected genres overlap
 *      with the signed-in artist's profile genres.
 *   3. Release activity - whether that candidate has public release data that
 *      makes them look active enough to act on.
 *
 * Candidates are scored and ranked client-side from aggregate data only. For
 * larger data sets this would move to a Postgres RPC.
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

interface FanCityMatch {
  city: string;
  country: string | null;
  count: number;
}

interface GenreMatch {
  genre: string;
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
  fanCityMatch: FanCityMatch | null;
  genreMatches: GenreMatch[];
  releaseActivity: ReleaseActivity;
  score: number;
}

const CITY_WEIGHT = 3;
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

function locationKey(city: string | null, country: string | null): string | null {
  const cleanCity = city?.trim();
  if (!cleanCity) return null;
  return `${cleanCity.toLowerCase()}||${(country ?? "").trim().toLowerCase()}`;
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

      // 2. Aggregate fan cities from profile data collected in onboarding.
      const fanCityCounts = new Map<string, FanCityMatch>();
      if (myFanIds.length > 0) {
        const { data: fanProfiles, error: fanProfilesError } = await supabase
          .from("profiles")
          .select("city, country")
          .in("id", myFanIds);
        if (fanProfilesError) throw fanProfilesError;

        for (const profile of fanProfiles ?? []) {
          const key = locationKey(profile?.city ?? null, profile?.country ?? null);
          if (!key || !profile?.city) continue;
          const current = fanCityCounts.get(key);
          fanCityCounts.set(key, {
            city: current?.city ?? profile.city,
            country: current?.country ?? profile.country ?? null,
            count: (current?.count ?? 0) + 1,
          });
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
      const myArtist = ((artists ?? []) as ArtistProfile[]).find(
        (a) => a.id === user.id,
      );
      const myGenreSet = new Set(
        splitGenres(myArtist?.genre ?? null).map((genre) => genre.toLowerCase()),
      );

      // 4. Public releases add an activity signal and a fallback when fan
      //    city/genre data is sparse.
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

      // 5. Score each candidate by internal fan city fit, artist genre overlap,
      //    and release activity.
      const scored: Recommendation[] = (artists ?? [])
        .filter((a: ArtistProfile) => a.id !== user.id)
        .map((a: ArtistProfile) => {
          const candidateLocationKey = locationKey(a.city, a.country);
          const fanCityMatch = candidateLocationKey
            ? fanCityCounts.get(candidateLocationKey) ?? null
            : null;
          const genreMatches = splitGenres(a.genre)
            .filter((genre) => myGenreSet.has(genre.toLowerCase()))
            .sort((a, b) => a.localeCompare(b))
            .map((genre) => ({ genre }));
          const cityScore = fanCityMatch?.count ?? 0;
          const genreScore = genreMatches.length;
          const releaseActivity =
            releaseActivityByArtist.get(a.id) ?? emptyReleaseActivity();
          const score =
            cityScore * CITY_WEIGHT +
            genreScore * GENRE_WEIGHT +
            releaseScore(releaseActivity);
          return {
            id: a.id,
            name: a.name ?? a.username ?? "Unknown artist",
            username: a.username,
            location: [a.city, a.country].filter(Boolean).join(", "),
            fanCityMatch,
            genreMatches,
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
          Suggested from fan city overlap, your artist genres, and public
          release activity. Built from internal Mixtape data only.
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
                ? "Once fans share with you, we'll use their cities, your genres, and release activity to find artists."
                : "We could not find artists with matching fan cities, shared genres, or release activity yet. Check back as more artists add releases."}
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
                {rec.fanCityMatch && (
                  <View style={styles.reasonChip}>
                    <Ionicons
                      name="location-outline"
                      size={12}
                      color={theme.colors.secondary}
                    />
                    <Text style={styles.reasonText}>
                      Fan city: {rec.fanCityMatch.city}
                    </Text>
                  </View>
                )}
                {rec.genreMatches.slice(0, 2).map((match) => (
                  <View key={match.genre} style={styles.reasonChip}>
                    <Ionicons
                      name="musical-note"
                      size={12}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.reasonText}>
                      Shared genre: {match.genre}
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
