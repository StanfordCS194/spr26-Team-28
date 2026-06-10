import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

const BIG_HIT_SLOP = { top: 12, bottom: 12, left: 16, right: 16 };

const GENRE_OPTIONS = [
  "Indie Pop",
  "Indie Rock",
  "Folk",
  "Singer-Songwriter",
  "R&B",
  "Hip-Hop",
  "Electronic",
  "Jazz",
  "Classical",
  "Country",
  "Alternative",
  "Soul",
  "Lo-Fi",
  "Punk",
  "Metal",
  "Ambient",
];

type Profile = {
  name: string;
  username: string;
  role: string | null;
  bio: string | null;
  genre: string | null;
  country: string | null;
  city: string | null;
  instagram: string | null;
  tiktok: string | null;
  website: string | null;
};

// Brand color for Spotify connected account row
const SPOTIFY_BRAND_COLOR = theme.colors.spotify;

function initialsFromName(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase()
  );
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function parseGenreTags(genre: string | null): string[] {
  if (!genre) return [];
  return genre
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ProfileTab() {
  const router = useRouter();
  const mounted = useRef(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editInstagram, setEditInstagram] = useState("");
  const [editTiktok, setEditTiktok] = useState("");
  const [editWebsite, setEditWebsite] = useState("");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) loadProfile();
      }
    );
    loadProfile();
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      setEmail(user.email ?? "");

      const { data, error } = await supabase
        .from("profiles")
        .select("name, username, role")
        .eq("id", user.id)
        .single<Profile>();

      if (error && error.code !== "PGRST116") {
        Alert.alert("Error", error.message);
        return;
      }
      if (data) setProfile(data);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not load profile.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  function startEditing() {
    if (!profile) return;
    setEditName(profile.name ?? "");
    setEditBio(profile.bio ?? "");
    setEditGenres(parseGenreTags(profile.genre));
    setEditCity(profile.city ?? "");
    setEditCountry(profile.country ?? "");
    setEditInstagram(profile.instagram ?? "");
    setEditTiktok(profile.tiktok ?? "");
    setEditWebsite(profile.website ?? "");
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
  }

  function toggleGenre(genre: string) {
    setEditGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  }

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const updates = {
        name: editName.trim(),
        bio: editBio.trim() || null,
        genre: editGenres.length > 0 ? editGenres.join(", ") : null,
        city: editCity.trim() || null,
        country: editCountry.trim() || null,
        instagram: editInstagram.trim() || null,
        tiktok: editTiktok.trim() || null,
        website: editWebsite.trim() || null,
      };

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) {
        Alert.alert("Save failed", error.message);
        return;
      }

      setProfile({ ...profile, ...updates });
      setEditing(false);
    } catch (e: any) {
      Alert.alert("Save failed", e?.message ?? "Network error");
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  // Helper to strip a leading @ if the user typed one
  function stripAtSign(handle: string): string {
    return handle.startsWith("@") ? handle.slice(1) : handle;
  }

  // Build the full URL for a social link
  function socialUrl(platform: "instagram" | "tiktok" | "website", value: string): string {
    if (platform === "instagram") return `https://instagram.com/${stripAtSign(value)}`;
    if (platform === "tiktok") return `https://tiktok.com/@${stripAtSign(value)}`;
    // For website, ensure it has a protocol
    if (!/^https?:\/\//i.test(value)) return `https://${value}`;
    return value;
  }

  // Open a URL in the default browser
  function openLink(url: string) {
    Linking.openURL(url).catch(() => {
      Alert.alert("Could not open link", url);
    });
  }

  // Whether the profile has any social links set
  const hasSocialLinks = Boolean(profile?.instagram || profile?.tiktok || profile?.website);

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

  const artistName = profile?.name ?? "";
  const roleLabel = profile?.role ? capitalize(profile.role) : "Artist";
  const displayName = artistName || "Your profile";
  const initials = initialsFromName(artistName);
  const genres = parseGenreTags(profile?.genre ?? null);
  const locationStr = [profile?.city, profile?.country].filter(Boolean).join(", ");

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <View>
              <Text style={styles.topLabel}>ARTIST PROFILE</Text>
              <Text style={styles.title}>{displayName}</Text>
            </View>

          </View>

          {/* Identity card */}
          <View style={styles.identityCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.identityText}>
              {editing ? (
                <TextInput
                  style={styles.editInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your name"
                  placeholderTextColor={theme.colors.darkMuted}
                />
              ) : (
                <Text style={styles.identityName}>{displayName}</Text>
              )}
              {!editing && genres.length > 0 && (
                <View style={styles.tagRow}>
                  {genres.map((t) => (
                    <View key={t} style={styles.tag}>
                      <Text style={styles.tagText}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Genres (edit mode) */}
          {editing && (
            <>
              <Text style={styles.sectionLabel}>GENRES</Text>
              <View style={styles.card}>
                <View style={styles.genreGrid}>
                  {GENRE_OPTIONS.map((g) => {
                    const selected = editGenres.includes(g);
                    return (
                      <Pressable
                        key={g}
                        style={[styles.genreChip, selected && styles.genreChipSelected]}
                        onPress={() => toggleGenre(g)}
                      >
                        <Text
                          style={[
                            styles.genreChipText,
                            selected && styles.genreChipTextSelected,
                          ]}
                        >
                          {g}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {/* Location (edit mode) */}
          {editing && (
            <>
              <Text style={styles.sectionLabel}>LOCATION</Text>
              <View style={styles.card}>
                <View style={styles.locationFields}>
                  <View style={styles.locationField}>
                    <Text style={styles.fieldLabel}>City</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={editCity}
                      onChangeText={setEditCity}
                      placeholder="e.g. Nashville"
                      placeholderTextColor={theme.colors.darkMuted}
                    />
                  </View>
                  <View style={styles.locationField}>
                    <Text style={styles.fieldLabel}>Country</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={editCountry}
                      onChangeText={setEditCountry}
                      placeholder="e.g. United States"
                      placeholderTextColor={theme.colors.darkMuted}
                    />
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Location (view mode) */}
          {!editing && locationStr && (
            <>
              <Text style={styles.sectionLabel}>LOCATION</Text>
              <View style={styles.card}>
                <View style={styles.locationDisplay}>
                  <Ionicons name="location-outline" size={16} color={theme.colors.darkMuted} />
                  <Text style={styles.bio}>{locationStr}</Text>
                </View>
              </View>
            </>
          )}

          {/* Connected account - Spotify (read-only) */}
          <Text style={styles.sectionLabel}>CONNECTED ACCOUNTS</Text>
          <View style={styles.listCard}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.brandDot, { backgroundColor: SPOTIFY_BRAND_COLOR }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Spotify</Text>
                  <Text style={styles.rowMeta}>{email || "Connected"}</Text>
                </View>
              </View>
              <Text style={styles.rowAction}>Connected</Text>
            </View>
          </View>

          {/* Social links - edit mode */}
          {editing && (
            <>
              <Text style={styles.sectionLabel}>SOCIAL LINKS</Text>
              <View style={styles.card}>
                <View style={styles.locationFields}>
                  <View style={styles.locationField}>
                    <Text style={styles.fieldLabel}>Instagram</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={editInstagram}
                      onChangeText={setEditInstagram}
                      placeholder="@yourhandle"
                      placeholderTextColor={theme.colors.darkMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={styles.locationField}>
                    <Text style={styles.fieldLabel}>TikTok</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={editTiktok}
                      onChangeText={setEditTiktok}
                      placeholder="@yourhandle"
                      placeholderTextColor={theme.colors.darkMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={styles.locationField}>
                    <Text style={styles.fieldLabel}>Website</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={editWebsite}
                      onChangeText={setEditWebsite}
                      placeholder="https://yoursite.com"
                      placeholderTextColor={theme.colors.darkMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Social links - view mode */}
          {!editing && hasSocialLinks && (
            <>
              <Text style={styles.sectionLabel}>SOCIAL LINKS</Text>
              <View style={styles.listCard}>
                {profile?.instagram && (
                  <Pressable
                    style={[styles.row, (profile?.tiktok || profile?.website) ? styles.rowBorder : undefined]}
                    onPress={() => openLink(socialUrl("instagram", profile.instagram!))}
                  >
                    <View style={styles.rowLeft}>
                      <Ionicons name="logo-instagram" size={18} color={theme.colors.darkText} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>Instagram</Text>
                        <Text style={styles.rowMeta}>
                          @{stripAtSign(profile.instagram)}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="open-outline" size={16} color={theme.colors.darkMuted} />
                  </Pressable>
                )}
                {profile?.tiktok && (
                  <Pressable
                    style={[styles.row, profile?.website ? styles.rowBorder : undefined]}
                    onPress={() => openLink(socialUrl("tiktok", profile.tiktok!))}
                  >
                    <View style={styles.rowLeft}>
                      <Ionicons name="logo-tiktok" size={18} color={theme.colors.darkText} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>TikTok</Text>
                        <Text style={styles.rowMeta}>
                          @{stripAtSign(profile.tiktok)}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="open-outline" size={16} color={theme.colors.darkMuted} />
                  </Pressable>
                )}
                {profile?.website && (
                  <Pressable
                    style={styles.row}
                    onPress={() => openLink(socialUrl("website", profile.website!))}
                  >
                    <View style={styles.rowLeft}>
                      <Ionicons name="globe-outline" size={18} color={theme.colors.darkText} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>Website</Text>
                        <Text style={styles.rowMeta}>{profile.website}</Text>
                      </View>
                    </View>
                    <Ionicons name="open-outline" size={16} color={theme.colors.darkMuted} />
                  </Pressable>
                )}
              </View>
            </>
          )}

          {/* Account info */}
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
                  <Text style={styles.rowTitle}>Username</Text>
                  <Text style={styles.rowMeta}>
                    @{profile?.username || "--"}
                  </Text>
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
      </KeyboardAvoidingView>
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
  editActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  cancelBtnText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
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
  editInput: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.subtitle,
    color: theme.colors.darkText,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primary,
    paddingBottom: 6,
    marginBottom: 4,
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
  bioInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: 12,
  },

  genreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  genreChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  genreChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: "rgba(230,139,133,0.15)",
  },
  genreChipText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
  },
  genreChipTextSelected: {
    color: theme.colors.primary,
  },

  locationFields: { gap: 14 },
  locationField: { gap: 6 },
  fieldLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 0.5,
  },
  fieldInput: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  locationDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
});
