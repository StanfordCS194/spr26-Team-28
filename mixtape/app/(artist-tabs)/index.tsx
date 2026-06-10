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

const RECENT_SHARE_WINDOW_DAYS = 7;

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
  const [recentShareCount, setRecentShareCount] = useState(0);
  const [cityCount, setCityCount] = useState(0);
  const [consentedDates, setConsentedDates] = useState<string[]>([]);
  const [topTracks, setTopTracks] = useState<TrackTally[]>([]);
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
        setRecentShareCount(countRecentShares(followRows));
      }

      const fanIds = followRows.map((f: any) => f.fan_id);

      if (fanIds.length === 0) {
        if (mounted.current) {
          setRecentShareCount(0);
          setCityCount(0);
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

  function countRecentShares(rows: any[]): number {
    const cutoff = Date.now() - RECENT_SHARE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return rows.filter((row) => {
      const consentedAt = new Date(row?.consented_at).getTime();
      return Number.isFinite(consentedAt) && consentedAt >= cutoff;
    }).length;
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
  const hasData = fanCount > 0 || topTracks.length > 0 || recentShareCount > 0;

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
            <Text style={styles.statValue}>{recentShareCount || "--"}</Text>
            <Text style={styles.statLabel}>NEW SHARES{"\n"}7 DAYS</Text>
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

        {topTracks.length > 0 && (
          <View style={styles.tracksSection}>
            <View style={styles.tracksSectionHeader}>
              <Text style={styles.tracksSectionTitle}>Fan favorite songs</Text>
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

        {!hasData && !loading && (
          <View style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={28} color={theme.colors.darkMuted} />
            <Text style={styles.emptyTitle}>Waiting for fan data</Text>
            <Text style={styles.emptyText}>
              Once fans share with you, their cities and favorite songs will appear here.
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
