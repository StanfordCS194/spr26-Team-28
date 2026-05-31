/*
 * favorite-song.tsx
 *
 * Asks the fan for their favourite song by the artist they just picked.
 * Sits between follow-artist and share-consent in the onboarding flow.
 *
 * Receives: artistId, artistName, artistUsername
 * Passes:   all of the above + topTrack → share-consent
 */

import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

import theme from "@/assets/theme";

export default function FavoriteSong() {
  const router = useRouter();
  const { artistId, artistName, artistUsername } = useLocalSearchParams<{
    artistId: string;
    artistName: string;
    artistUsername: string;
  }>();

  const [song, setSong] = useState("");
  const [focused, setFocused] = useState(false);

  const firstName = artistName?.split(" ")[0] ?? "this artist";

  function handleContinue() {
    router.push({
      pathname: "/(sign-in)/share-consent",
      params: {
        artistId,
        artistName,
        artistUsername,
        topTrack: song.trim(),
      },
    });
  }

  function skip() {
    router.push({
      pathname: "/(sign-in)/share-consent",
      params: {
        artistId,
        artistName,
        artistUsername,
        topTrack: "",
      },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top row */}
          <View style={styles.topRow}>
            <Pressable style={styles.back} onPress={() => router.back()}>
              <Ionicons
                name="chevron-back"
                size={20}
                color={theme.colors.text}
              />
            </Pressable>
            <Pressable onPress={skip}>
              <Text style={styles.skipLabel}>SKIP</Text>
            </Pressable>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              What's your favorite song by {firstName}?
            </Text>
            <Text style={styles.subtitle}>
              This helps {firstName} understand which tracks mean the most to
              their fans.
            </Text>
          </View>

          {/* Input */}
          <View
            style={[
              styles.inputWrapper,
              focused && styles.inputWrapperFocused,
            ]}
          >
            <Text style={styles.inputLabel}>SONG TITLE</Text>
            <TextInput
              style={styles.input}
              value={song}
              onChangeText={setSong}
              placeholder={`A song by ${firstName}…`}
              placeholderTextColor={theme.colors.muted}
              autoCorrect={false}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              returnKeyType="done"
            />
          </View>

          <View style={styles.spacer} />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable
            style={[styles.button, !song.trim() && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!song.trim()}
          >
            <Text style={styles.buttonLabel}>Continue</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
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
  header: { marginTop: 10, marginBottom: 36 },
  title: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.title,
    lineHeight: 38,
    color: theme.colors.text,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    lineHeight: 26,
    color: theme.colors.muted,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.border.button,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: theme.colors.background,
  },
  inputWrapperFocused: { borderColor: theme.colors.text },
  inputLabel: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  input: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.subtitle,
    color: theme.colors.text,
    padding: 0,
  },
  spacer: { flex: 1, minHeight: 40 },
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
  },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.button,
    color: theme.colors.darkText,
  },
});
