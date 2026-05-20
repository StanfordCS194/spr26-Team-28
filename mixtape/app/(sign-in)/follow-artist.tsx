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
import { useEffect, useState } from "react";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

interface Artist {
  id: string;
  name: string;
  username: string;
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

export default function FollowArtist() {
  const router = useRouter();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [filtered, setFiltered] = useState<Artist[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchArtists() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, username")
          .eq("role", "artist");
        if (error) {
          Alert.alert("Error", error.message);
          return;
        }
        setArtists(data ?? []);
        setFiltered(data ?? []);
      } finally {
        setLoading(false);
      }
    }
    fetchArtists();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(artists);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      artists.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.username.toLowerCase().includes(q),
      ),
    );
  }, [search, artists]);

  function selectArtist(artist: Artist) {
    router.push({
      pathname: "/(sign-in)/share-consent",
      params: {
        artistId: artist.id,
        artistName: artist.name,
        artistUsername: artist.username,
      },
    });
  }

  // Skip following an artist — go to tabs
  function skip() {
    router.replace("/(tabs)");
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topRow}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>
        <Pressable onPress={skip}>
          <Text style={styles.skipLabel}>SKIP</Text>
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Who do you want to{"\n"}share with?</Text>
        <Text style={styles.subtitle}>
          Pick one artist to start. You decide what they see on the next step.
        </Text>
      </View>

      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={16} color={theme.colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search artists on Mixtape..."
          placeholderTextColor={theme.colors.muted}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons
              name="close-circle"
              size={16}
              color={theme.colors.muted}
            />
          </Pressable>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Artists on Mixtape</Text>
        {loading && <Text style={styles.sectionMeta}>Loading...</Text>}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              {search ? "No artists found." : "No artists on Mixtape yet."}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <ArtistRow artist={item} onPress={() => selectArtist(item)} />
        )}
      />
    </SafeAreaView>
  );
}

function ArtistRow({
  artist,
  onPress,
}: {
  artist: Artist;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.artistRow} onPress={onPress}>
      <View
        style={[styles.avatar, { backgroundColor: colorFromId(artist.id) }]}
      />
      <View style={styles.artistInfo}>
        <Text style={styles.artistName}>{artist.name}</Text>
        <Text style={styles.artistUsername}>@{artist.username}</Text>
      </View>
      <Pressable style={styles.pickButton} onPress={onPress}>
        <Text style={styles.pickLabel}>Pick</Text>
        <Ionicons name="arrow-forward" size={14} color={theme.colors.text} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
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
  skipLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
    letterSpacing: 0.6,
  },
  header: { paddingHorizontal: 24, marginBottom: 16 },
  title: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.title,
    lineHeight: 34,
    color: theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    lineHeight: 22,
    color: theme.colors.muted,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 24,
    marginBottom: 20,
    backgroundColor: theme.colors.card,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
    padding: 0,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
  },
  sectionMeta: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
  },
  list: { paddingHorizontal: 24, paddingBottom: 24 },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 2,
  },
  empty: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.muted,
    textAlign: "center",
    marginTop: 40,
  },
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 14,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  artistInfo: { flex: 1, gap: 3 },
  artistName: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
  },
  artistUsername: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.3,
  },
  pickButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  pickLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.text,
  },
});
