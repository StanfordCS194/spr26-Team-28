import {
  Alert,
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

import { supabase } from "@/database/db";
import { navigateByRole } from "@/utils/navigateByRole";
import theme from "@/assets/theme";

export default function SignIn() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const isDisabled =
    loading || username.trim().length === 0 || password.length === 0;

  async function signIn() {
    const trimmedUsername = username.trim().toLowerCase();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: `${trimmedUsername}@mixtape.com`,
        password,
      });

      if (error) {
        Alert.alert("Sign in failed", error.message);
        return;
      }

      await navigateByRole(router);
    } catch (error: any) {
      Alert.alert("Network error", error.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
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
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>Welcome back.</Text>
            <Text style={styles.subtitle}>
              Sign in to your Mixtape account.
            </Text>
          </View>

          <View style={styles.fields}>
            <View
              style={[
                styles.inputWrapper,
                usernameFocused && styles.inputWrapperFocused,
              ]}
            >
              <Text style={styles.inputLabel}>USERNAME</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder=""
                onFocus={() => setUsernameFocused(true)}
                onBlur={() => setUsernameFocused(false)}
              />
            </View>

            <View
              style={[
                styles.inputWrapper,
                passwordFocused && styles.inputWrapperFocused,
              ]}
            >
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder=""
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
            </View>
          </View>

          <View style={styles.spacer} />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && !isDisabled && styles.buttonPressed,
              isDisabled && styles.buttonDisabled,
            ]}
            onPress={signIn}
            disabled={isDisabled}
          >
            <Ionicons
              name="log-in-outline"
              size={18}
              color={theme.colors.darkText}
            />
            <Text style={styles.buttonLabel}>
              {loading ? "Signing in..." : "Sign in"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  header: { marginTop: 10, marginBottom: 32 },
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
  fields: { gap: 30 },
  spacer: { flex: 1, minHeight: 40 },
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
  buttonPressed: { backgroundColor: theme.colors.text },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.button,
    color: theme.colors.darkText,
  },
});
