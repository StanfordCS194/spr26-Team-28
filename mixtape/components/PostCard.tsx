// Reusable post card with like and comment controls.

import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import theme from "@/assets/theme";
import { timeAgo } from "@/utils/timeAgo";

export interface PostData {
  id: string;
  body: string;
  created_at: string;
  artist_name: string;
  artist_initials: string;
}

interface PostCardProps {
  post: PostData;
  dark: boolean;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  onLike: () => void;
  onComment: () => void;
}

// Deterministic colour from a string id, matching the palette used elsewhere.
function colorFromName(name: string): string {
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
    name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

export default function PostCard({
  post,
  dark,
  liked,
  likeCount,
  commentCount,
  onLike,
  onComment,
}: PostCardProps) {
  const colors = {
    bg: dark ? theme.colors.darkCard : theme.colors.card,
    text: dark ? theme.colors.darkText : theme.colors.text,
    muted: dark ? theme.colors.darkMuted : theme.colors.muted,
    border: dark ? "rgba(255,255,255,0.08)" : theme.colors.border,
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Header: avatar, name, timestamp */}
      <View style={styles.header}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: colorFromName(post.artist_name) },
          ]}
        >
          <Text style={styles.avatarText}>{post.artist_initials}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: colors.text }]}>
            {post.artist_name}
          </Text>
          <Text style={[styles.timestamp, { color: colors.muted }]}>
            {timeAgo(post.created_at)}
          </Text>
        </View>
      </View>

      {/* Post body */}
      <Text style={[styles.body, { color: colors.text }]}>{post.body}</Text>

      {/* Actions row */}
      <View style={styles.actions}>
        <Pressable style={styles.actionButton} onPress={onLike}>
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={20}
            color={liked ? theme.colors.primary : colors.muted}
          />
          {likeCount > 0 && (
            <Text
              style={[
                styles.actionCount,
                { color: liked ? theme.colors.primary : colors.muted },
              ]}
            >
              {likeCount}
            </Text>
          )}
        </Pressable>

        <Pressable style={styles.actionButton} onPress={onComment}>
          <Ionicons
            name="chatbubble-outline"
            size={18}
            color={colors.muted}
          />
          {commentCount > 0 && (
            <Text style={[styles.actionCount, { color: colors.muted }]}>
              {commentCount}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  headerText: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
  },
  timestamp: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
  },
  body: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    lineHeight: 24,
    marginBottom: 14,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionCount: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
  },
});
