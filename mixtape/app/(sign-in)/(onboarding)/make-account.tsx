/*
 * Account creation screen.
 *
 * Registers a new user with Supabase Auth using their real email, stores the
 * chosen username in user metadata, then sends the user into onboarding.
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

import { supabase as db } from "@/database/db";
import theme from "@/assets/theme";
import {
  passwordChecks,
  isPasswordStrong,
  passwordsMatch,
  isValidEmail,
} from "@/utils/functions/authValidation";
import { friendlyAuthError } from "@/utils/functions/friendlyAuthError";

export default function MakeAccount() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [nameFocused, setNameFocused] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);

  const checks = passwordChecks(password);
  const doPasswordsMatch = passwordsMatch(password, confirmPassword);
  const passwordStrong = isPasswordStrong(password);
  const emailValid = isValidEmail(email);

  const isDisabled =
    loading ||
    name.trim().length === 0 ||
    username.trim().length === 0 ||
    !emailValid ||
    password.length === 0 ||
    confirmPassword.length === 0 ||
    !passwordStrong ||
    !doPasswordsMatch;

  // Validate the form, create the Supabase account, and continue onboarding.
  async function createAccount() {
    setHasAttempted(true);
    setFormError("");

    if (!passwordStrong || !doPasswordsMatch || !emailValid) {
      return;
    }

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();
    setLoading(true);

    try {
      const { error } = await db.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          // Store the username in metadata; it is no longer derivable from the
          // email now that we use the user's real address (issue #32).
          data: { name: name.trim(), username: trimmedUsername },
        },
      });

      if (error) {
        setFormError(friendlyAuthError(error.message));
        return;
      }

      router.push("/(sign-in)/(onboarding)/select-account");
    } catch (error: any) {
      setFormError(friendlyAuthError(error?.message ?? ""));
    } finally {
      setLoading(false);
    }
  }

  // Clear the form-level error whenever the user edits any field.
  function clearFormError() {
    if (formError) setFormError("");
  }

  // Render a single password requirement with a checked or empty icon.
  function renderCheck(label: string, met: boolean) {
    return (
      <View style={styles.checkRow}>
        <Ionicons
          name={met ? "checkmark-circle" : "ellipse-outline"}
          size={16}
          color={met ? theme.colors.success : theme.colors.muted}
        />
        <Text style={[styles.checkLabel, met && styles.checkLabelMet]}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable style={styles.back} onPress={() => router.back()}>
              <Ionicons
                name="chevron-back"
                size={20}
                color={theme.colors.text}
              />
            </Pressable>

            <View style={styles.header}>
              <Text style={styles.title}>Create an account.</Text>
              <Text style={styles.subtitle}>
                Set up your name, username, email, and password. You will pick
                whether you are a Fan or Artist next.
              </Text>
            </View>

            <View style={styles.fields}>
              {/* Name field */}
              <View
                style={[
                  styles.inputWrapper,
                  nameFocused && styles.inputWrapperFocused,
                ]}
              >
                <Text style={styles.inputLabel}>NAME</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={(v) => {
                    setName(v);
                    clearFormError();
                  }}
                  autoCorrect={false}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                />
              </View>

              {/* Username field */}
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
                  onChangeText={(v) => {
                    setUsername(v);
                    clearFormError();
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setUsernameFocused(true)}
                  onBlur={() => setUsernameFocused(false)}
                />
              </View>

              {/* Email field */}
              <View>
                <View
                  style={[
                    styles.inputWrapper,
                    emailFocused && styles.inputWrapperFocused,
                    hasAttempted &&
                      email.length > 0 &&
                      !emailValid &&
                      styles.inputWrapperError,
                  ]}
                >
                  <Text style={styles.inputLabel}>EMAIL</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      clearFormError();
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>
                {hasAttempted && email.length > 0 && !emailValid && (
                  <Text style={styles.errorText}>
                    Enter a valid email address.
                  </Text>
                )}
              </View>

              {/* Password field with show/hide toggle */}
              <View>
                <View
                  style={[
                    styles.inputWrapper,
                    styles.passwordWrapper,
                    passwordFocused && styles.inputWrapperFocused,
                  ]}
                >
                  <Text style={styles.inputLabel}>PASSWORD</Text>

                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      clearFormError();
                    }}
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

                {/* Password strength indicator */}
                {password.length > 0 && (
                  <View style={styles.strengthBox}>
                    {renderCheck("At least 8 characters", checks.hasMinLength)}
                    {renderCheck("Contains a number", checks.hasNumber)}
                  </View>
                )}
              </View>

              {/* Confirm password field */}
              <View>
                <View
                  style={[
                    styles.inputWrapper,
                    styles.passwordWrapper,
                    confirmFocused && styles.inputWrapperFocused,
                    hasAttempted &&
                      confirmPassword.length > 0 &&
                      !doPasswordsMatch &&
                      styles.inputWrapperError,
                  ]}
                >
                  <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>

                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={confirmPassword}
                    onChangeText={(v) => {
                      setConfirmPassword(v);
                      clearFormError();
                    }}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    onFocus={() => setConfirmFocused(true)}
                    onBlur={() => setConfirmFocused(false)}
                  />

                  <Pressable
                    style={styles.eyeButton}
                    onPress={() => setShowConfirm((s) => !s)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={showConfirm ? "eye-off-outline" : "eye-outline"}
                      size={25}
                      color={theme.colors.muted}
                    />
                  </Pressable>
                </View>

                {confirmPassword.length > 0 && !doPasswordsMatch && (
                  <Text style={styles.errorText}>Passwords do not match.</Text>
                )}
              </View>
            </View>

            {formError.length > 0 && (
              <Text style={styles.formErrorText}>{formError}</Text>
            )}

            <View style={styles.spacer} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && !isDisabled && styles.buttonPressed,
            isDisabled && styles.buttonDisabled,
          ]}
          onPress={createAccount}
          disabled={isDisabled}
        >
          <Ionicons
            name="person-add-outline"
            size={18}
            color={theme.colors.darkText}
          />
          <Text style={styles.buttonLabel}>
            {loading ? "Creating account..." : "Create account"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
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
    marginBottom: 32,
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
  fields: {
    gap: 30,
  },
  spacer: {
    minHeight: 40,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: theme.colors.background,
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
  passwordWrapper: {
    position: "relative",
    paddingRight: 48,
  },
  inputWrapperFocused: {
    borderColor: theme.colors.text,
  },
  inputWrapperError: {
    borderColor: theme.colors.danger,
  },
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
  strengthBox: {
    marginTop: 10,
    marginLeft: 16,
    gap: 4,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  checkLabel: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
  },
  checkLabelMet: {
    color: theme.colors.success,
  },
  errorText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.danger,
    marginTop: 6,
    marginLeft: 16,
  },
  formErrorText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.danger,
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 12,
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
