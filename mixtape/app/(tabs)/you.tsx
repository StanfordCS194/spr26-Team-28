import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/database/db";
import { getStoredSpotifyToken, syncFanSpotifyData } from "@/utils/useSpotifyAuth";
import theme from "@/assets/theme";

interface Profile {
  name: string;
  username: string;
  role: string | null;
  country: string | null;
  city: string | null;
}

interface SpotifyData {
  top_tracks: any[];
  top_artists: any[];
  fetched_at: string | null;
}

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

export default function YouTab() {
  const router = useRouter();
  const mounted = useRef(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [spotify, setSpotify] = useState<SpotifyData | null>(null);
  const [followCount, setFollowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mounted.current) return;

        const { data: profileData } = await supabase
          .from("profiles")
          .select("name, username, role, country, city")
          .eq("id", user.id)
          .single<Profile>();

        if (profileData && mounted.current) setProfile(profileData);

        const { count } = await supabase
          .from("fan_follows")
          .select("*", { count: "exact", head: true })
          .eq("fan_id", user.id)
          .not("consented_at", "is", null);

        if (mounted.current) setFollowCount(count ?? 0);

        const { data: spotifyData } = await supabase
          .from("fan_spotify_data")
          .select("top_tracks, top_artists, fetched_at")
          .eq("fan_id", user.id)
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (spotifyData && mounted.current) setSpotify(spotifyData as SpotifyData);
      } catch (e: any) {
        if (mounted.current) Alert.alert("Error", e?.message ?? "Could not load profile.");
      } finally {
        if (mounted.current) setLoading(false);
      }
    }
    load();
  }, []);

  async function onSignOut() {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert("Sign out failed", error.message);
        if (mounted.current) setSigningOut(false);
        return;
      }
      router.replace("/(sign-in)/sign-in");
    } catch (e: any) {
      Alert.alert("Sign out failed", e?.message ?? "Network error");
      if (mounted.current) setSigningOut(false);
    }
  }

  // Re-sync listening data. If a recent Spotify token is still stored (from the
  // connect step), refresh fan_spotify_data in place; otherwise fall back to the
  // full OAuth connect flow.
  async function onResync() {
    if (resyncing) return;
    setResyncing(true);
    try {
      const token = await getStoredSpotifyToken();
      if (!token) {
        router.push("/(sign-in)/connect-music");
        return;
      }

      await syncFanSpotifyData(token);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: fresh } = await supabase
          .from("fan_spotify_data")
          .select("top_tracks, top_artists, fetched_at")
          .eq("fan_id", user.id)
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fresh && mounted.current) setSpotify(fresh as SpotifyData);
      }
    } catch (e: any) {
      Alert.alert("Re-sync failed", e?.message ?? "Could not refresh your listening data.");
    } finally {
      if (mounted.current) setResyncing(false);
    }
  }

  const name = profile?.name ?? "";
  const initials = initialsFromName(name);
  const location = [profile?.city, profile?.country].filter(Boolean).join(", ");
  const topTracks = spotify?.top_tracks?.slice(0, 5) ?? [];
  const topArtists = spotify?.top_artists?.slice(0, 5) ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.topLabel}>YOUR PROFILE</Text>

        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.identityInfo}>
            <Text style={styles.name}>{loading ? "..." : name || "Fan"}</Text>
            <Text style={styles.username}>@{profile?.username ?? "..."}</Text>
            {location ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={12} color={theme.colors.muted} />
                <Text style={styles.locationText}>{location}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{followCount}</Text>
            <Text style={styles.statLabel}>SHARING WITH</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{topTracks.length > 0 ? topTracks.length : "--"}</Text>
            <Text style={styles.statLabel}>TOP TRACKS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{topArtists.length > 0 ? topArtists.length : "--"}</Text>
            <Text style={styles.statLabel}>TOP ARTISTS</Text>
          </View>
        </View>

        {topTracks.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>YOUR TOP TRACKS</Text>
            <View style={styles.listCard}>
              {topTracks.map((track: any, i: number) => (
                <View
                  key={track.id ?? i}
                  style={[styles.trackRow, i < topTracks.length - 1 && styles.rowBorder]}
                >
                  <Text style={styles.trackRank}>{String(i + 1).padStart(2, "0")}</Text>
                  <View style={styles.trackArt} />
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {track.name}
                    </Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                      {track.artists?.map((a: any) => a.name).join(", ") ?? ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {topArtists.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>YOUR TOP ARTISTS</Text>
            <View style={styles.listCard}>
              {topArtists.map((artist: any, i: number) => (
                <View
                  key={artist.id ?? i}
                  style={[styles.artistRow, i < topArtists.length - 1 && styles.rowBorder]}
                >
                  <View style={[styles.artistDot, { backgroundColor: colorFromIndex(i) }]} />
                  <Text style={styles.artistName} numberOfLines={1}>
                    {artist.name}
                  </Text>
                  <Text style={styles.artistGenre} numberOfLines={1}>
                    {artist.genres?.[0] ?? ""}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {!spotify && !loading && (
          <View style={styles.emptyCard}>
            <Ionicons name="musical-notes-outline" size={28} color={theme.colors.muted} />
            <Text style={styles.emptyTitle}>No listening data yet</Text>
            <Text style={styles.emptyText}>
              Connect your Spotify account to see your top tracks and artists here.
            </Text>
          </View>
        )}

        {spotify && (
          <>
            <Text style={styles.sectionLabel}>SPOTIFY</Text>
            <View style={styles.listCard}>
              <View style={[styles.spotifyRow, styles.rowBorder]}>
                <View style={styles.spotifyLeft}>
                  <View style={styles.spotifyDot} />
                  <View>
                    <Text style={styles.spotifyTitle}>Connected</Text>
                    <Text style={styles.spotifyMeta}>
                      Last synced {spotify.fetched_at
                        ? new Date(spotify.fetched_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric",
                          })
                        : "recently"}
                    </Text>
                  </View>
                </View>
              </View>
              <Pressable
                style={[styles.spotifyRow, resyncing && { opacity: 0.6 }]}
                onPress={onResync}
                disabled={resyncing}
              >
                <View style={styles.spotifyLeft}>
                  <Ionicons name="refresh-outline" size={16} color={theme.colors.muted} />
                  <Text style={styles.spotifyRefresh}>
                    {resyncing ? "Syncing..." : "Re-sync listening data"}
                  </Text>
                </View>
                {resyncing ? (
                  <ActivityIndicator size="small" color={theme.colors.muted} />
                ) : (
                  <Ionicons name="chevron-forward" size={14} color={theme.colors.muted} />
                )}
              </Pressable>
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.listCard}>
          <Pressable
            style={[styles.signOutRow, signingOut && { opacity: 0.5 }]}
            onPress={onSignOut}
            disabled={signingOut}
          >
            <Ionicons name="log-out-outline" size={18} color={theme.colors.danger} />
            <Text style={[styles.signOutText, { color: theme.colors.danger }]}>
              {signingOut ? "Signing out..." : "Sign out"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function colorFromIndex(i: number): string {
  const palette = ["#e68b85", "#4281A4", "#7B9E87", "#9B7FA6", "#C4A882"];
  return palette[i % palette.length];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },

  topLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 1,
    marginBottom: 16,
  },

  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: theme.fonts.sansBold,
    fontSize: theme.fontSizes.subtitle,
    color: "#fff",
    letterSpacing: 1,
  },
  identityInfo: { flex: 1 },
  name: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.subtitle,
    color: theme.colors.text,
    marginBottom: 2,
  },
  username: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
    marginBottom: 6,
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.3,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statValue: {
    fontFamily: theme.fonts.sansBold,
    fontSize: theme.fontSizes.title,
    color: theme.colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: 9,
    color: theme.colors.muted,
    letterSpacing: 0.5,
    textAlign: "center",
  },

  sectionLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },

  listCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  trackRank: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
    width: 20,
  },
  trackArt: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: theme.colors.border,
  },
  trackInfo: { flex: 1 },
  trackTitle: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
    marginBottom: 2,
  },
  trackArtist: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.3,
  },

  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  artistDot: { width: 10, height: 10, borderRadius: 5 },
  artistName: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
    flex: 1,
  },
  artistGenre: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.3,
  },

  emptyCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyTitle: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
  },
  emptyText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },

  signOutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  signOutText: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
  },

  spotifyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  spotifyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  spotifyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1DB954",
  },
  spotifyTitle: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
  },
  spotifyMeta: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  spotifyRefresh: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.muted,
  },
});
