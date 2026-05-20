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
import { useEffect, useState } from "react";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

interface Follow {
  artist_id: string;
  consented_at: string;
  profiles: {
    name: string;
    username: string;
  };
}

function anonNumber(userId: string): string {
  const num =
    (userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      9000) +
    1000;
  return String(num);
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

export default function HomeTab() {
  const router = useRouter();
  const [follows, setFollows] = useState<Follow[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        const { data, error } = await supabase
          .from("fan_follows")
          .select("artist_id, consented_at, profiles:artist_id(name, username)")
          .eq("fan_id", user.id)
          .not("consented_at", "is", null);

        if (error) {
          Alert.alert("Error", error.message);
          return;
        }
        setFollows((data as any) ?? []);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.wordmark}>mixtape</Text>
          <View style={styles.avatar} />
        </View>

        {/* You're in label */}
        <Text style={styles.youreIn}>YOU'RE IN</Text>

        {/* Heading */}
        <Text style={styles.heading}>
          {loading
            ? "Loading..."
            : follows.length === 0
              ? "You're not sharing yet."
              : `You're sharing\nwith ${follows.length} ${follows.length === 1 ? "artist" : "artists"}.`}
        </Text>

        {/* Artist cards */}
        {follows.map((follow) => (
          <View key={follow.artist_id} style={styles.artistCard}>
            <View style={styles.artistCardTop}>
              <View
                style={[
                  styles.artistAvatar,
                  { backgroundColor: colorFromId(follow.artist_id) },
                ]}
              />
              <View>
                <Text style={styles.artistName}>
                  {(follow.profiles as any)?.name}
                </Text>
                <Text style={styles.artistAnon}>
                  SHARING AS ANONYMOUS FAN #{anonNumber(userId)}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.revokeText}>
              You can pause or revoke this any time from{" "}
              <Text style={styles.revokeLink}>Sharing</Text>.
            </Text>
          </View>
        ))}

        {/* Actions */}
        <Pressable
          style={({ pressed }) => [
            styles.buttonDark,
            pressed && styles.buttonDarkPressed,
          ]}
          onPress={() => router.push("/(sign-in)/follow-artist")}
        >
          <Ionicons name="add" size={18} color={theme.colors.darkText} />
          <Text style={styles.buttonDarkLabel}>Share with another artist</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.buttonOutline,
            pressed && styles.buttonOutlinePressed,
          ]}
        >
          <Text style={styles.buttonOutlineLabel}>Explore your listening</Text>
        </Pressable>

        {/* What's next */}
        {follows.length > 0 && (
          <View style={styles.whatsNext}>
            <Text style={styles.whatsNextLabel}>WHAT'S NEXT</Text>
            <Text style={styles.whatsNextText}>
              {"We'll quietly compile what "}
              {(follows[0]?.profiles as any)?.name?.split(" ")[0]}
              {" sees. When they log in, they'll see "}
              <Text style={styles.whatsNextBold}>aggregated</Text>
              {" patterns from everyone who shared — not your individual data."}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  wordmark: {
    fontFamily: theme.fonts.sansItalic,
    fontSize: theme.fontSizes.subtitle,
    color: theme.colors.text,
  },
  dot: { color: theme.colors.primary },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.border,
  },

  // Heading
  youreIn: {
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
    marginBottom: 24,
  },

  // Artist card
  artistCard: {
    backgroundColor: theme.colors.secondary,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  artistCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  artistAvatar: { width: 44, height: 44, borderRadius: 22 },
  artistName: {
    fontFamily: theme.fonts.sansBold,
    fontSize: theme.fontSizes.body,
    color: "#FFFFFF",
    marginBottom: 3,
  },
  artistAnon: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.4,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 14,
    borderStyle: "dashed",
  },
  revokeText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    lineHeight: 20,
    color: "rgba(255,255,255,0.8)",
  },
  revokeLink: {
    fontFamily: theme.fonts.sansSemiBold,
    color: "#FFFFFF",
  },

  // Buttons
  buttonDark: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 55,
    backgroundColor: theme.colors.text,
    borderRadius: 40,
    marginBottom: 12,
  },
  buttonDarkPressed: { backgroundColor: theme.colors.primary },
  buttonDarkLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.button,
    color: theme.colors.darkText,
  },
  buttonOutline: {
    height: 55,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginBottom: 32,
  },
  buttonOutlinePressed: { borderColor: theme.colors.text },
  buttonOutlineLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.button,
    color: theme.colors.text,
  },

  // What's next
  whatsNext: {
    gap: 8,
  },
  whatsNextLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 1,
  },
  whatsNextText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    lineHeight: 24,
    color: theme.colors.muted,
  },
  whatsNextBold: {
    fontFamily: theme.fonts.sansBold,
    color: theme.colors.text,
  },
});
