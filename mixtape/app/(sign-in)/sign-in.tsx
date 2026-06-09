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

// Map Supabase auth error messages to user-friendly text.
function friendlyError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Wrong email or password. Please try again.";
  }
  if (lower.includes("email not confirmed")) {
    return "Your account has not been confirmed yet.";
  }
  if (lower.includes("user not found")) {
    return "Account not found. Check your email or create a new account.";
  }
  if (lower.includes("too many requests") || lower.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return message;
}

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Track whether the user has attempted to submit at least once,
  // so we only show validation errors after the first try.
  const [hasAttempted, setHasAttempted] = useState(false);

  const emailEmpty = email.trim().length === 0;
  const passwordTooShort = password.length > 0 && password.length < 6;
  const passwordEmpty = password.length === 0;

  const isDisabled = loading || emailEmpty || passwordEmpty;

  async function signIn() {
    setHasAttempted(true);

    if (emailEmpty || passwordEmpty) {
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        Alert.alert("Sign in failed", friendlyError(error.message));
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
            <View>
              <View
                style={[
                  styles.inputWrapper,
                  emailFocused && styles.inputWrapperFocused,
                  hasAttempted && emailEmpty && styles.inputWrapperError,
                ]}
              >
                <Text style={styles.inputLabel}>EMAIL</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder=""
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
              {hasAttempted && emailEmpty && (
                <Text style={styles.errorText}>Email is required.</Text>
              )}
            </View>

            <View>
              <View
                style={[
                  styles.inputWrapper,
                  passwordFocused && styles.inputWrapperFocused,
                  hasAttempted && passwordEmpty && styles.inputWrapperError,
                ]}
              >
                <Text style={styles.inputLabel}>PASSWORD</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    placeholder=""
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={theme.colors.muted}
                    />
                  </Pressable>
                </View>
              </View>
              {hasAttempted && passwordEmpty && (
                <Text style={styles.errorText}>Password is required.</Text>
              )}
              {hasAttempted && passwordTooShort && (
                <Text style={styles.errorText}>
                  Password must be at least 6 characters.
                </Text>
              )}
            </View>
          </View>

          <Pressable
            style={styles.forgotLink}
            onPress={() => router.push("/(sign-in)/forgot-password")}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

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
  inputWrapperError: { borderColor: theme.colors.danger },
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
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
  },
  errorText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.danger,
    marginTop: 6,
    marginLeft: 16,
  },
  forgotLink: {
    alignSelf: "center",
    marginTop: 20,
  },
  forgotText: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: theme.fontSizes.body,
    color: theme.colors.secondary,
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
