// Fan profile tab -- shows Spotify connection status and data freshness.
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import theme from "@/assets/theme";
import useDataFreshness from "@/utils/useDataFreshness";

export default function YouTab() {
  const router = useRouter();
  const { isStale, daysSinceSync, lastFetched } = useDataFreshness();

  // Pick a status dot color: green when fresh, amber/orange when stale.
  const statusDotColor = isStale ? "#E6A033" : theme.colors.spotify;
  const statusLabel = lastFetched ? "Connected" : "Not connected";

  // Build a human-readable "last synced" string.
  const lastSyncedLabel = lastFetched
    ? `Last synced ${daysSinceSync === 0 ? "today" : `${daysSinceSync} ${daysSinceSync === 1 ? "day" : "days"} ago`}`
    : "Never synced";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.heading}>You</Text>

        {/* Spotify connection row */}
        <Pressable
          style={({ pressed }) => [
            styles.spotifyRow,
            isStale && styles.spotifyRowStale,
            pressed && styles.spotifyRowPressed,
          ]}
          onPress={() => router.push("/(sign-in)/connect-music")}
        >
          <View style={styles.spotifyLeft}>
            <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
            <View style={styles.spotifyLabels}>
              <Text style={styles.spotifyTitle}>Spotify</Text>
              <View style={styles.spotifyMeta}>
                <Text style={styles.spotifyStatus}>{statusLabel}</Text>
                <Text style={styles.metaSeparator}>-</Text>
                <Text
                  style={[
                    styles.spotifyLastSync,
                    isStale && styles.spotifyLastSyncStale,
                  ]}
                >
                  {lastSyncedLabel}
                </Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
        </Pressable>

        {/* Re-sync prompt shown when data is stale */}
        {isStale && (
          <Pressable
            style={({ pressed }) => [
              styles.resyncCard,
              pressed && styles.resyncCardPressed,
            ]}
            onPress={() => router.push("/(sign-in)/connect-music")}
          >
            <View style={styles.resyncContent}>
              <Ionicons
                name="refresh-circle-outline"
                size={22}
                color={theme.colors.primary}
              />
              <View style={styles.resyncText}>
                <Text style={styles.resyncTitle}>Re-sync your listening data</Text>
                <Text style={styles.resyncSubtitle}>
                  {lastFetched
                    ? `Your data is ${daysSinceSync} ${daysSinceSync === 1 ? "day" : "days"} old. Sync to give your artists the latest.`
                    : "Connect Spotify so your artists can see your listening patterns."}
                </Text>
              </View>
            </View>
            <View style={styles.resyncButton}>
              <Text style={styles.resyncButtonLabel}>Sync now</Text>
              <Ionicons name="arrow-forward" size={14} color={theme.colors.darkText} />
            </View>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },

  heading: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.title,
    color: theme.colors.text,
    marginBottom: 24,
  },

  // Spotify connection row
  spotifyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 16,
  },
  spotifyRowStale: {
    borderColor: "rgba(230, 160, 51, 0.4)",
  },
  spotifyRowPressed: { opacity: 0.7 },
  spotifyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  spotifyLabels: { gap: 3 },
  spotifyTitle: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
  },
  spotifyMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  spotifyStatus: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.4,
  },
  metaSeparator: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
  },
  spotifyLastSync: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.4,
  },
  spotifyLastSyncStale: {
    color: "#E6A033",
  },

  // Re-sync card
  resyncCard: {
    backgroundColor: "rgba(230, 139, 133, 0.12)",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(230, 139, 133, 0.25)",
    padding: 18,
    marginBottom: 16,
  },
  resyncCardPressed: { opacity: 0.7 },
  resyncContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  resyncText: { flex: 1, gap: 4 },
  resyncTitle: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
  },
  resyncSubtitle: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    lineHeight: 20,
    color: theme.colors.muted,
  },
  resyncButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: theme.colors.text,
    borderRadius: 40,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  resyncButtonLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkText,
  },
});
