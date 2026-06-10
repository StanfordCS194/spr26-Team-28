/*
 * favorite-song.tsx
 *
 * Asks the fan for their favourite song by the artist they just picked.
 * Sits between follow-artist and share-consent in the onboarding flow.
 *
 * Receives: artistId, artistName, artistUsername
 * Passes:   all of the above + topTrack → share-consent
 */

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

interface Release {
  id: string;
  title: string;
  album_title: string | null;
}

export default function FavoriteSong() {
  const router = useRouter();
  const { artistId, artistName, artistUsername } = useLocalSearchParams<{
    artistId: string;
    artistName: string;
    artistUsername: string;
  }>();

  const [releases, setReleases] = useState<Release[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(true);
  const [selected, setSelected] = useState<string>("");

  const firstName = artistName?.split(" ")[0] ?? "this artist";

  useEffect(() => {
    async function fetchReleases() {
      if (!artistId) return;
      const { data } = await supabase
        .from("releases")
        .select("id, title, album_title")
        .eq("artist_id", artistId)
        .order("title", { ascending: true });
      setReleases((data as Release[]) ?? []);
      setLoadingReleases(false);
    }
    fetchReleases();
  }, [artistId]);

  function handleContinue() {
    router.push({
      pathname: "/(sign-in)/share-consent",
      params: {
        artistId,
        artistName,
        artistUsername,
        topTrack: selected,
      },
    });
  }

  function skip() {
    router.push({
      pathname: "/(sign-in)/share-consent",
      params: {
        artistId,
        artistName,
        artistUsername,
        topTrack: "",
      },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top row */}
        <View style={styles.topRow}>
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </Pressable>
          <Pressable onPress={skip}>
            <Text style={styles.skipLabel}>SKIP</Text>
          </Pressable>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            What's your favorite song by {firstName}?
          </Text>
          <Text style={styles.subtitle}>
            This helps {firstName} understand which tracks mean the most to
            their fans.
          </Text>
        </View>

        {/* Release list */}
        {loadingReleases ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
        ) : releases.length === 0 ? (
          <Text style={styles.emptyText}>
            {firstName} hasn't added any releases yet.
          </Text>
        ) : (
          <View style={styles.list}>
            {releases.map((release) => {
              const isSelected = selected === release.title;
              const label = release.album_title ?? "Single";
              return (
                <Pressable
                  key={release.id}
                  style={[styles.item, isSelected && styles.itemSelected]}
                  onPress={() => setSelected(isSelected ? "" : release.title)}
                >
                  <View style={styles.itemLeft}>
                    <Text style={[styles.itemTitle, isSelected && styles.itemTitleSelected]}>
                      {release.title}
                    </Text>
                    <Text style={styles.itemType}>{label}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.button, !selected && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!selected}
        >
          <Text style={styles.buttonLabel}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  skipLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
    letterSpacing: 0.6,
  },
  header: { marginTop: 10, marginBottom: 28 },
  title: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.title,
    lineHeight: 38,
    color: theme.colors.text,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    lineHeight: 26,
    color: theme.colors.muted,
  },
  list: {
    gap: 10,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  itemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: "rgba(230,139,133,0.08)",
  },
  itemLeft: { gap: 3 },
  itemTitle: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
  },
  itemTitleSelected: {
    color: theme.colors.primary,
  },
  itemType: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.5,
  },
  emptyText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.muted,
    textAlign: "center",
    marginTop: 40,
    lineHeight: 24,
  },
  spacer: { flex: 1, minHeight: 40 },
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
  },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.button,
    color: theme.colors.darkText,
  },
});
