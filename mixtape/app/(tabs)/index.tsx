/*
 * Fan HOME tab.
 *
 * A fan-facing dashboard that greets the listener and recaps THEIR OWN taste:
 * their top tracks and artists (from their personal `fan_spotify_data`
 * snapshot) plus how many artists they currently share with. Includes clear
 * next-step actions for the two empty states — connect Spotify, and discover
 * artists to share with.
 *
 * NOTE: this screen previously contained a copy of the ARTIST insights
 * dashboard (it even queried `fan_follows` as if the user were the artist),
 * which meant a fan landed on an empty "ARTIST DASHBOARD". It has been rebuilt
 * to show fan-appropriate content. The artist dashboard lives in
 * `app/(artist-tabs)/index.tsx`.
 */

import {
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
import theme from "@/assets/theme";

interface Profile {
  name: string;
}

interface SpotifyData {
  top_tracks: any[];
  top_artists: any[];
  fetched_at: string | null;
}

const ARTIST_DOT_PALETTE = ["#e68b85", "#4281A4", "#7B9E87", "#9B7FA6", "#C4A882"];

export default function FanHome() {
  const router = useRouter();
  const mounted = useRef(true);
  const [name, setName] = useState("");
  const [spotify, setSpotify] = useState<SpotifyData | null>(null);
  const [shareCount, setShareCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !mounted.current) return;

        // The fan's display name for the greeting.
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single<Profile>();
        if (profile && mounted.current) setName(profile.name ?? "");

        // How many artists this fan currently shares with (consent given).
        const { count } = await supabase
          .from("fan_follows")
          .select("*", { count: "exact", head: true })
          .eq("fan_id", user.id)
          .not("consented_at", "is", null);
        if (mounted.current) setShareCount(count ?? 0);

        // The fan's own latest Spotify snapshot.
        const { data: spotifyData } = await supabase
          .from("fan_spotify_data")
          .select("top_tracks, top_artists, fetched_at")
          .eq("fan_id", user.id)
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (spotifyData && mounted.current) setSpotify(spotifyData as SpotifyData);
      } catch (e: any) {
        if (mounted.current)
          Alert.alert("Error", e?.message ?? "Could not load your home.");
      } finally {
        if (mounted.current) setLoading(false);
      }
    }
    load();
  }, []);

  const firstName = name.split(" ")[0] || "there";
  const topTracks: any[] = spotify?.top_tracks?.slice(0, 5) ?? [];
  const topArtists: any[] = spotify?.top_artists?.slice(0, 5) ?? [];
  const hasSpotify = !!spotify;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.topLabel}>YOUR MIXTAPE</Text>
        <Text style={styles.greeting}>Hey, {loading ? "..." : firstName}.</Text>
        <Text style={styles.subGreeting}>
          {hasSpotify
            ? "Here's what your listening says about your taste."
            : "Connect your music to see what your listening says about your taste."}
        </Text>

        {/* Connect-Spotify prompt (shown until a snapshot exists) */}
        {!hasSpotify && !loading && (
          <Pressable
            style={({ pressed }) => [
              styles.connectCard,
              pressed && styles.connectCardPressed,
            ]}
            onPress={() => router.push("/(sign-in)/connect-music")}
          >
            <View style={styles.connectIcon}>
              <Ionicons name="musical-notes" size={20} color="#fff" />
            </View>
            <View style={styles.connectTextWrap}>
              <Text style={styles.connectTitle}>Connect Spotify</Text>
              <Text style={styles.connectSub}>
                See your top tracks and artists, and share them with artists you love.
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.colors.muted}
            />
          </Pressable>
        )}

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{loading ? "--" : shareCount}</Text>
            <Text style={styles.statLabel}>SHARING WITH</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {topTracks.length > 0 ? topTracks.length : "--"}
            </Text>
            <Text style={styles.statLabel}>TOP TRACKS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {topArtists.length > 0 ? topArtists.length : "--"}
            </Text>
            <Text style={styles.statLabel}>TOP ARTISTS</Text>
          </View>
        </View>

        {/* The fan's own top tracks */}
        {topTracks.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>YOUR TOP TRACKS</Text>
            <View style={styles.listCard}>
              {topTracks.map((track: any, i: number) => (
                <View
                  key={track.id ?? i}
                  style={[
                    styles.trackRow,
                    i < topTracks.length - 1 && styles.rowBorder,
                  ]}
                >
                  <Text style={styles.trackRank}>
                    {String(i + 1).padStart(2, "0")}
                  </Text>
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

        {/* The fan's own top artists */}
        {topArtists.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>YOUR TOP ARTISTS</Text>
            <View style={styles.listCard}>
              {topArtists.map((artist: any, i: number) => (
                <View
                  key={artist.id ?? i}
                  style={[
                    styles.artistRow,
                    i < topArtists.length - 1 && styles.rowBorder,
                  ]}
                >
                  <View
                    style={[
                      styles.artistDot,
                      {
                        backgroundColor:
                          ARTIST_DOT_PALETTE[i % ARTIST_DOT_PALETTE.length],
                      },
                    ]}
                  />
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

        {/* Discover / share CTA */}
        {!loading && (
          <Pressable
            style={({ pressed }) => [
              styles.ctaCard,
              pressed && styles.ctaCardPressed,
            ]}
            onPress={() => router.push("/for-you")}
          >
            <View style={styles.ctaTextWrap}>
              <Text style={styles.ctaTitle}>
                {shareCount > 0
                  ? "Share with more artists"
                  : "Find artists to share with"}
              </Text>
              <Text style={styles.ctaSub}>
                {shareCount > 0
                  ? `You're sharing with ${shareCount} ${
                      shareCount === 1 ? "artist" : "artists"
                    }. Discover more in For You.`
                  : "Pick the indie artists you want to support with your listening data."}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },

  topLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  greeting: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.headline,
    lineHeight: 38,
    color: theme.colors.text,
  },
  subGreeting: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    lineHeight: 22,
    color: theme.colors.muted,
    marginTop: 6,
    marginBottom: 20,
  },

  connectCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  connectCardPressed: { borderColor: theme.colors.primary },
  connectIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.spotify,
    alignItems: "center",
    justifyContent: "center",
  },
  connectTextWrap: { flex: 1 },
  connectTitle: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
    marginBottom: 3,
  },
  connectSub: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    lineHeight: 16,
    color: theme.colors.muted,
  },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
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
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
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

  ctaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    padding: 18,
    marginTop: 4,
  },
  ctaCardPressed: { backgroundColor: theme.colors.text },
  ctaTextWrap: { flex: 1 },
  ctaTitle: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: "#fff",
    marginBottom: 3,
  },
  ctaSub: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    lineHeight: 16,
    color: "rgba(255,255,255,0.85)",
  },
});
