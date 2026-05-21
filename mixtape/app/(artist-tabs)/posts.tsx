import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";
import { timeAgo } from "@/utils/timeAgo";

type Post = {
  id: string;
  artist_id: string;
  body: string;
  created_at: string;
  like_count: number;
};

export default function PostsTab() {
  const mounted = useRef(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !mounted.current) return;

      const { data, error } = await supabase
        .from("posts")
        .select("id, artist_id, body, created_at, like_count")
        .eq("artist_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      if (mounted.current) setPosts((data as Post[]) ?? []);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not load posts.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  async function submitPost() {
    const body = draft.trim();
    if (!body) return;

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("posts")
        .insert({ artist_id: user.id, body });

      if (error) {
        Alert.alert("Post failed", error.message);
        return;
      }

      setDraft("");
      setComposing(false);
      fetchPosts();
    } catch (e: any) {
      Alert.alert("Post failed", e?.message ?? "Network error");
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topLabel}>YOUR POSTS</Text>
          <Text style={styles.title}>Announcements</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons
            name="megaphone-outline"
            size={48}
            color={theme.colors.darkMuted}
          />
          <Text style={styles.emptyText}>
            No posts yet. Share an update with your fans.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {posts.map((post) => (
            <View key={post.id} style={styles.card}>
              <Text style={styles.postBody}>{post.body}</Text>
              <View style={styles.postFooter}>
                <Text style={styles.postTime}>
                  {timeAgo(post.created_at)}
                </Text>
                <View style={styles.likeRow}>
                  <Ionicons
                    name="heart-outline"
                    size={14}
                    color={theme.colors.darkMuted}
                  />
                  <Text style={styles.likeCount}>{post.like_count ?? 0}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Floating compose button */}
      <Pressable
        style={styles.fab}
        onPress={() => setComposing(true)}
        accessibilityLabel="Compose a new post"
      >
        <Ionicons name="add" size={28} color={theme.colors.darkText} />
      </Pressable>

      {/* Compose modal */}
      <Modal
        visible={composing}
        animationType="slide"
        transparent
        onRequestClose={() => setComposing(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => {
                  setComposing(false);
                  setDraft("");
                }}
                disabled={submitting}
              >
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>New Post</Text>
              <Pressable
                onPress={submitPost}
                disabled={submitting || !draft.trim()}
                style={[
                  styles.postBtn,
                  (!draft.trim() || submitting) && styles.postBtnDisabled,
                ]}
              >
                <Text style={styles.postBtnText}>
                  {submitting ? "Posting..." : "Post"}
                </Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.composeInput}
              placeholder="Share an update with your fans..."
              placeholderTextColor={theme.colors.darkMuted}
              value={draft}
              onChangeText={setDraft}
              multiline
              autoFocus
              textAlignVertical="top"
              editable={!submitting}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.darkBackground },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },

  topBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    marginBottom: 8,
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

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
    gap: 16,
  },
  emptyText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkMuted,
    textAlign: "center",
    lineHeight: 24,
  },

  card: {
    backgroundColor: theme.colors.darkCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  postBody: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
    lineHeight: 24,
  },
  postFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  postTime: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 0.5,
  },
  likeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  likeCount: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
  },

  fab: {
    position: "absolute",
    bottom: 100,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: theme.colors.darkBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 40,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
  },
  modalCancel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
  },
  postBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  postBtnDisabled: { opacity: 0.4 },
  postBtnText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkText,
  },
  composeInput: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
    lineHeight: 24,
    minHeight: 120,
  },
});
