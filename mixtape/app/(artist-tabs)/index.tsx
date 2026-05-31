import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

interface Profile {
  name: string;
}

interface TrackTally {
  name: string;
  artists: string;
  count: number;
}

interface ArtistTally {
  name: string;
  count: number;
}

function SparklineChart({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;

  return (
    <View style={chartStyles.container}>
      {points.map((val, i) => (
        <View
          key={i}
          style={[
            chartStyles.dot,
            {
              left: `${(i / (points.length - 1)) * 100}%`,
              bottom: `${((val - min) / range) * 100}%`,
            },
          ]}
        />
      ))}
      <View style={chartStyles.line} />
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    height: 80,
    width: "100%",
    position: "relative",
    marginTop: 16,
    overflow: "hidden",
  },
  dot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.secondary,
  },
  line: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(66,129,164,0.3)",
  },
});

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export default function ArtistInsights() {
  const mounted = useRef(true);
  const [artistName, setArtistName] = useState("");
  const [fanCount, setFanCount] = useState(0);
  const [topTracks, setTopTracks] = useState<TrackTally[]>([]);
  const [topArtists, setTopArtists] = useState<ArtistTally[]>([]);
  const [totalPlays, setTotalPlays] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      if (profile && mounted.current) setArtistName((profile as Profile).name);

      const { count } = await supabase
        .from("fan_follows")
        .select("*", { count: "exact", head: true })
        .eq("artist_id", user.id)
        .not("consented_at", "is", null);

      if (mounted.current) setFanCount(count ?? 0);

      // Pull Spotify data from all consenting fans to aggregate.
      const { data: follows } = await supabase
        .from("fan_follows")
        .select("fan_id")
        .eq("artist_id", user.id)
        .not("consented_at", "is", null);

      if (!follows?.length) {
        if (mounted.current) setLoading(false);
        return;
      }

      const fanIds = follows.map((f: any) => f.fan_id);
      const { data: spotifyRows } = await supabase
        .from("fan_spotify_data")
        .select("top_tracks, top_artists, recently_played")
        .in("fan_id", fanIds);

      if (spotifyRows && mounted.current) {
        aggregateFanData(spotifyRows);
      }
    } catch (e) {
      if (mounted.current) Alert.alert("Error", "Could not load dashboard data.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  function aggregateFanData(rows: any[]) {
    const trackCounts: Record<string, TrackTally> = {};
    const artistCounts: Record<string, ArtistTally> = {};
    let plays = 0;

    for (const row of rows) {
      const tracks = row.top_tracks ?? [];
      for (const t of tracks) {
        const key = t.id ?? t.name;
        if (!trackCounts[key]) {
          trackCounts[key] = {
            name: t.name,
            artists: t.artists?.map((a: any) => a.name).join(", ") ?? "",
            count: 0,
          };
        }
        trackCounts[key].count += 1;
      }

      const artists = row.top_artists ?? [];
      for (const a of artists) {
        const key = a.id ?? a.name;
        if (!artistCounts[key]) {
          artistCounts[key] = { name: a.name, count: 0 };
        }
        artistCounts[key].count += 1;
      }

      plays += (row.recently_played ?? []).length;
    }

    const sortedTracks = Object.values(trackCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const sortedArtists = Object.values(artistCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setTopTracks(sortedTracks);
    setTopArtists(sortedArtists);
    setTotalPlays(plays);
  }

  const firstName = artistName.split(" ")[0];
  const hasData = topTracks.length > 0 || topArtists.length > 0 || totalPlays > 0;

  // Build sparkline from track frequency distribution.
  const sparklinePoints = topTracks.length >= 2
    ? topTracks.map((t) => t.count)
    : [0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.dashboardLabel}>ARTIST DASHBOARD</Text>
            <Text style={styles.greeting}>
              Hey, {loading ? "..." : firstName}.
            </Text>
          </View>
          <View style={styles.avatar} />
        </View>

        <View style={styles.privacyBanner}>
          <View style={styles.privacyIcon}>
            <Ionicons name="shield-checkmark" size={14} color={theme.colors.secondary} />
          </View>
          <Text style={styles.privacyText}>
            Insights from{" "}
            <Text style={styles.privacyBold}>
              {fanCount} {fanCount === 1 ? "fan" : "fans"}
            </Text>{" "}
            who explicitly chose to share with you. Aggregated only — no
            individual data.
          </Text>
        </View>

        <View style={styles.playsCard}>
          <View style={styles.playsHeader}>
            <Text style={styles.playsLabel}>
              {hasData ? "FAN LISTENING ACTIVITY" : "PLAYS - LAST 30 DAYS"}
            </Text>
            {totalPlays > 0 && (
              <View style={styles.growthBadge}>
                <Text style={styles.growthText}>
                  {fanCount} {fanCount === 1 ? "source" : "sources"}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.playsNumber}>
            {hasData ? formatNumber(totalPlays) : "--"}
          </Text>
          <SparklineChart points={sparklinePoints} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{fanCount || "--"}</Text>
            <Text style={styles.statLabel}>CONSENTING{"\n"}FANS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {topTracks.length > 0 ? topTracks.length : "--"}
            </Text>
            <Text style={styles.statLabel}>UNIQUE{"\n"}TRACKS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {topArtists.length > 0 ? topArtists.length : "--"}
            </Text>
            <Text style={styles.statLabel}>RELATED{"\n"}ARTISTS</Text>
          </View>
        </View>

        {topTracks.length > 0 && (
          <View style={styles.tracksSection}>
            <View style={styles.tracksSectionHeader}>
              <Text style={styles.tracksSectionTitle}>Top tracks from fans</Text>
            </View>

            {topTracks.map((track, i) => (
              <View key={track.name + i} style={styles.trackRow}>
                <Text style={styles.trackRank}>
                  {String(i + 1).padStart(2, "0")}
                </Text>
                <View style={styles.trackArt} />
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {track.name}
                  </Text>
                  <Text style={styles.trackPlays}>
                    {track.artists ? track.artists : `${track.count} fans`}
                  </Text>
                </View>
                <Text style={styles.fanBadge}>
                  {track.count} {track.count === 1 ? "fan" : "fans"}
                </Text>
              </View>
            ))}
          </View>
        )}

        {topArtists.length > 0 && (
          <View style={styles.tracksSection}>
            <View style={styles.tracksSectionHeader}>
              <Text style={styles.tracksSectionTitle}>Artists your fans listen to</Text>
            </View>

            {topArtists.map((artist, i) => (
              <View key={artist.name + i} style={styles.trackRow}>
                <Text style={styles.trackRank}>
                  {String(i + 1).padStart(2, "0")}
                </Text>
                <View style={[styles.trackArt, { borderRadius: 22 }]} />
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {artist.name}
                  </Text>
                </View>
                <Text style={styles.fanBadge}>
                  {artist.count} {artist.count === 1 ? "fan" : "fans"}
                </Text>
              </View>
            ))}
          </View>
        )}

        {!hasData && !loading && (
          <View style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={28} color={theme.colors.darkMuted} />
            <Text style={styles.emptyTitle}>Waiting for fan data</Text>
            <Text style={styles.emptyText}>
              Once fans connect their Spotify and share with you, their
              aggregated listening patterns will appear here.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.darkBackground },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },

  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  dashboardLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  greeting: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: 32,
    lineHeight: 38,
    color: theme.colors.darkText,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
  },

  privacyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: theme.colors.darkCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  privacyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(66,129,164,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  privacyText: {
    flex: 1,
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    lineHeight: 20,
    color: theme.colors.darkMuted,
  },
  privacyBold: {
    fontFamily: theme.fonts.sansBold,
    color: theme.colors.darkText,
  },

  playsCard: {
    backgroundColor: theme.colors.darkCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  playsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  playsLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 0.8,
  },
  growthBadge: {
    backgroundColor: theme.colors.secondary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  growthText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  playsNumber: {
    fontFamily: theme.fonts.sansBold,
    fontSize: 40,
    lineHeight: 48,
    color: theme.colors.darkText,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.darkCard,
    borderRadius: 14,
    padding: 14,
  },
  statValue: {
    fontFamily: theme.fonts.sansBold,
    fontSize: theme.fontSizes.title,
    color: theme.colors.darkText,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: 9,
    color: theme.colors.darkMuted,
    letterSpacing: 0.5,
  },

  tracksSection: { marginBottom: 24 },
  tracksSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  tracksSectionTitle: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.subtitle,
    color: theme.colors.darkText,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  trackRank: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
    width: 20,
  },
  trackArt: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  trackInfo: { flex: 1 },
  trackTitle: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
    marginBottom: 3,
  },
  trackPlays: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 0.5,
  },
  fanBadge: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.secondary,
    letterSpacing: 0.3,
  },

  emptyCard: {
    alignItems: "center",
    gap: 10,
    paddingTop: 40,
    paddingHorizontal: 20,
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
});
