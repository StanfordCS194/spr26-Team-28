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
  count: number;
  growthPct: number | null;
}

interface GenreTally {
  name: string;
  count: number;
}

interface DataHealth {
  total: number;
  withData: number;
  fresh: number;
  stale: number;
  missing: number;
  coveragePct: number;
}

const ACTIVE_FAN_WINDOW_DAYS = 7;

const EMPTY_DATA_HEALTH: DataHealth = {
  total: 0,
  withData: 0,
  fresh: 0,
  stale: 0,
  missing: 0,
  coveragePct: 0,
};

function ListenerChart({ points }: { points: { label: string; count: number }[] }) {
  if (points.length < 2) return <View style={{ height: 100, marginTop: 16 }} />;
  const max = Math.max(...points.map((p) => p.count));
  const min = Math.min(...points.map((p) => p.count));
  const range = max - min || 1;

  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.plotArea}>
        {points.map((p, i) => (
          <View
            key={i}
            style={[
              chartStyles.dot,
              {
                left: `${(i / (points.length - 1)) * 100}%`,
                bottom: `${((p.count - min) / range) * 100}%`,
              },
            ]}
          >
            <View style={chartStyles.dotInner} />
          </View>
        ))}
      </View>
      <View style={chartStyles.baseline} />
      <View style={chartStyles.labelsRow}>
        {points.map((p, i) =>
          i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2) ? (
            <Text
              key={i}
              style={[
                chartStyles.barLabel,
                { position: "absolute", left: `${(i / (points.length - 1)) * 100}%` },
              ]}
            >
              {p.label}
            </Text>
          ) : null
        )}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    width: "100%",
    marginTop: 16,
  },
  plotArea: {
    height: 70,
    width: "100%",
    position: "relative",
  },
  dot: {
    position: "absolute",
    width: 10,
    height: 10,
    marginLeft: -5,
    marginBottom: -5,
    alignItems: "center",
    justifyContent: "center",
  },
  dotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.secondary,
    opacity: 0.9,
  },
  baseline: {
    height: 1,
    width: "100%",
    backgroundColor: "rgba(66,129,164,0.35)",
  },
  labelsRow: {
    height: 18,
    width: "100%",
    position: "relative",
    marginTop: 4,
  },
  barLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: 8,
    color: theme.colors.darkMuted,
    letterSpacing: 0.3,
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
  const [activeFanCount, setActiveFanCount] = useState(0);
  const [cityCount, setCityCount] = useState(0);
  const [consentedDates, setConsentedDates] = useState<string[]>([]);
  const [topTracks, setTopTracks] = useState<TrackTally[]>([]);
  const [topGenres, setTopGenres] = useState<GenreTally[]>([]);
  const [dataHealth, setDataHealth] = useState<DataHealth>(EMPTY_DATA_HEALTH);
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

      const { data: followRows } = await supabase
        .from("fan_follows")
        .select("consented_at, fan_id, top_track")
        .eq("artist_id", user.id)
        .not("consented_at", "is", null)
        .order("consented_at", { ascending: true });

      if (!followRows) {
        if (mounted.current) setLoading(false);
        return;
      }

      if (mounted.current) {
        setFanCount(followRows.length);
        setConsentedDates(followRows.map((r: any) => r.consented_at));
        setTopTracks(buildTopTracks(followRows));
      }

      const fanIds = followRows.map((f: any) => f.fan_id);

      if (fanIds.length === 0) {
        if (mounted.current) {
          setActiveFanCount(0);
          setCityCount(0);
          setTopGenres([]);
          setDataHealth(EMPTY_DATA_HEALTH);
        }
        return;
      }

      const { data: profileRows } = await supabase
        .from("profiles")
        .select("city")
        .in("id", fanIds);

      if (mounted.current && profileRows) {
        const uniqueCities = new Set(
          profileRows.map((p: any) => p.city).filter(Boolean)
        );
        setCityCount(uniqueCities.size);
      }

      // Consenting fans' Spotify top artists carry genres; tally them.
      const { data: spotifyRows } = await supabase
        .from("fan_spotify_data")
        .select("fan_id, top_artists, fetched_at")
        .in("fan_id", fanIds);

      const spotifyDataRows = spotifyRows ?? [];
      if (mounted.current) {
        setTopGenres(buildTopGenres(spotifyDataRows));
        setActiveFanCount(countActiveFans(spotifyDataRows));
        setDataHealth(buildDataHealth(fanIds, spotifyDataRows));
      }
    } catch (e) {
      if (mounted.current) Alert.alert("Error", "Could not load dashboard data.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  function buildTopTracks(rows: any[]): TrackTally[] {
    const now = new Date();
    const lastMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;

    const allTime: Record<string, number> = {};
    for (const row of rows) {
      const track = row.top_track;
      if (!track) continue;
      allTime[track] = (allTime[track] ?? 0) + 1;
    }

    return Object.entries(allTime)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => {
        const prevTotal = rows.filter(
          (r: any) => r.top_track === name && r.consented_at.slice(0, 7) <= lastMonth
        ).length;

        const growthPct =
          prevTotal === 0
            ? null
            : Math.round(((count - prevTotal) / prevTotal) * 100);

        return { name, count, growthPct };
      });
  }

  // Count how often each genre appears across consenting fans' top artists.
  function buildTopGenres(rows: any[]): GenreTally[] {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      for (const artist of row?.top_artists ?? []) {
        for (const genre of artist?.genres ?? []) {
          counts[genre] = (counts[genre] ?? 0) + 1;
        }
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }

  function countActiveFans(rows: any[]): number {
    const cutoff = Date.now() - ACTIVE_FAN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return rows.filter((row) => {
      const fetchedAt = new Date(row?.fetched_at).getTime();
      return Number.isFinite(fetchedAt) && fetchedAt >= cutoff;
    }).length;
  }

  function buildDataHealth(fanIds: string[], rows: any[]): DataHealth {
    const fansWithData = new Set<string>();
    let fresh = 0;

    for (const row of rows) {
      if (row?.fan_id) fansWithData.add(row.fan_id);
      const fetchedAt = new Date(row?.fetched_at).getTime();
      if (
        Number.isFinite(fetchedAt) &&
        fetchedAt >= Date.now() - ACTIVE_FAN_WINDOW_DAYS * 24 * 60 * 60 * 1000
      ) {
        fresh += 1;
      }
    }

    const total = fanIds.length;
    const withData = fansWithData.size;
    const missing = Math.max(total - withData, 0);
    const stale = Math.max(withData - fresh, 0);

    return {
      total,
      withData,
      fresh,
      stale,
      missing,
      coveragePct: total === 0 ? 0 : Math.round((withData / total) * 100),
    };
  }

  function buildListenerPoints(dates: string[]): { label: string; count: number }[] {
    if (!dates.length) return [];
    const buckets: Record<string, number> = {};
    for (const d of dates) {
      const key = d.slice(0, 7);
      buckets[key] = (buckets[key] ?? 0) + 1;
    }
    const sorted = Object.keys(buckets).sort();
    let cumulative = 0;
    return sorted.map((k) => {
      cumulative += buckets[k];
      const [year, month] = k.split("-");
      const label = new Date(+year, +month - 1).toLocaleString("default", { month: "short" });
      return { label, count: cumulative };
    });
  }

  const firstName = artistName.split(" ")[0];
  const listenerPoints = buildListenerPoints(consentedDates);
  const hasData = topTracks.length > 0 || topGenres.length > 0 || activeFanCount > 0;
  const dataHealthIssueCount = dataHealth.stale + dataHealth.missing;

  const growthDisplay = (() => {
    if (listenerPoints.length < 2) return "--";
    const prev = listenerPoints[listenerPoints.length - 2].count;
    const curr = listenerPoints[listenerPoints.length - 1].count;
    if (prev === 0) return "--";
    const pct = Math.round(((curr - prev) / prev) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}%`;
  })();

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
            who explicitly chose to share with you. Aggregated only - no
            individual data.
          </Text>
        </View>

        <View style={styles.playsCard}>
          <View style={styles.playsHeader}>
            <Text style={styles.playsLabel}>LISTENER GROWTH</Text>
            {fanCount > 0 && (
              <View style={styles.growthBadge}>
                <Text style={styles.growthText}>
                  {fanCount} {fanCount === 1 ? "fan" : "fans"}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.playsNumber}>{growthDisplay}</Text>
          <ListenerChart points={listenerPoints} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{fanCount || "--"}</Text>
            <Text style={styles.statLabel}>CONSENTING{"\n"}FANS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeFanCount || "--"}</Text>
            <Text style={styles.statLabel}>ACTIVE{"\n"}7 DAYS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {topTracks.length > 0 ? topTracks.length : "--"}
            </Text>
            <Text style={styles.statLabel}>UNIQUE{"\n"}TRACKS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {cityCount > 0 ? cityCount : "--"}
            </Text>
            <Text style={styles.statLabel}>CITIES{"\n"}REACHED</Text>
          </View>
        </View>

        {fanCount > 0 && (
          <View style={styles.healthCard}>
            <View style={styles.healthHeader}>
              <Text style={styles.healthLabel}>DATA HEALTH</Text>
              <View
                style={[
                  styles.healthBadge,
                  dataHealthIssueCount > 0 && styles.healthBadgeWarning,
                ]}
              >
                <Text
                  style={[
                    styles.healthBadgeText,
                    dataHealthIssueCount > 0 && styles.healthBadgeTextWarning,
                  ]}
                >
                  {dataHealth.coveragePct}% coverage
                </Text>
              </View>
            </View>
            <Text style={styles.healthTitle}>
              {dataHealth.fresh} fresh Spotify{" "}
              {dataHealth.fresh === 1 ? "snapshot" : "snapshots"}
            </Text>
            <Text style={styles.healthCopy}>
              {dataHealthIssueCount === 0
                ? "Every consenting fan has listening data from the active insight window."
                : `${dataHealthIssueCount} ${
                    dataHealthIssueCount === 1 ? "fan needs" : "fans need"
                  } a fresh sync before their listening data counts in active insights.`}
            </Text>
            <View style={styles.healthMetrics}>
              <View style={styles.healthMetric}>
                <Text style={styles.healthMetricValue}>{dataHealth.fresh}</Text>
                <Text style={styles.healthMetricLabel}>fresh 7 days</Text>
              </View>
              <View style={styles.healthMetric}>
                <Text style={styles.healthMetricValue}>{dataHealth.stale}</Text>
                <Text style={styles.healthMetricLabel}>stale</Text>
              </View>
              <View style={styles.healthMetric}>
                <Text style={styles.healthMetricValue}>{dataHealth.missing}</Text>
                <Text style={styles.healthMetricLabel}>missing</Text>
              </View>
            </View>
          </View>
        )}

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
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {track.name}
                  </Text>
                  <Text style={styles.trackPlays}>
                    {track.count} {track.count === 1 ? "listener" : "listeners"}
                  </Text>
                </View>
                {track.growthPct !== null ? (
                  <Text style={[
                    styles.fanBadge,
                    track.growthPct < 0 && { color: "#FF5050" },
                  ]}>
                    {track.growthPct >= 0 ? "+" : ""}{track.growthPct}%
                  </Text>
                ) : (
                  <Text style={styles.fanBadgeNew}>new</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {topGenres.length > 0 && (
          <View style={styles.genresSection}>
            <View style={styles.tracksSectionHeader}>
              <Text style={styles.tracksSectionTitle}>
                Genres your fans listen to
              </Text>
            </View>
            <View style={styles.genreChips}>
              {topGenres.map((genre) => (
                <View key={genre.name} style={styles.genreChip}>
                  <Text style={styles.genreChipText}>{genre.name}</Text>
                  <Text style={styles.genreChipCount}>{genre.count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {!hasData && !loading && (
          <View style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={28} color={theme.colors.darkMuted} />
            <Text style={styles.emptyTitle}>Waiting for fan data</Text>
            <Text style={styles.emptyText}>
              Once fans share with you, their aggregated listening patterns will appear here.
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

  genresSection: {
    backgroundColor: theme.colors.darkCard,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  genreChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  genreChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  genreChipText: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkText,
  },
  genreChipCount: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.secondary,
  },

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
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    width: "48%",
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

  healthCard: {
    backgroundColor: theme.colors.darkCard,
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  healthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  healthLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 0.8,
  },
  healthBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(66,129,164,0.24)",
  },
  healthBadgeWarning: {
    backgroundColor: "rgba(255,160,122,0.18)",
  },
  healthBadgeText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.secondary,
    letterSpacing: 0.3,
  },
  healthBadgeTextWarning: {
    color: "#FFA07A",
  },
  healthTitle: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.subtitle,
    lineHeight: 26,
    color: theme.colors.darkText,
    marginBottom: 6,
  },
  healthCopy: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    lineHeight: 20,
    color: theme.colors.darkMuted,
    marginBottom: 16,
  },
  healthMetrics: {
    flexDirection: "row",
    gap: 10,
  },
  healthMetric: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  healthMetricValue: {
    fontFamily: theme.fonts.sansBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
    marginBottom: 4,
  },
  healthMetricLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: 8,
    color: theme.colors.darkMuted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
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
  fanBadgeNew: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
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
