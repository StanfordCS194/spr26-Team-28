import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

// Placeholder bio-style data. Eventually these fields should live on the
// profiles row so the artist can edit them; for now they render as static
// strings so the layout and typography can be reviewed.
const PLACEHOLDER = {
  genre: "Indie Pop",
  location: "Nashville, TN",
  tags: ["Indie Pop", "Folk", "Singer-Songwriter"],
  bio: "Writing slow-burning songs from a converted garage. New EP out this spring.",
};

const BIG_HIT_SLOP = { top: 12, bottom: 12, left: 16, right: 16 };

type Profile = {
  name: string;
  role: string | null;
};

type AccountRow = {
  key: string;
  name: string;
  handle: string | null;
  connected: boolean;
  brandColor: string;
};

function initialsFromName(name: string): string {
  // Filter empty tokens so a name like "Alan  Ma" does not produce "undefined".
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

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

export default function ProfileTab() {
  const router = useRouter();
  const mounted = useRef(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

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
        if (!user) return;
        if (!mounted.current) return;
        setEmail(user.email ?? "");

        const { data, error } = await supabase
          .from("profiles")
          .select("name, role")
          .eq("id", user.id)
          .single<Profile>();

        if (error && error.code !== "PGRST116") {
          Alert.alert("Error", error.message);
          return;
        }
        if (!mounted.current) return;
        if (data) setProfile(data);
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "Could not load profile.");
      } finally {
        if (mounted.current) setLoading(false);
      }
    }
    load();
  }, []);

  // The Supabase schema does not yet track which external accounts are linked,
  // so Spotify is shown as connected (it was the sign-up path) and the other
  // services render as disconnected stubs until that data is wired up.
  const accounts: AccountRow[] = [
    { key: "spotify", name: "Spotify", handle: email || null, connected: true, brandColor: theme.colors.spotify },
    { key: "apple", name: "Apple Music", handle: null, connected: false, brandColor: "rgba(255,255,255,0.12)" },
    { key: "instagram", name: "Instagram", handle: null, connected: false, brandColor: "rgba(255,255,255,0.12)" },
    { key: "tiktok", name: "TikTok", handle: null, connected: false, brandColor: "rgba(255,255,255,0.12)" },
  ];

  async function onSignOut() {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert("Sign out failed", error.message);
        if (mounted.current) setSigningOut(false);
        return;
      }
      // Use the explicit sign-in route so navigation does not race with
      // useSession's onAuthStateChange callback.
      router.replace("/(sign-in)/sign-in");
    } catch (e: any) {
      Alert.alert("Sign out failed", e?.message ?? "Network error");
      if (mounted.current) setSigningOut(false);
    }
  }

  const artistName = profile?.name ?? "";
  const roleLabel = profile?.role ? capitalize(profile.role) : "Artist";
  const displayName = loading || !artistName ? "Your profile" : artistName;
  const initials = initialsFromName(artistName);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.topLabel}>ARTIST PROFILE</Text>
            <Text style={styles.title}>{displayName}</Text>
          </View>
          <Pressable
            hitSlop={BIG_HIT_SLOP}
            style={styles.editBtn}
            accessibilityRole="button"
            accessibilityLabel="Edit profile (coming soon)"
            onPress={() => Alert.alert("Coming soon", "Profile editing is not wired up yet.")}
          >
            <Ionicons
              name="create-outline"
              size={16}
              color={theme.colors.darkText}
            />
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.identityName}>{displayName}</Text>
            <Text style={styles.identityMeta}>
              {PLACEHOLDER.genre}, {PLACEHOLDER.location}
            </Text>
            <View style={styles.tagRow}>
              {PLACEHOLDER.tags.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <Text style={styles.bio}>{PLACEHOLDER.bio}</Text>
        </View>

        <Text style={styles.sectionLabel}>CONNECTED ACCOUNTS</Text>
        <View style={styles.listCard}>
          {accounts.map((a, i) => {
            const isLast = i === accounts.length - 1;
            return (
              <View
                key={a.key}
                style={[styles.row, !isLast && styles.rowBorder]}
              >
                <View style={styles.rowLeft}>
                  <View
                    style={[styles.brandDot, { backgroundColor: a.brandColor }]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{a.name}</Text>
                    <Text style={styles.rowMeta}>
                      {a.connected ? a.handle ?? "Connected" : "Not connected"}
                    </Text>
                  </View>
                </View>
                <Pressable
                  hitSlop={BIG_HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={
                    a.connected
                      ? `Manage ${a.name} connection (coming soon)`
                      : `Connect ${a.name} (coming soon)`
                  }
                  onPress={() => Alert.alert("Coming soon", `${a.name} linking is not wired up yet.`)}
                >
                  <Text
                    style={[
                      styles.rowAction,
                      !a.connected && styles.rowActionPrimary,
                    ]}
                  >
                    {a.connected ? "Manage" : "Connect"}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.listCard}>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowLeft}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Email</Text>
                <Text style={styles.rowMeta}>{email || "Not available"}</Text>
              </View>
            </View>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowLeft}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Role</Text>
                <Text style={styles.rowMeta}>{roleLabel}</Text>
              </View>
            </View>
          </View>
          <Pressable
            style={[styles.row, signingOut && styles.rowDisabled]}
            onPress={onSignOut}
            disabled={signingOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            accessibilityState={{ disabled: signingOut }}
          >
            <View style={styles.rowLeft}>
              <Ionicons
                name="log-out-outline"
                size={18}
                color={theme.colors.danger}
              />
              <Text style={[styles.rowTitle, { color: theme.colors.danger }]}>
                {signingOut ? "Signing out..." : "Sign out"}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.darkBackground },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },

  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  topLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: 32,
    lineHeight: 38,
    color: theme.colors.darkText,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  editBtnText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkText,
  },

  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: theme.colors.darkCard,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: theme.fonts.sansBold,
    fontSize: theme.fontSizes.subtitle,
    color: theme.colors.darkText,
    letterSpacing: 1,
  },
  identityText: { flex: 1 },
  identityName: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.subtitle,
    color: theme.colors.darkText,
    marginBottom: 4,
  },
  identityMeta: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  tagText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 0.4,
  },

  sectionLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },

  card: {
    backgroundColor: theme.colors.darkCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  bio: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
    lineHeight: 24,
  },

  listCard: {
    backgroundColor: theme.colors.darkCard,
    borderRadius: 14,
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDisabled: { opacity: 0.5 },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  brandDot: { width: 10, height: 10, borderRadius: 5 },
  rowTitle: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
  },
  rowMeta: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    marginTop: 3,
    letterSpacing: 0.3,
  },
  rowAction: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
  },
  rowActionPrimary: { color: theme.colors.primary },
});
