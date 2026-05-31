import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

const MILESTONE_THRESHOLDS = [5, 10, 25, 50, 100, 250, 500, 1000];

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

interface FollowRow {
  id: string;
  fan_id: string;
  consented_at: string;
}

interface ActivityItem {
  id: string;
  type: "new_fan" | "milestone";
  message: string;
  timestamp: Date;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
}

interface EngagementStats {
  thisWeekFans: number;
  lastWeekFans: number;
  avgTopTracksPerFan: number;
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

function getHighestMilestone(count: number): number | null {
  let result: number | null = null;
  for (const threshold of MILESTONE_THRESHOLDS) {
    if (count >= threshold) result = threshold;
  }
  return result;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function ActivityCard({ item }: { item: ActivityItem }) {
  return (
    <View style={feedStyles.card}>
      <View
        style={[
          feedStyles.iconCircle,
          { backgroundColor: `${item.iconColor}25` },
        ]}
      >
        <Ionicons name={item.icon} size={18} color={item.iconColor} />
      </View>
      <View style={feedStyles.cardContent}>
        <Text style={feedStyles.cardMessage}>{item.message}</Text>
        <Text style={feedStyles.cardTimestamp}>
          {formatRelativeTime(item.timestamp)}
        </Text>
      </View>
    </View>
  );
}

function EngagementStat({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <View style={engagementStyles.statBox}>
      <Text style={engagementStyles.statValue}>{value}</Text>
      <Text style={engagementStyles.statLabel}>{label}</Text>
      {subtext ? (
        <Text style={engagementStyles.statSubtext}>{subtext}</Text>
      ) : null}
    </View>
  );
}

export default function ArtistInsights() {
  const mounted = useRef(true);
  const [artistName, setArtistName] = useState("");
  const [fanCount, setFanCount] = useState(0);
  const [topTracks, setTopTracks] = useState<TrackTally[]>([]);
  const [topArtists, setTopArtists] = useState<ArtistTally[]>([]);
  const [totalPlays, setTotalPlays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [engagement, setEngagement] = useState<EngagementStats>({
    thisWeekFans: 0,
    lastWeekFans: 0,
    avgTopTracksPerFan: 0,
  });

  const buildMilestoneItems = useCallback(
    (count: number, follows: FollowRow[]): ActivityItem[] => {
      const milestone = getHighestMilestone(count);
      if (milestone === null) return [];

      const milestoneTimestamp =
        follows[milestone - 1]?.consented_at ?? follows.at(-1)?.consented_at;

      return [
        {
          id: `milestone-${milestone}`,
          type: "milestone",
          message: `${milestone} fans are now sharing with you`,
          timestamp: milestoneTimestamp
            ? new Date(milestoneTimestamp)
            : new Date(),
          icon: "trophy-outline",
          iconColor: theme.colors.primary,
        },
      ];
    },
    [],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    fetchData();
  }, [buildMilestoneItems]);

  async function fetchData() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      if (profile && mounted.current) setArtistName((profile as Profile).name);

      const { data: followsData } = await supabase
        .from("fan_follows")
        .select("id, fan_id, consented_at")
        .eq("artist_id", user.id)
        .not("consented_at", "is", null)
        .order("consented_at", { ascending: false });

      const follows = (followsData ?? []) as FollowRow[];
      const total = follows.length;

      if (!mounted.current) return;
      setFanCount(total);

      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentFollows = follows
        .filter((follow) => new Date(follow.consented_at) >= thirtyDaysAgo)
        .slice(0, 10);

      const newFanItems: ActivityItem[] = recentFollows.map((follow) => ({
        id: `fan-${follow.id}`,
        type: "new_fan",
        message: "A new fan started sharing with you",
        timestamp: new Date(follow.consented_at),
        icon: "person-add-outline",
        iconColor: theme.colors.secondary,
      }));

      const milestoneItems = buildMilestoneItems(
        total,
        [...follows].sort(
          (a, b) =>
            new Date(a.consented_at).getTime() -
            new Date(b.consented_at).getTime(),
        ),
      );

      setActivityItems(
        [...milestoneItems, ...newFanItems]
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 15),
      );

      const startOfThisWeek = new Date(now);
      startOfThisWeek.setDate(now.getDate() - now.getDay());
      startOfThisWeek.setHours(0, 0, 0, 0);

      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

      const thisWeekFans = follows.filter(
        (follow) => new Date(follow.consented_at) >= startOfThisWeek,
      ).length;
      const lastWeekFans = follows.filter((follow) => {
        const consentedAt = new Date(follow.consented_at);
        return consentedAt >= startOfLastWeek && consentedAt < startOfThisWeek;
      }).length;

      if (!follows.length) {
        if (mounted.current) {
          setTopTracks([]);
          setTopArtists([]);
          setTotalPlays(0);
          setEngagement({ thisWeekFans, lastWeekFans, avgTopTracksPerFan: 0 });
        }
        return;
      }

      const fanIds = follows.map((follow) => follow.fan_id);
      const { data: spotifyRows } = await supabase
        .from("fan_spotify_data")
        .select("top_tracks, top_artists, recently_played")
        .in("fan_id", fanIds);

      if (spotifyRows && mounted.current) {
        aggregateFanData(spotifyRows);

        const totalTracks = spotifyRows.reduce((sum: number, row: any) => {
          const tracks = row.top_tracks;
          return Array.isArray(tracks) ? sum + tracks.length : sum;
        }, 0);
        const avgTopTracksPerFan = spotifyRows.length
          ? Math.round(totalTracks / spotifyRows.length)
          : 0;

        setEngagement({ thisWeekFans, lastWeekFans, avgTopTracksPerFan });
      }
    } catch (e) {
      if (mounted.current)
        Alert.alert("Error", "Could not load dashboard data.");
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

    setTopTracks(
      Object.values(trackCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    );
    setTopArtists(
      Object.values(artistCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    );
    setTotalPlays(plays);
  }

  const firstName = artistName.split(" ")[0];
  const hasData =
    topTracks.length > 0 || topArtists.length > 0 || totalPlays > 0;
  const sparklinePoints =
    topTracks.length >= 2
      ? topTracks.map((t) => t.count)
      : [0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];

  const weekDelta = engagement.thisWeekFans - engagement.lastWeekFans;
  const weekDeltaLabel =
    weekDelta > 0
      ? `+${weekDelta} vs last week`
      : weekDelta < 0
        ? `${weekDelta} vs last week`
        : "same as last week";

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
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={theme.colors.secondary}
            />
          </View>
          <Text style={styles.privacyText}>
            Insights from{" "}
            <Text style={styles.privacyBold}>
              {fanCount} {fanCount === 1 ? "fan" : "fans"}
            </Text>{" "}
            who explicitly chose to share with you. Aggregated only -- no
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
              {engagement.thisWeekFans > 0 ? engagement.thisWeekFans : "--"}
            </Text>
            <Text style={styles.statLabel}>NEW THIS{"\n"}WEEK</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {engagement.avgTopTracksPerFan > 0
                ? engagement.avgTopTracksPerFan
                : "--"}
            </Text>
            <Text style={styles.statLabel}>AVG TRACKS{"\n"}/ FAN</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="pulse-outline"
              size={18}
              color={theme.colors.darkMuted}
            />
            <Text style={styles.sectionTitle}>Activity</Text>
          </View>

          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Loading activity...</Text>
            </View>
          ) : activityItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="newspaper-outline"
                size={28}
                color={theme.colors.darkMuted}
              />
              <Text style={styles.emptyStateText}>
                No recent activity yet. When fans start sharing with you, their
                activity will appear here.
              </Text>
            </View>
          ) : (
            activityItems.map((item) => (
              <ActivityCard key={item.id} item={item} />
            ))
          )}
        </View>

        {topTracks.length > 0 && (
          <View style={styles.tracksSection}>
            <View style={styles.tracksSectionHeader}>
              <Text style={styles.tracksSectionTitle}>
                Top tracks from fans
              </Text>
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
              <Text style={styles.tracksSectionTitle}>
                Artists your fans listen to
              </Text>
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

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="trending-up-outline"
              size={18}
              color={theme.colors.darkMuted}
            />
            <Text style={styles.sectionTitle}>Fan engagement</Text>
          </View>

          <View style={styles.engagementRow}>
            <EngagementStat
              label="SHARED THIS WEEK"
              value={String(engagement.thisWeekFans)}
              subtext={weekDeltaLabel}
            />
            <EngagementStat
              label="SHARED LAST WEEK"
              value={String(engagement.lastWeekFans)}
            />
          </View>
          <View style={styles.engagementRow}>
            <EngagementStat
              label="AVG TOP TRACKS / FAN"
              value={
                engagement.avgTopTracksPerFan > 0
                  ? String(engagement.avgTopTracksPerFan)
                  : "--"
              }
              subtext={
                engagement.avgTopTracksPerFan > 0
                  ? "from fan_spotify_data"
                  : "no data yet"
              }
            />
          </View>
        </View>

        {!hasData && !loading && (
          <View style={styles.emptyCard}>
            <Ionicons
              name="analytics-outline"
              size={28}
              color={theme.colors.darkMuted}
            />
            <Text style={styles.emptyTitle}>Waiting for fan data</Text>
            <Text style={styles.emptyText}>
              {fanCount > 0
                ? "Fans have consented, but their Spotify data has not synced yet."
                : "Once fans connect their Spotify and share with you, their aggregated listening patterns will appear here."}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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

const feedStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.darkCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: { flex: 1 },
  cardMessage: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    lineHeight: 20,
    color: theme.colors.darkText,
    marginBottom: 4,
  },
  cardTimestamp: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
  },
});

const engagementStyles = StyleSheet.create({
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.darkCard,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
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
    textAlign: "center",
  },
  statSubtext: {
    fontFamily: theme.fonts.ui,
    fontSize: 9,
    color: theme.colors.secondary,
    letterSpacing: 0.3,
    marginTop: 4,
    textAlign: "center",
  },
});

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
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.subtitle,
    color: theme.colors.darkText,
  },
  tracksSection: { marginBottom: 24 },
  tracksSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  tracksSectionTitle: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.subtitle,
    color: theme.colors.darkText,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  emptyState: {
    backgroundColor: theme.colors.darkCard,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  emptyStateText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  engagementRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
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
