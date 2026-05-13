import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

// Simple sparkline chart using SVG-like View positioning
function SparklineChart() {
  // Dummy trend data — replace with real data from fan_spotify_data
  const points = [30, 35, 28, 40, 38, 45, 50, 48, 55, 60, 58, 65, 72, 75, 80];
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min;
  const width = 100;
  const height = 60;

  return (
    <View style={chartStyles.container}>
      {points.map((val, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return (
          <View
            key={i}
            style={[
              chartStyles.dot,
              {
                left: `${x}%`,
                bottom: `${((val - min) / range) * 100}%`,
              },
            ]}
          />
        );
      })}
      {/* Gradient fill simulation */}
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

interface Profile {
  name: string;
}

export default function ArtistInsights() {
  const [artistName, setArtistName] = useState("");
  const [fanCount, setFanCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Get artist profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();

        if (profile) setArtistName((profile as Profile).name);

        // Count fans who have consented to share with this artist
        const { count } = await supabase
          .from("fan_follows")
          .select("*", { count: "exact", head: true })
          .eq("artist_id", user.id)
          .not("consented_at", "is", null);

        setFanCount(count ?? 0);
      } catch (e) {
        Alert.alert("Error", "Could not load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const firstName = artistName.split(" ")[0];

  // Dummy stats — replace with aggregated fan_spotify_data queries
  const DUMMY_PLAYS = 24810;
  const DUMMY_GROWTH = "+18.4%";
  const DUMMY_WEEKLY_REPLAY = "47%";
  const DUMMY_SAVES = "4.2K";

  const DUMMY_TOP_TRACKS = [
    {
      rank: "01",
      title: "Slow Burn",
      plays: "6,402",
      change: "+24%",
      positive: true,
    },
    {
      rank: "02",
      title: "Paper Lanterns",
      plays: "4,118",
      change: "+8%",
      positive: true,
    },
    {
      rank: "03",
      title: "Hold Loose",
      plays: "2,930",
      change: "-3%",
      positive: false,
    },
  ];

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
            <Text style={styles.privacyIconText}>🛡</Text>
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

        {/* Plays card */}
        <View style={styles.playsCard}>
          <View style={styles.playsHeader}>
            <Text style={styles.playsLabel}>PLAYS · LAST 30 DAYS</Text>
            <View style={styles.growthBadge}>
              <Text style={styles.growthText}>↑ {DUMMY_GROWTH}</Text>
            </View>
          </View>
          <Text style={styles.playsNumber}>{DUMMY_PLAYS.toLocaleString()}</Text>
          <SparklineChart />
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {fanCount > 0 ? `${(fanCount / 1000).toFixed(2)}K` : "—"}
            </Text>
            <Text style={styles.statLabel}>CONSENTING FANS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{DUMMY_WEEKLY_REPLAY}</Text>
            <Text style={styles.statLabel}>WEEKLY REPLAY</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{DUMMY_SAVES}</Text>
            <Text style={styles.statLabel}>SAVES</Text>
          </View>
        </View>

        {/* Top tracks */}
        <View style={styles.tracksSection}>
          <View style={styles.tracksSectionHeader}>
            <Text style={styles.tracksSectionTitle}>Top tracks</Text>
            <Text style={styles.seeAll}>SEE ALL</Text>
          </View>

          {DUMMY_TOP_TRACKS.map((track) => (
            <View key={track.rank} style={styles.trackRow}>
              <Text style={styles.trackRank}>{track.rank}</Text>
              <View style={styles.trackArt} />
              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle}>{track.title}</Text>
                <Text style={styles.trackPlays}>{track.plays} PLAYS</Text>
              </View>
              <Text
                style={[
                  styles.trackChange,
                  track.positive
                    ? styles.trackChangePos
                    : styles.trackChangeNeg,
                ]}
              >
                {track.change}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.dummyNote}>
          <Text style={styles.dummyNoteText}>
            * Play counts and track data are placeholder. They will populate
            once fans stream your music and data is synced.
          </Text>
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
  privacyIconText: { fontSize: 14 },
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

  // Plays card
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

  // Top tracks
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
  seeAll: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 0.8,
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
  trackChange: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.small,
  },
  trackChangePos: { color: theme.colors.secondary },
  trackChangeNeg: { color: theme.colors.danger },

  // Note
  dummyNote: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 12,
  },
  dummyNoteText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    lineHeight: 18,
  },
});
