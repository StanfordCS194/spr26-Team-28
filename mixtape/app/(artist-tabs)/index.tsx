import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

// Milestone thresholds for fan count badges.
const MILESTONE_THRESHOLDS = [5, 10, 25, 50, 100, 250, 500, 1000];

interface Profile {
  name: string;
}

// A single item in the activity feed.
interface ActivityItem {
  id: string;
  type: "new_fan" | "milestone";
  message: string;
  timestamp: Date;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
}

// Stats about fan engagement over recent weeks.
interface EngagementStats {
  thisWeekFans: number;
  lastWeekFans: number;
  avgTopTracksPerFan: number;
}

// Returns the highest milestone threshold that the count has reached,
// or null if the count is below the lowest threshold.
function getHighestMilestone(count: number): number | null {
  let result: number | null = null;
  for (const threshold of MILESTONE_THRESHOLDS) {
    if (count >= threshold) {
      result = threshold;
    }
  }
  return result;
}

// Formats a Date as a short relative time string, e.g. "2h ago" or "3d ago".
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

// Card component for a single feed item with icon, text, and timestamp.
function ActivityCard({ item }: { item: ActivityItem }) {
  return (
    <View style={feedStyles.card}>
      <View
        style={[feedStyles.iconCircle, { backgroundColor: item.iconColor + "25" }]}
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
  cardContent: {
    flex: 1,
  },
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

// Single stat display for the engagement section.
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

export default function ArtistInsights() {
  const [artistName, setArtistName] = useState("");
  const [fanCount, setFanCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [engagement, setEngagement] = useState<EngagementStats>({
    thisWeekFans: 0,
    lastWeekFans: 0,
    avgTopTracksPerFan: 0,
  });

  // Build milestone activity items from the current fan count.
  const buildMilestoneItems = useCallback((count: number): ActivityItem[] => {
    const milestone = getHighestMilestone(count);
    if (milestone === null) return [];
    return [
      {
        id: `milestone-${milestone}`,
        type: "milestone",
        message: `${milestone} fans are now sharing with you`,
        timestamp: new Date(),
        icon: "trophy-outline",
        iconColor: theme.colors.primary,
      },
    ];
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch artist profile name.
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();

        if (profile) setArtistName((profile as Profile).name);

        // Count all fans who have consented to share.
        const { count: totalCount } = await supabase
          .from("fan_follows")
          .select("*", { count: "exact", head: true })
          .eq("artist_id", user.id)
          .not("consented_at", "is", null);

        const total = totalCount ?? 0;
        setFanCount(total);

        // Fetch recent fan follows for the activity feed (last 30 days).
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: recentFollows } = await supabase
          .from("fan_follows")
          .select("id, consented_at")
          .eq("artist_id", user.id)
          .not("consented_at", "is", null)
          .gte("consented_at", thirtyDaysAgo.toISOString())
          .order("consented_at", { ascending: false })
          .limit(10);

        // Build activity feed from recent follows and milestones.
        const newFanItems: ActivityItem[] = (recentFollows ?? []).map(
          (follow: { id: string; consented_at: string }) => ({
            id: `fan-${follow.id}`,
            type: "new_fan" as const,
            message: "A new fan started sharing with you",
            timestamp: new Date(follow.consented_at),
            icon: "person-add-outline" as keyof typeof Ionicons.glyphMap,
            iconColor: theme.colors.secondary,
          }),
        );

        const milestoneItems = buildMilestoneItems(total);
        const combined = [...milestoneItems, ...newFanItems]
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 15);
        setActivityItems(combined);

        // Compute weekly engagement stats.
        const now = new Date();
        const startOfThisWeek = new Date(now);
        startOfThisWeek.setDate(now.getDate() - now.getDay());
        startOfThisWeek.setHours(0, 0, 0, 0);

        const startOfLastWeek = new Date(startOfThisWeek);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

        const { count: thisWeekCount } = await supabase
          .from("fan_follows")
          .select("*", { count: "exact", head: true })
          .eq("artist_id", user.id)
          .not("consented_at", "is", null)
          .gte("consented_at", startOfThisWeek.toISOString());

        const { count: lastWeekCount } = await supabase
          .from("fan_follows")
          .select("*", { count: "exact", head: true })
          .eq("artist_id", user.id)
          .not("consented_at", "is", null)
          .gte("consented_at", startOfLastWeek.toISOString())
          .lt("consented_at", startOfThisWeek.toISOString());

        // Query the average number of top tracks per fan from fan_spotify_data.
        // The top_tracks column is a JSON array; its length gives the track count.
        const { data: spotifyRows } = await supabase
          .from("fan_spotify_data")
          .select("top_tracks")
          .in(
            "fan_id",
            (recentFollows ?? []).map(
              (f: { id: string; consented_at: string }) => f.id,
            ),
          );

        let avgTracks = 0;
        if (spotifyRows && spotifyRows.length > 0) {
          const totalTracks = spotifyRows.reduce((sum: number, row: any) => {
            const tracks = row.top_tracks;
            if (Array.isArray(tracks)) return sum + tracks.length;
            return sum;
          }, 0);
          avgTracks = Math.round(totalTracks / spotifyRows.length);
        }

        setEngagement({
          thisWeekFans: thisWeekCount ?? 0,
          lastWeekFans: lastWeekCount ?? 0,
          avgTopTracksPerFan: avgTracks,
        });
      } catch (e) {
        Alert.alert("Error", "Could not load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [buildMilestoneItems]);

  const firstName = artistName.split(" ")[0];

  // Compute the week-over-week change as a descriptive string.
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
        {/* Header */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.dashboardLabel}>ARTIST DASHBOARD</Text>
            <Text style={styles.greeting}>
              Hey, {loading ? "..." : firstName}.
            </Text>
          </View>
          <View style={styles.avatar} />
        </View>

        {/* Privacy banner */}
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

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {fanCount > 0 ? fanCount : "--"}
            </Text>
            <Text style={styles.statLabel}>CONSENTING FANS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {engagement.thisWeekFans > 0 ? engagement.thisWeekFans : "--"}
            </Text>
            <Text style={styles.statLabel}>NEW THIS WEEK</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {engagement.avgTopTracksPerFan > 0
                ? engagement.avgTopTracksPerFan
                : "--"}
            </Text>
            <Text style={styles.statLabel}>AVG TRACKS / FAN</Text>
          </View>
        </View>

        {/* Activity feed section */}
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

        {/* Fan engagement section */}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.darkBackground },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },

  // Header
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

  // Privacy banner
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

  // Stats row
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

  // Sections
  section: {
    marginBottom: 28,
  },
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

  // Empty state for activity feed
  emptyState: {
    backgroundColor: theme.colors.darkCard,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  emptyStateText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
    textAlign: "center",
    lineHeight: 20,
  },

  // Engagement section row
  engagementRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
});
