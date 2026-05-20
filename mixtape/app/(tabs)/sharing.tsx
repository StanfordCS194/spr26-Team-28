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

interface SharingArtist {
  artist_id: string;
  consented_at: string;
  profiles: {
    name: string;
    username: string;
  };
}

function colorFromId(id: string): string {
  const colors = ["#e68b85", "#4281A4", "#2C6E91", "#C4A882", "#3D4F6B", "#7B9E87", "#9B7FA6"];
  const index = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SharingTab() {
  const router = useRouter();
  const mounted = useRef(true);
  const [artists, setArtists] = useState<SharingArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => { fetchSharing(); }, []);

  async function fetchSharing() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted.current) return;

      const { data, error } = await supabase
        .from("fan_follows")
        .select("artist_id, consented_at, profiles:artist_id(name, username)")
        .eq("fan_id", user.id)
        .not("consented_at", "is", null);

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      if (mounted.current) setArtists((data as any) ?? []);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  async function revokeSharing(artistId: string, artistName: string) {
    Alert.alert(
      "Stop sharing?",
      `${artistName} will no longer see your listening data. You can re-share any time.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop sharing",
          style: "destructive",
          onPress: async () => {
            setRevoking(artistId);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              const { error } = await supabase
                .from("fan_follows")
                .update({ consented_at: null })
                .eq("fan_id", user.id)
                .eq("artist_id", artistId);

              if (error) {
                Alert.alert("Error", error.message);
                return;
              }
              if (mounted.current) {
                setArtists((prev) => prev.filter((a) => a.artist_id !== artistId));
              }
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Network error");
            } finally {
              if (mounted.current) setRevoking(null);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.topLabel}>SHARING</Text>
        <Text style={styles.heading}>
          {loading
            ? "Loading..."
            : artists.length === 0
              ? "Not sharing yet."
              : `Active with ${artists.length} ${artists.length === 1 ? "artist" : "artists"}.`}
        </Text>

        <View style={styles.privacyBanner}>
          <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.muted} />
          <Text style={styles.privacyText}>
            Artists only see aggregated patterns across all fans, never your individual data.
            You can stop sharing at any time.
          </Text>
        </View>

        {artists.map((artist) => {
          const name = (artist.profiles as any)?.name ?? "Unknown";
          const username = (artist.profiles as any)?.username ?? "";
          const isRevoking = revoking === artist.artist_id;

          return (
            <View key={artist.artist_id} style={styles.artistCard}>
              <View style={styles.artistTop}>
                <View style={[styles.artistAvatar, { backgroundColor: colorFromId(artist.artist_id) }]}>
                  <Text style={styles.artistInitial}>
                    {name[0]?.toUpperCase() ?? "?"}
                  </Text>
                </View>
                <View style={styles.artistInfo}>
                  <Text style={styles.artistName}>{name}</Text>
                  <Text style={styles.artistUsername}>@{username}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={13} color={theme.colors.muted} />
                  <Text style={styles.detailText}>
                    Sharing since {formatDate(artist.consented_at)}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <View style={styles.statusDot} />
                  <Text style={styles.detailText}>Active</Text>
                </View>
              </View>

              <View style={styles.sharingItems}>
                <Text style={styles.sharingLabel}>WHAT THEY SEE</Text>
                <Text style={styles.sharingText}>
                  Top tracks, listening habits, timing patterns, collaboration overlap
                </Text>
              </View>

              <Pressable
                style={[styles.revokeBtn, isRevoking && { opacity: 0.5 }]}
                onPress={() => revokeSharing(artist.artist_id, name)}
                disabled={isRevoking}
              >
                <Ionicons name="close-circle-outline" size={16} color={theme.colors.danger} />
                <Text style={styles.revokeBtnText}>
                  {isRevoking ? "Stopping..." : "Stop sharing"}
                </Text>
              </Pressable>
            </View>
          );
        })}

        {!loading && (
          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              pressed && styles.addBtnPressed,
            ]}
            onPress={() => router.push("/(sign-in)/follow-artist")}
          >
            <Ionicons name="add" size={18} color={theme.colors.darkText} />
            <Text style={styles.addBtnLabel}>Share with another artist</Text>
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
    marginBottom: 8,
  },
  heading: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: 28,
    lineHeight: 36,
    color: theme.colors.text,
    marginBottom: 20,
  },

  privacyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  privacyText: {
    flex: 1,
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    lineHeight: 20,
    color: theme.colors.muted,
  },

  artistCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  artistTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  artistAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  artistInitial: {
    fontFamily: theme.fonts.sansBold,
    fontSize: theme.fontSizes.body,
    color: "#fff",
  },
  artistInfo: { flex: 1 },
  artistName: {
    fontFamily: theme.fonts.sansBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
    marginBottom: 2,
  },
  artistUsername: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.3,
  },

  detailRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  detailText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },

  sharingItems: { marginBottom: 14 },
  sharingLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: 9,
    color: theme.colors.muted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sharingText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    lineHeight: 20,
    color: theme.colors.muted,
  },

  revokeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(254,147,140,0.3)",
  },
  revokeBtnText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.danger,
  },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 55,
    backgroundColor: theme.colors.text,
    borderRadius: 40,
    marginTop: 8,
  },
  addBtnPressed: { backgroundColor: theme.colors.primary },
  addBtnLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.button,
    color: theme.colors.darkText,
  },
});
