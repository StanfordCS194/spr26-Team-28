import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

interface Artist {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  genre: string | null;
  city: string | null;
  country: string | null;
}

function colorFromId(id: string): string {
  const colors = ["#e68b85", "#4281A4", "#2C6E91", "#C4A882", "#3D4F6B", "#7B9E87", "#9B7FA6"];
  const index = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

export default function ForYouTab() {
  const router = useRouter();
  const mounted = useRef(true);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted.current) return;

      // Fetch all artists on the platform.
      const { data: artistData, error: artistError } = await supabase
        .from("profiles")
        .select("id, name, username, bio, genre, city, country")
        .eq("role", "artist")
        .order("name");

      if (artistError) {
        Alert.alert("Error", artistError.message);
        return;
      }
      if (mounted.current) setArtists((artistData as Artist[]) ?? []);

      // Fetch which artists this fan already follows.
      const { data: followData } = await supabase
        .from("fan_follows")
        .select("artist_id")
        .eq("fan_id", user.id)
        .not("consented_at", "is", null);

      if (followData && mounted.current) {
        setFollowedIds(new Set(followData.map((f: any) => f.artist_id)));
      }
    } catch (e: any) {
      if (mounted.current) Alert.alert("Error", e?.message ?? "Could not load artists.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? artists.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.username.toLowerCase().includes(q) ||
          (a.genre ?? "").toLowerCase().includes(q)
      )
    : artists;

  // Show artists the fan is not yet following first, then already-followed ones.
  const sorted = [...filtered].sort((a, b) => {
    const aFollowed = followedIds.has(a.id) ? 1 : 0;
    const bFollowed = followedIds.has(b.id) ? 1 : 0;
    return aFollowed - bFollowed;
  });

  function handleArtistPress(artist: Artist) {
    if (followedIds.has(artist.id)) return;
    router.push({
      pathname: "/(sign-in)/share-consent",
      params: { artistId: artist.id, artistName: artist.name },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.topLabel}>FOR YOU</Text>
        <Text style={styles.heading}>Discover artists</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={theme.colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, username, or genre"
          placeholderTextColor={theme.colors.muted}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={16} color={theme.colors.muted} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={32} color={theme.colors.muted} />
            <Text style={styles.emptyText}>
              {loading ? "Loading artists..." : "No artists found."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isFollowed = followedIds.has(item.id);
          const location = [item.city, item.country].filter(Boolean).join(", ");
          const genres = item.genre
            ? item.genre.split(",").map((g) => g.trim()).filter(Boolean).slice(0, 2)
            : [];

          return (
            <Pressable
              style={({ pressed }) => [
                styles.artistCard,
                pressed && !isFollowed && styles.artistCardPressed,
              ]}
              onPress={() => handleArtistPress(item)}
            >
              <View style={styles.artistTop}>
                <View style={[styles.artistAvatar, { backgroundColor: colorFromId(item.id) }]}>
                  <Text style={styles.artistInitial}>
                    {item.name[0]?.toUpperCase() ?? "?"}
                  </Text>
                </View>
                <View style={styles.artistInfo}>
                  <Text style={styles.artistName}>{item.name}</Text>
                  <Text style={styles.artistUsername}>@{item.username}</Text>
                </View>
                {isFollowed ? (
                  <View style={styles.followingBadge}>
                    <Ionicons name="checkmark" size={11} color={theme.colors.success} />
                    <Text style={styles.followingText}>Sharing</Text>
                  </View>
                ) : (
                  <View style={styles.shareBadge}>
                    <Text style={styles.shareText}>Share</Text>
                  </View>
                )}
              </View>

              {item.bio && (
                <Text style={styles.artistBio} numberOfLines={2}>
                  {item.bio}
                </Text>
              )}

              {(genres.length > 0 || location) && (
                <View style={styles.metaRow}>
                  {genres.map((g) => (
                    <View key={g} style={styles.genreTag}>
                      <Text style={styles.genreTagText}>{g}</Text>
                    </View>
                  ))}
                  {location ? (
                    <View style={styles.locationTag}>
                      <Ionicons name="location-outline" size={10} color={theme.colors.muted} />
                      <Text style={styles.locationTagText}>{location}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 24, paddingTop: 12 },
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
    marginBottom: 16,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 24,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.card,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
    padding: 0,
  },

  listContent: { paddingHorizontal: 24, paddingBottom: 40 },

  artistCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  artistCardPressed: { borderColor: theme.colors.text },
  artistTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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

  followingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(66,129,164,0.12)",
  },
  followingText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.success,
    letterSpacing: 0.3,
  },
  shareBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  shareText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: "#fff",
    letterSpacing: 0.3,
  },

  artistBio: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    lineHeight: 20,
    color: theme.colors.muted,
    marginTop: 12,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  genreTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,26,43,0.06)",
  },
  genreTagText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.3,
  },
  locationTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,26,43,0.06)",
  },
  locationTagText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.3,
  },

  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingTop: 60,
  },
  emptyText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.muted,
  },
});
