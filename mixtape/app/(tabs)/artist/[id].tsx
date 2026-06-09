// Public-facing artist profile screen visible to fans.
// Takes an artist ID from the route, fetches profile data and fan count
// from Supabase, and lets the fan navigate to the sharing consent flow.

import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

type ArtistProfile = {
  name: string;
  username: string;
  bio: string | null;
  genre: string | null;
  city: string | null;
  country: string | null;
  instagram: string | null;
  tiktok: string | null;
  website: string | null;
};

type Release = {
  id: string;
  title: string;
  release_type: "single" | "ep" | "album" | string;
  release_date: string | null;
  track_count: number;
};

const RELEASE_TYPE_LABELS: Record<string, string> = {
  single: "Single",
  ep: "EP",
  album: "Album",
};

function initialsFromName(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function parseGenreTags(genre: string | null): string[] {
  if (!genre) return [];
  return genre
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function colorFromId(id: string): string {
  const colors = [
    "#FE938C",
    "#4281A4",
    "#2C6E91",
    "#C4A882",
    "#3D4F6B",
    "#7B9E87",
    "#9B7FA6",
  ];
  const index =
    id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
    colors.length;
  return colors[index];
}

function formatReleaseDate(iso: string | null): string {
  if (!iso) return "Unreleased";
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTrackCount(count: number): string {
  return `${count} ${count === 1 ? "track" : "tracks"}`;
}

function colorForReleaseType(type: string): string {
  if (type === "album") return theme.colors.secondary;
  if (type === "ep") return theme.colors.primary;
  return theme.colors.border;
}

export default function ArtistPublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const mounted = useRef(true);

  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [fanCount, setFanCount] = useState<number>(0);
  const [alreadySharing, setAlreadySharing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    loadArtist();
  }, [id]);

  async function loadArtist() {
    setLoading(true);
    setAlreadySharing(false);
    setReleases([]);
    try {
      // Fetch the artist profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select(
          "name, username, bio, genre, city, country, instagram, tiktok, website",
        )
        .eq("id", id)
        .single<ArtistProfile>();

      if (profileError) {
        if (mounted.current) {
          Alert.alert("Error", profileError.message);
        }
        return;
      }
      if (!mounted.current) return;
      if (profileData) setProfile(profileData);

      // Fetch the fan count: consented followers only
      const { count, error: countError } = await supabase
        .from("fan_follows")
        .select("*", { count: "exact", head: true })
        .eq("artist_id", id)
        .not("consented_at", "is", null);

      if (!mounted.current) return;
      if (!countError && count !== null) {
        setFanCount(count);
      }

      // Show a small public discography preview if the artist has releases.
      const { data: releaseData, error: releaseError } = await supabase
        .from("releases")
        .select("id, title, release_type, release_date, track_count")
        .eq("artist_id", id)
        .order("release_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(3);

      if (mounted.current && !releaseError) {
        setReleases((releaseData as Release[]) ?? []);
      }

      // Check whether the current fan already shares with this artist
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && mounted.current) {
        const { data: existingFollow } = await supabase
          .from("fan_follows")
          .select("consented_at")
          .eq("fan_id", user.id)
          .eq("artist_id", id)
          .not("consented_at", "is", null)
          .maybeSingle();

        if (mounted.current && existingFollow) {
          setAlreadySharing(true);
        }
      }
    } catch (e: any) {
      if (mounted.current) {
        Alert.alert("Error", e?.message ?? "Could not load artist profile.");
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  function goToShareConsent() {
    if (!profile) return;
    router.push({
      pathname: "/(sign-in)/favorite-song",
      params: {
        artistId: id,
        artistName: profile.name,
        artistUsername: profile.username,
      },
    });
  }

  function openLink(url: string) {
    Linking.openURL(url).catch(() => {
      Alert.alert("Could not open link", url);
    });
  }

  // Derived display values
  const artistName = profile?.name ?? "";
  const initials = initialsFromName(artistName);
  const genres = parseGenreTags(profile?.genre ?? null);
  const locationParts = [profile?.city, profile?.country].filter(Boolean);
  const locationStr = locationParts.join(", ");
  const avatarColor = id ? colorFromId(id) : theme.colors.primary;

  // Social links gathered into an array for rendering
  const socialLinks: { key: string; label: string; icon: string; url: string }[] = [];
  if (profile?.instagram) {
    socialLinks.push({
      key: "instagram",
      label: `@${profile.instagram}`,
      icon: "logo-instagram",
      url: `https://instagram.com/${profile.instagram}`,
    });
  }
  if (profile?.tiktok) {
    socialLinks.push({
      key: "tiktok",
      label: `@${profile.tiktok}`,
      icon: "logo-tiktok",
      url: `https://tiktok.com/@${profile.tiktok}`,
    });
  }
  if (profile?.website) {
    const displayUrl = profile.website
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    const fullUrl = profile.website.startsWith("http")
      ? profile.website
      : `https://${profile.website}`;
    socialLinks.push({
      key: "website",
      label: displayUrl,
      icon: "globe-outline",
      url: fullUrl,
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topRow}>
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Ionicons
              name="chevron-back"
              size={20}
              color={theme.colors.text}
            />
          </Pressable>
        </View>
        <View style={styles.loadingWrapper}>
          <Text style={styles.emptyText}>Artist not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <View style={styles.topRow}>
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Ionicons
              name="chevron-back"
              size={20}
              color={theme.colors.text}
            />
          </Pressable>
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={styles.artistName}>{artistName}</Text>
          <Text style={styles.artistUsername}>@{profile.username}</Text>

          {/* Genre tags */}
          {genres.length > 0 && (
            <View style={styles.tagRow}>
              {genres.map((g) => (
                <View key={g} style={styles.tag}>
                  <Text style={styles.tagText}>{g}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Location */}
          {locationStr.length > 0 && (
            <View style={styles.locationRow}>
              <Ionicons
                name="location-outline"
                size={14}
                color={theme.colors.muted}
              />
              <Text style={styles.locationText}>{locationStr}</Text>
            </View>
          )}

          {/* Fan count badge */}
          <View style={styles.fanBadge}>
            <Ionicons
              name="people-outline"
              size={14}
              color={theme.colors.secondary}
            />
            <Text style={styles.fanBadgeText}>
              {fanCount} {fanCount === 1 ? "fan" : "fans"} sharing
            </Text>
          </View>
        </View>

        {/* Bio section */}
        {profile.bio && (
          <>
            <Text style={styles.sectionLabel}>ABOUT</Text>
            <View style={styles.card}>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          </>
        )}

        {/* Recent releases */}
        {releases.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>RECENT RELEASES</Text>
            <View style={styles.card}>
              {releases.map((release, i) => (
                <View
                  key={release.id}
                  style={[
                    styles.releaseRow,
                    i < releases.length - 1 && styles.releaseRowBorder,
                  ]}
                >
                  <View
                    style={[
                      styles.releaseIcon,
                      { borderColor: colorForReleaseType(release.release_type) },
                    ]}
                  >
                    <Ionicons
                      name="disc-outline"
                      size={18}
                      color={theme.colors.muted}
                    />
                  </View>
                  <View style={styles.releaseInfo}>
                    <Text style={styles.releaseTitle} numberOfLines={1}>
                      {release.title}
                    </Text>
                    <Text style={styles.releaseMeta} numberOfLines={1}>
                      {RELEASE_TYPE_LABELS[release.release_type] ??
                        release.release_type}
                      {"  "}
                      {formatReleaseDate(release.release_date)}
                    </Text>
                  </View>
                  {release.track_count > 0 && (
                    <Text style={styles.releaseCount}>
                      {formatTrackCount(release.track_count)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Social links */}
        {socialLinks.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>FIND THEM ON</Text>
            <View style={styles.card}>
              {socialLinks.map((link, i) => (
                <Pressable
                  key={link.key}
                  style={[
                    styles.socialRow,
                    i < socialLinks.length - 1 && styles.socialRowBorder,
                  ]}
                  onPress={() => openLink(link.url)}
                >
                  <View style={styles.socialLeft}>
                    <Ionicons
                      name={link.icon as any}
                      size={18}
                      color={theme.colors.text}
                    />
                    <Text style={styles.socialLabel}>{link.label}</Text>
                  </View>
                  <Ionicons
                    name="open-outline"
                    size={14}
                    color={theme.colors.muted}
                  />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Sharing status badge shown in place of CTA when already sharing */}
        {alreadySharing && (
          <View style={styles.sharingBadge}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={theme.colors.success}
            />
            <Text style={styles.sharingBadgeText}>Sharing</Text>
          </View>
        )}
      </ScrollView>

      {/* CTA button pinned at bottom, only when not already sharing */}
      {!alreadySharing && (
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && styles.ctaButtonPressed,
            ]}
            onPress={goToShareConsent}
          >
            <Text style={styles.ctaButtonLabel}>
              Share with {artistName.split(" ")[0]}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  loadingWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.muted,
  },

  // Top row with back button
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },

  // Profile card
  profileCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: {
    fontFamily: theme.fonts.sansBold,
    fontSize: theme.fontSizes.title,
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  artistName: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: 26,
    lineHeight: 32,
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 4,
  },
  artistUsername: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
    letterSpacing: 0.3,
    marginBottom: 14,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tagText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 14,
  },
  locationText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
  },
  fanBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.background,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fanBadgeText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.secondary,
    letterSpacing: 0.3,
  },

  // Section label
  sectionLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },

  // Card used for bio and social links
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  bioText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
    lineHeight: 24,
  },

  // Social link rows
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  socialRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  socialLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  socialLabel: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
  },

  // Public releases preview
  releaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  releaseRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  releaseIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  releaseInfo: {
    flex: 1,
    minWidth: 0,
  },
  releaseTitle: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
    marginBottom: 2,
  },
  releaseMeta: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  releaseCount: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    textAlign: "right",
    minWidth: 56,
  },

  // Already sharing badge
  sharingBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: theme.colors.card,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginTop: 4,
  },
  sharingBadgeText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.button,
    color: theme.colors.success,
  },

  // Footer with CTA button
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: theme.colors.background,
  },
  ctaButton: {
    width: "100%",
    height: 55,
    backgroundColor: theme.colors.primary,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaButtonPressed: {
    opacity: 0.85,
  },
  ctaButtonLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.button,
    color: theme.colors.darkText,
  },
});
