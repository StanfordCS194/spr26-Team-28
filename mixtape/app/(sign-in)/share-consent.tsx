import {
  Alert,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

const SHARED_ITEMS = [
  {
    label: "That you listen to their music",
    sublabel: "Linked to your fan profile, not your real name.",
    shared: true,
  },
  {
    label: "Which of their tracks and how often",
    sublabel: "Per-track plays in the last 90 days.",
    shared: true,
  },
  {
    label: "When you listen",
    sublabel: "Times of day, days of week. Used for aggregated trends.",
    shared: true,
  },
  {
    label: "Other artists you listen to",
    sublabel:
      "Helps the artist understand collaboration and tour opportunities.",
    shared: true,
  },
  {
    label: "Your location",
    sublabel: "The city you selected, not attached to your real name",
    shared: true,
  },
  {
    label: "Other artists you share with on Mixtape",
    sublabel: null,
    shared: false,
  },
];

export default function ShareConsent() {
  const router = useRouter();
  const { artistId, artistName, artistUsername, topTrack } = useLocalSearchParams<{
    artistId: string;
    artistName: string;
    artistUsername: string;
    topTrack: string;
  }>();

  const [saving, setSaving] = useState(false);

  async function shareWithArtist() {
    setSaving(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert("Error", "Could not get user session.");
        return;
      }

      const { error } = await supabase.from("fan_follows").upsert(
        {
          fan_id: user.id,
          artist_id: artistId,
          consented_at: new Date().toISOString(),
          top_track: topTrack || null,
        },
        // Re-consenting updates the existing row instead of inserting a
        // duplicate (relies on the UNIQUE(fan_id, artist_id) constraint).
        { onConflict: "fan_id,artist_id" },
      );

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      // TODO: trigger Spotify data fetch + store in Supabase here
      // await storeFanSpotifyData(user.id, fanData);

      console.log(`✅ Fan consented to share with ${artistName}`);
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Network error", error.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  // Not now — skip sharing, go to tabs
  function notNow() {
    router.replace("/(tabs)");
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>

        {/* Artist card */}
        <View style={styles.artistCard}>
          <View style={styles.artistCardLeft}>
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoLabel}>PHOTO</Text>
            </View>
            <View>
              <Text style={styles.sharingWith}>SHARING WITH</Text>
              <Text style={styles.artistName}>{artistName}</Text>
              <Text style={styles.artistUsername}>@{artistUsername}</Text>
            </View>
          </View>
          <View style={styles.decorativeCircle} />
        </View>

        <Text style={styles.heading}>
          {artistName?.split(" ")[0]} will see, only from you:
        </Text>

        <View style={styles.items}>
          {SHARED_ITEMS.map((item, i) => (
            <View key={i} style={styles.item}>
              <View
                style={[
                  styles.itemIcon,
                  item.shared ? styles.itemIconShared : styles.itemIconBlocked,
                ]}
              >
                <Ionicons
                  name={item.shared ? "checkmark" : "close"}
                  size={14}
                  color={item.shared ? "#FFFFFF" : theme.colors.muted}
                />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.itemLabel}>{item.label}</Text>
                {item.sublabel && (
                  <Text style={styles.itemSublabel}>{item.sublabel}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={shareWithArtist}
          disabled={saving}
        >
          <Text style={styles.buttonLabel}>
            {saving ? "Sharing..." : `Share with ${artistName?.split(" ")[0]}`}
          </Text>
        </Pressable>
        <Pressable onPress={notNow} style={styles.notNowLink}>
          <Text style={styles.notNowLabel}>Not now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  artistCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: 18,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
    overflow: "hidden",
  },
  artistCardLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  photoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.5,
  },
  sharingWith: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1,
    marginBottom: 2,
  },
  artistName: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.subtitle,
    color: theme.colors.text,
    marginBottom: 2,
  },
  artistUsername: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.text,
    opacity: 0.7,
  },
  decorativeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    position: "absolute",
    right: -20,
    top: -10,
  },
  heading: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.title,
    lineHeight: 34,
    color: theme.colors.text,
    marginBottom: 20,
  },
  items: { gap: 16, marginBottom: 24 },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  itemIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  itemIconShared: { backgroundColor: theme.colors.secondary },
  itemIconBlocked: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  itemText: { flex: 1 },
  itemLabel: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
    marginBottom: 2,
  },
  itemSublabel: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    lineHeight: 18,
    color: theme.colors.muted,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: theme.colors.background,
  },
  button: {
    width: "100%",
    height: 55,
    backgroundColor: theme.colors.primary,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.button,
    color: theme.colors.darkText,
  },
  notNowLink: { alignItems: "center" },
  notNowLabel: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
  },
});
