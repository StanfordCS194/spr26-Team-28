// Expandable comment section for a post, with an inline input to add comments.

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import theme from "@/assets/theme";
import { supabase } from "@/database/db";
import { timeAgo } from "@/utils/timeAgo";
import { addComment, getComments, Comment } from "@/utils/postActions";

// Deterministic colour from a string, matching the palette used elsewhere.
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

interface CommentSectionProps {
  postId: string;
  dark: boolean;
  visible: boolean;
}

export default function CommentSection({
  postId,
  dark,
  visible,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const colors = {
    bg: dark ? theme.colors.darkCard : theme.colors.card,
    text: dark ? theme.colors.darkText : theme.colors.text,
    muted: dark ? theme.colors.darkMuted : theme.colors.muted,
    border: dark ? "rgba(255,255,255,0.08)" : theme.colors.border,
    inputBg: dark ? "rgba(255,255,255,0.06)" : "#FFFFFF",
  };

  // Fetch comments when the section becomes visible.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const data = await getComments(postId);
      if (!cancelled) {
        setComments(data);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [visible, postId]);

  async function handleSend() {
    const body = text.trim();
    if (!body || sending) return;

    setSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await addComment(postId, user.id, body);
      setText("");

      // Refresh the comment list after posting.
      const updated = await getComments(postId);
      setComments(updated);
    } finally {
      setSending(false);
    }
  }

  if (!visible) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={colors.muted}
          style={styles.loader}
        />
      ) : comments.length === 0 ? (
        <Text style={[styles.empty, { color: colors.muted }]}>
          No comments yet. Be the first.
        </Text>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.commentRow}>
              <View
                style={[
                  styles.commentAvatar,
                  { backgroundColor: colorFromName(item.commenter_name) },
                ]}
              >
                <Text style={styles.commentAvatarText}>
                  {item.commenter_initials}
                </Text>
              </View>
              <View style={styles.commentContent}>
                <View style={styles.commentHeader}>
                  <Text style={[styles.commentName, { color: colors.text }]}>
                    {item.commenter_name}
                  </Text>
                  <Text
                    style={[styles.commentTimestamp, { color: colors.muted }]}
                  >
                    {timeAgo(item.created_at)}
                  </Text>
                </View>
                <Text style={[styles.commentBody, { color: colors.text }]}>
                  {item.body}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.inputBg,
            },
          ]}
          placeholder="Add a comment..."
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <Pressable
          style={[styles.sendButton, !text.trim() && styles.sendDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          <Ionicons
            name="arrow-up-circle"
            size={32}
            color={text.trim() ? theme.colors.primary : colors.muted}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  loader: {
    paddingVertical: 16,
  },
  empty: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    textAlign: "center",
    paddingVertical: 12,
  },

  // Individual comment
  commentRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: {
    fontFamily: theme.fonts.ui,
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  commentName: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.small,
  },
  commentTimestamp: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
  },
  commentBody: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    lineHeight: 20,
  },

  // Input area
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
  },
  sendButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: {
    opacity: 0.5,
  },
});
