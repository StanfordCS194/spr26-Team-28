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
import { useState } from "react";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

type Role = "fan" | "artist";

export default function SelectAccount() {
  const router = useRouter();
  const [selected, setSelected] = useState<Role>("fan");
  const [loading, setLoading] = useState(false);

  async function continueWithRole() {
    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert("Error", "Could not get user session.");
        return;
      }

      const username = user.email?.replace("@mixtape.com", "") ?? "";
      const name = user.user_metadata?.name ?? "";

      const { error: profileError } = await supabase
        .from("profiles")
        .insert({ id: user.id, name, username, role: selected });

      if (profileError) {
        Alert.alert("Error", profileError.message);
        return;
      }

      await supabase.auth.updateUser({ data: { role: selected } });

      router.push("/(sign-in)/connect-music");
    } catch (error: any) {
      Alert.alert("Network error", error.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Scrollable content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>How will you use Mixtape?</Text>
          <Text style={styles.subtitle}>
            Choose your role. This will determine how you experience Mixtape.
          </Text>
        </View>

        <View style={styles.cards}>
          <RoleCard
            role="fan"
            title="Fan"
            heading="I listen to indie music."
            description="Share your listening with the artists you love and see what your habits say about your taste."
            color={theme.colors.primary}
            titleColor={theme.colors.text}
            selected={selected === "fan"}
            onPress={() => setSelected("fan")}
          />
          <RoleCard
            role="artist"
            title="Artist"
            heading="I make music."
            description="See aggregated insights from fans who choose to share with you. You will never see anything they have not opted in to."
            color={theme.colors.secondary}
            titleColor="#FFFFFF"
            selected={selected === "artist"}
            onPress={() => setSelected("artist")}
          />
        </View>
      </ScrollView>

      {/* Button pinned to bottom */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && !loading && styles.buttonPressed,
            loading && styles.buttonDisabled,
          ]}
          onPress={continueWithRole}
          disabled={loading}
        >
          <Ionicons
            name={selected === "fan" ? "musical-notes-outline" : "mic-outline"}
            size={18}
            color={theme.colors.darkText}
          />
          <Text style={styles.buttonLabel}>
            {loading
              ? "Saving..."
              : `Continue as ${selected === "fan" ? "Fan" : "Artist"}`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function RoleCard({
  title,
  heading,
  description,
  color,
  titleColor,
  selected,
  onPress,
}: {
  role: Role;
  title: string;
  heading: string;
  description: string;
  color: string;
  titleColor: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
    >
      <View style={[styles.cardTop, { backgroundColor: color }]}>
        <Text style={[styles.cardTitle, { color: titleColor }]}>{title}</Text>
        <View
          style={[
            styles.circle,
            styles.circleOuter,
            { borderColor: "rgba(255,255,255,0.3)" },
          ]}
        />
        <View
          style={[
            styles.circle,
            styles.circleInner,
            { backgroundColor: "rgba(255,255,255,0.2)" },
          ]}
        />
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardHeading}>{heading}</Text>
        <Text style={styles.cardDescription}>{description}</Text>

        {selected && (
          <View style={styles.badge}>
            <Ionicons name="checkmark" size={11} color="#FFFFFF" />
            <Text style={styles.badgeLabel}>SELECTED</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  header: {
    marginTop: 10,
    marginBottom: 28,
  },
  title: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.title,
    lineHeight: 34,
    color: theme.colors.text,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    lineHeight: 26,
    color: theme.colors.muted,
  },
  cards: {
    gap: 20,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  cardSelected: {
    borderColor: theme.colors.text,
  },
  cardTop: {
    height: 100,
    paddingHorizontal: 20,
    paddingTop: 18,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  cardTitle: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.title,
    zIndex: 1,
  },
  circle: {
    position: "absolute",
    borderRadius: 999,
  },
  circleOuter: {
    width: 100,
    height: 100,
    borderWidth: 30,
    right: -20,
    top: -20,
  },
  circleInner: {
    width: 60,
    height: 60,
    right: 40,
    top: 10,
  },
  cardBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.colors.card,
    gap: 6,
  },
  cardHeading: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
  },
  cardDescription: {
    fontFamily: theme.fonts.uiRegular,
    fontSize: theme.fontSizes.small,
    lineHeight: 22,
    color: theme.colors.muted,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.white,
    letterSpacing: 0.6,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: theme.colors.background,
  },
  button: {
    width: "100%",
    height: 55,
    backgroundColor: theme.colors.primary,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  buttonPressed: {
    backgroundColor: theme.colors.text,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.button,
    color: theme.colors.darkText,
  },
});
