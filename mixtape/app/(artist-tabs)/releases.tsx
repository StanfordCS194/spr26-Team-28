/*
 * Artist RELEASES tab.
 *
 * Lists the signed-in artist's releases (from the `releases` table) and lets
 * them add a new single/EP/album with a title, type, and track count. The
 * screen degrades gracefully if the `releases` table does not exist yet.
 */

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

interface Release {
  id: string;
  title: string;
  release_type: "single" | "ep" | "album";
  release_date: string | null;
  track_count: number;
}

const TYPE_LABELS: Record<string, string> = {
  single: "Single",
  ep: "EP",
  album: "Album",
};

function formatDate(iso: string | null): string {
  if (!iso) return "Unreleased";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function colorForType(t: string): string {
  if (t === "album") return theme.colors.secondary;
  if (t === "ep") return theme.colors.primary;
  return "rgba(255,255,255,0.15)";
}

function parseTrackCount(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default function ReleasesTab() {
  const mounted = useRef(true);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  // New release form fields.
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"single" | "ep" | "album">("single");
  const [newTracks, setNewTracks] = useState("1");

  function resetForm() {
    setNewTitle("");
    setNewType("single");
    setNewTracks("1");
    setAdding(false);
  }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => { loadReleases(); }, []);

  async function loadReleases() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted.current) return;

      const { data, error } = await supabase
        .from("releases")
        .select("id, title, release_type, release_date, track_count")
        .eq("artist_id", user.id)
        .order("release_date", { ascending: false });

      if (error && error.code !== "PGRST116" && error.code !== "42P01") {
        Alert.alert("Error", error.message);
        return;
      }
      if (mounted.current) setReleases((data as Release[]) ?? []);
    } catch (e: any) {
      // The releases table may not exist yet. Show empty state gracefully.
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  async function saveRelease() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Always send a positive integer to the integer column. An empty string
      // from the numeric input should never reach Supabase.
      const trackCount = parseTrackCount(newTracks);

      const { data, error } = await supabase
        .from("releases")
        .insert({
          artist_id: user.id,
          title: newTitle.trim(),
          release_type: newType,
          track_count: trackCount,
        })
        .select()
        .single();

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      if (data && mounted.current) {
        setReleases((prev) => [data as Release, ...prev]);
      }
      resetForm();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not save release.");
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.topLabel}>RELEASES</Text>
            <Text style={styles.title}>Your music</Text>
          </View>
          {!adding && (
            <Pressable style={styles.addBtn} onPress={() => setAdding(true)}>
              <Ionicons name="add" size={18} color={theme.colors.darkText} />
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          )}
        </View>

        {adding && (
          <View style={styles.formCard}>
            <Text style={styles.formLabel}>TITLE</Text>
            <TextInput
              style={styles.formInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Release title"
              placeholderTextColor={theme.colors.darkMuted}
              autoFocus
            />

            <Text style={[styles.formLabel, { marginTop: 14 }]}>TYPE</Text>
            <View style={styles.typeRow}>
              {(["single", "ep", "album"] as const).map((t) => (
                <Pressable
                  key={t}
                  style={[styles.typeChip, newType === t && styles.typeChipSelected]}
                  onPress={() => setNewType(t)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      newType === t && styles.typeChipTextSelected,
                    ]}
                  >
                    {TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.formLabel, { marginTop: 14 }]}>TRACKS</Text>
            <TextInput
              style={styles.formInput}
              value={newTracks}
              onChangeText={(t) => setNewTracks(t.replace(/[^0-9]/g, ""))}
              onBlur={() => setNewTracks(String(parseTrackCount(newTracks)))}
              placeholder="Number of tracks"
              placeholderTextColor={theme.colors.darkMuted}
              keyboardType="number-pad"
              maxLength={3}
            />

            <View style={styles.formActions}>
              <Pressable
                style={styles.formCancel}
                onPress={resetForm}
              >
                <Text style={styles.formCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.formSave,
                  (!newTitle.trim() || saving) && { opacity: 0.5 },
                ]}
                onPress={saveRelease}
                disabled={!newTitle.trim() || saving}
              >
                <Ionicons name="checkmark" size={16} color={theme.colors.darkText} />
                <Text style={styles.formSaveText}>
                  {saving ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {releases.length > 0 ? (
          releases.map((release) => (
            <View key={release.id} style={styles.releaseCard}>
              <View style={styles.releaseTop}>
                <View style={[styles.artPlaceholder, { borderColor: colorForType(release.release_type) }]}>
                  <Ionicons name="disc-outline" size={24} color={theme.colors.darkMuted} />
                </View>
                <View style={styles.releaseInfo}>
                  <Text style={styles.releaseTitle}>{release.title}</Text>
                  <View style={styles.releaseMeta}>
                    <View style={[styles.typeBadge, { backgroundColor: colorForType(release.release_type) }]}>
                      <Text style={styles.typeBadgeText}>
                        {TYPE_LABELS[release.release_type] ?? release.release_type}
                      </Text>
                    </View>
                    <Text style={styles.releaseDate}>
                      {formatDate(release.release_date)}
                    </Text>
                  </View>
                </View>
              </View>
              {release.track_count > 0 && (
                <Text style={styles.trackCount}>
                  {release.track_count} {release.track_count === 1 ? "track" : "tracks"}
                </Text>
              )}
            </View>
          ))
        ) : !loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="disc-outline" size={36} color={theme.colors.darkMuted} />
            <Text style={styles.emptyTitle}>No releases yet</Text>
            <Text style={styles.emptyText}>
              Add your singles, EPs, and albums to track how fans engage with your music.
            </Text>
            {!adding && (
              <Pressable
                style={styles.emptyAddBtn}
                onPress={() => setAdding(true)}
              >
                <Ionicons name="add" size={16} color={theme.colors.darkText} />
                <Text style={styles.emptyAddBtnText}>Add your first release</Text>
              </Pressable>
            )}
          </View>
        ) : null}
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
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  addBtnText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkText,
  },

  formCard: {
    backgroundColor: theme.colors.darkCard,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  formLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  formInput: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  typeChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: "rgba(230,139,133,0.15)",
  },
  typeChipText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
  },
  typeChipTextSelected: {
    color: theme.colors.primary,
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18,
  },
  formCancel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  formCancelText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
  },
  formSave: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  formSaveText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkText,
  },

  releaseCard: {
    backgroundColor: theme.colors.darkCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  releaseTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  artPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  releaseInfo: { flex: 1 },
  releaseTitle: {
    fontFamily: theme.fonts.sansBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
    marginBottom: 6,
  },
  releaseMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontFamily: theme.fonts.ui,
    fontSize: 9,
    color: "#fff",
    letterSpacing: 0.5,
  },
  releaseDate: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 0.3,
  },
  trackCount: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 0.3,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },

  emptyState: {
    alignItems: "center",
    gap: 10,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
  },
  emptyText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    marginTop: 4,
  },
  emptyAddBtnText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkText,
  },
});
