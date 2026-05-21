// Artist notifications screen (dark theme).

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

// Map artist notification type to an Ionicons icon name.
function iconForType(type: string): string {
  switch (type) {
    case "new_fan":
      return "person-add-outline";
    case "fan_milestone":
      return "trophy-outline";
    case "engagement":
      return "heart-outline";
    default:
      return "notifications-outline";
  }
}

// Return a human-readable relative timestamp string.
function relativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
}

export default function ArtistNotificationsTab() {
  const mounted = useRef(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !mounted.current) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      if (mounted.current) setNotifications((data as Notification[]) ?? []);
    } catch (e: any) {
      if (mounted.current)
        Alert.alert("Error", e?.message ?? "Could not load notifications.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  // Mark a single notification as read.
  const markAsRead = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    },
    []
  );

  // Mark all notifications as read.
  async function markAllAsRead() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const hasUnread = notifications.some((n) => !n.read);

  function renderNotification({ item }: { item: Notification }) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.notificationCard,
          !item.read && styles.notificationCardUnread,
          pressed && styles.notificationCardPressed,
        ]}
        onPress={() => {
          if (!item.read) markAsRead(item.id);
        }}
      >
        <View style={styles.notificationRow}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={iconForType(item.type) as any}
              size={20}
              color={item.read ? theme.colors.darkMuted : theme.colors.primary}
            />
          </View>

          <View style={styles.notificationContent}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.notificationTitle,
                  !item.read && styles.notificationTitleUnread,
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.notificationBody} numberOfLines={2}>
              {item.body}
            </Text>
            <Text style={styles.notificationTime}>
              {relativeTime(item.created_at)}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.topLabel}>NOTIFICATIONS</Text>
          <Text style={styles.heading}>Alerts</Text>
        </View>
        {hasUnread && (
          <Pressable style={styles.markAllButton} onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="notifications-off-outline"
              size={32}
              color={theme.colors.darkMuted}
            />
            <Text style={styles.emptyText}>
              {loading
                ? "Loading notifications..."
                : "You're all caught up. No new notifications."}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.darkBackground },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  heading: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: 28,
    lineHeight: 36,
    color: theme.colors.darkText,
  },
  markAllButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  markAllText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: "#fff",
    letterSpacing: 0.3,
  },
  listContent: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8 },
  notificationCard: {
    backgroundColor: theme.colors.darkCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  notificationCardUnread: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  notificationCardPressed: {
    opacity: 0.85,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  notificationTitle: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
    flex: 1,
  },
  notificationTitleUnread: {
    fontFamily: theme.fonts.sansBold,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  notificationBody: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
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
    color: theme.colors.darkMuted,
    textAlign: "center",
  },
});
