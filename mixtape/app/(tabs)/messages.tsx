import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

// Conversation row with artist info and last message preview.
interface ConversationRow {
  id: string;
  artist_id: string;
  artist_name: string;
  last_message: string;
  last_message_at: string;
  unread: boolean;
}

// Return initials from a display name, e.g. "Jane Doe" -> "JD".
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Deterministic color from a user id string.
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

// Format a timestamp into a short label such as "2m", "3h", "Mon", or "Jan 5".
function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[date.getDay()];
  }
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

export default function FanMessagesScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch conversations for this fan, joined with artist profile name.
      const { data: convos, error } = await supabase
        .from("conversations")
        .select("id, artist_id, created_at, profiles:artist_id(name)")
        .eq("fan_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      if (!convos || convos.length === 0) {
        setConversations([]);
        return;
      }

      // For each conversation, fetch the most recent message.
      const rows: ConversationRow[] = [];
      for (const convo of convos as any[]) {
        const { data: msgs } = await supabase
          .from("messages")
          .select("body, created_at, read, sender_id")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: false })
          .limit(1);

        const lastMsg = msgs && msgs.length > 0 ? msgs[0] : null;

        // A message is unread if it exists, was not sent by the fan, and is not read.
        const unread =
          lastMsg !== null &&
          lastMsg.sender_id !== user.id &&
          lastMsg.read === false;

        rows.push({
          id: convo.id,
          artist_id: convo.artist_id,
          artist_name: convo.profiles?.name ?? "Unknown Artist",
          last_message: lastMsg?.body ?? "",
          last_message_at: lastMsg?.created_at ?? convo.created_at,
          unread,
        });
      }

      // Sort by most recent message.
      rows.sort(
        (a, b) =>
          new Date(b.last_message_at).getTime() -
          new Date(a.last_message_at).getTime(),
      );
      setConversations(rows);
    } catch {
      Alert.alert("Error", "Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh conversations each time the screen comes into focus.
  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations]),
  );

  const renderItem = ({ item }: { item: ConversationRow }) => (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() =>
        router.push({
          pathname: "/(tabs)/chat/[artistId]",
          params: { artistId: item.artist_id },
        })
      }
    >
      <View
        style={[styles.avatar, { backgroundColor: colorFromId(item.artist_id) }]}
      >
        <Text style={styles.avatarText}>{getInitials(item.artist_name)}</Text>
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text
            style={[styles.artistName, item.unread && styles.artistNameUnread]}
            numberOfLines={1}
          >
            {item.artist_name}
          </Text>
          <Text style={styles.timestamp}>{formatTime(item.last_message_at)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.preview, item.unread && styles.previewUnread]}
            numberOfLines={1}
          >
            {item.last_message || "No messages yet"}
          </Text>
          {item.unread && <View style={styles.unreadDot} />}
        </View>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>MESSAGES</Text>
      {conversations.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No messages yet. Artists you share with can reach out to you here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  listContent: {
    paddingBottom: 40,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 14,
  },
  rowPressed: {
    backgroundColor: theme.colors.card,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  rowContent: {
    flex: 1,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  artistName: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
    flex: 1,
    marginRight: 8,
  },
  artistNameUnread: {
    fontFamily: theme.fonts.sansBold,
  },
  timestamp: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  preview: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
    flex: 1,
  },
  previewUnread: {
    fontFamily: theme.fonts.sansSemiBold,
    color: theme.colors.text,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 48,
  },
  emptyText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.muted,
    textAlign: "center",
    lineHeight: 24,
  },
});
