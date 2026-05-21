import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, useRef, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

interface Message {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

// Hash a userId into a stable 4-digit anonymous number.
function anonNumber(userId: string): string {
  const num =
    (userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      9000) +
    1000;
  return String(num);
}

// Format a timestamp for display inside the chat thread.
function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

export default function ArtistChatScreen() {
  const { fanId } = useLocalSearchParams<{ fanId: string }>();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [userId, setUserId] = useState("");
  const [fanLabel, setFanLabel] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Load fan label, conversation, and messages.
  const loadChat = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Build the anonymous fan label.
      setFanLabel(`Anonymous Fan #${anonNumber(fanId!)}`);

      // Find existing conversation between this artist and fan.
      const { data: convo } = await supabase
        .from("conversations")
        .select("id")
        .eq("artist_id", user.id)
        .eq("fan_id", fanId)
        .single();

      if (convo) {
        setConversationId(convo.id);
        await fetchMessages(convo.id, user.id);
      }
    } catch {
      // Conversation may not exist yet.
    }
  }, [fanId]);

  // Fetch all messages in a conversation and mark received ones as read.
  async function fetchMessages(convoId: string, currentUserId: string) {
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true });

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    setMessages((data as Message[]) ?? []);

    // Mark unread messages from the fan as read.
    await supabase
      .from("messages")
      .update({ read: true })
      .eq("conversation_id", convoId)
      .neq("sender_id", currentUserId)
      .eq("read", false);
  }

  useFocusEffect(
    useCallback(() => {
      loadChat();
    }, [loadChat]),
  );

  // Subscribe to new messages in real time.
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);

          // Mark as read if the artist received it.
          if (newMsg.sender_id !== userId) {
            supabase
              .from("messages")
              .update({ read: true })
              .eq("id", newMsg.id);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  // Send a message from the artist.
  async function handleSend() {
    const text = inputText.trim();
    if (!text || !userId) return;

    let convoId = conversationId;

    // Create conversation if it does not exist yet.
    if (!convoId) {
      const { data: newConvo, error: convoError } = await supabase
        .from("conversations")
        .insert({ fan_id: fanId, artist_id: userId })
        .select("id")
        .single();

      if (convoError || !newConvo) {
        Alert.alert("Error", "Could not start conversation.");
        return;
      }
      convoId = newConvo.id;
      setConversationId(convoId);
    }

    const { error } = await supabase.from("messages").insert({
      conversation_id: convoId,
      sender_id: userId,
      body: text,
    });

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    setInputText("");
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === userId;
    return (
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleSent : styles.bubbleReceived,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            isMine ? styles.bubbleTextSent : styles.bubbleTextReceived,
          ]}
        >
          {item.body}
        </Text>
        <Text
          style={[
            styles.bubbleTime,
            isMine ? styles.bubbleTimeSent : styles.bubbleTimeReceived,
          ]}
        >
          {formatMessageTime(item.created_at)}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons
            name="chevron-back"
            size={24}
            color={theme.colors.darkText}
          />
        </Pressable>
        <Text style={styles.headerName} numberOfLines={1}>
          {fanLabel}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          onLayout={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Message..."
            placeholderTextColor={theme.colors.darkMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              pressed && styles.sendButtonPressed,
            ]}
            onPress={handleSend}
          >
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.darkBackground,
  },
  flex: {
    flex: 1,
  },

  // Header
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: {
    flex: 1,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
    textAlign: "center",
  },
  headerSpacer: {
    width: 36,
  },

  // Messages
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "75%",
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
  },
  bubbleSent: {
    backgroundColor: theme.colors.primary,
    alignSelf: "flex-end",
  },
  bubbleReceived: {
    backgroundColor: theme.colors.darkCard,
    alignSelf: "flex-start",
  },
  bubbleText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
  },
  bubbleTextSent: {
    color: "#FFFFFF",
  },
  bubbleTextReceived: {
    color: theme.colors.darkText,
  },
  bubbleTime: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    marginTop: 4,
  },
  bubbleTimeSent: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "right",
  },
  bubbleTimeReceived: {
    color: theme.colors.darkMuted,
  },

  // Input bar
  inputBar: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
  },
  textInput: {
    flex: 1,
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.darkCard,
    borderRadius: 20,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonPressed: {
    opacity: 0.7,
  },
});
