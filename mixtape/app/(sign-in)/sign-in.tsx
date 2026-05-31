/*
 * Sign-in screen.
 *
 * Handles username/password authentication, basic validation, and redirects
 * users to the correct Fan or Artist experience after sign-in.
 *
 * TODO: Replace the temporary username-to-dummy-email auth flow with real
 * user emails once email validation and Forgot Password are fully supported.
 */

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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";

import { supabase } from "@/database/db";
import { navigateByRole } from "@/utils/navigateByRole";
import theme from "@/assets/theme";
import { friendlyAuthError } from "@/utils/friendlyAuthError";

export default function SignIn() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  /*
   * Track whether the user has attempted to submit at least once,
   * so we only show validation errors after the first try.
   */
  const [hasAttempted, setHasAttempted] = useState(false);

  const usernameEmpty = username.trim().length === 0;
  const passwordEmpty = password.length === 0;
  const passwordTooShort = password.length > 0 && password.length < 6;
  const isDisabled = loading || usernameEmpty || passwordEmpty;

  // Helper function to validate credentials, sign in with Supabase, and route by user role.
  async function signIn() {
    setHasAttempted(true);
    if (usernameEmpty || passwordEmpty) return;
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: `${username.trim().toLowerCase()}@mixtape.com`,
        password,
      });

      if (error) {
        Alert.alert("Sign in failed", friendlyAuthError(error.message));
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
            {/* Username */}
            <View>
              <View
                style={[
                  styles.inputWrapper,
                  usernameFocused && styles.inputWrapperFocused,
                  hasAttempted && usernameEmpty && styles.inputWrapperError,
                ]}
              >
                <Text style={styles.inputLabel}>USERNAME</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setUsernameFocused(true)}
                  onBlur={() => setUsernameFocused(false)}
                />
              </View>
              {hasAttempted && usernameEmpty && (
                <Text style={styles.errorText}>Username is required.</Text>
              )}
            </View>

            {/* Password */}
            <View>
              <View
                style={[
                  styles.inputWrapper,
                  styles.passwordWrapper,
                  passwordFocused && styles.inputWrapperFocused,
                  hasAttempted && passwordEmpty && styles.inputWrapperError,
                ]}
              >
                <Text style={styles.inputLabel}>PASSWORD</Text>

                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />

                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((s) => !s)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={25}
                    color={theme.colors.muted}
                  />
                </Pressable>
              </View>
              {hasAttempted && passwordEmpty && (
                <Text style={styles.errorText}>Password is required.</Text>
              )}
              {passwordTooShort && (
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
  passwordWrapper: {
    position: "relative",
    paddingRight: 48,
  },
  input: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.subtitle,
    color: theme.colors.text,
    padding: 0,
  },
  passwordInput: {
    paddingRight: 8,
  },
  eyeButton: {
    position: "absolute",
    right: 22,
    bottom: 22,
    alignItems: "center",
    justifyContent: "center",
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
  inputFlex: { flex: 1 },
  errorText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.danger,
    marginTop: 6,
    marginLeft: 16,
  },
  forgotLink: { alignSelf: "center", marginTop: 20 },
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
