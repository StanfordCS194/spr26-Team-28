/*
 * Login screen for the app.
 *
 * Collects username/password credentials, signs the user in via Supabase Auth
 * using an internal generated email, and provides navigation to the signup
 * route using Expo Router. Includes password visibility toggle and a disabled
 * state while inputs are incomplete or a request is in progress.
 *
 */

import { useState } from "react";
import {
  Text,
  Alert,
  Image,
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import db from "@/database/db";
import theme from "@/assets/theme";

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function signInWithUsername() {
    console.log("Sign in button pressed");

    const trimmedUsername = username.trim().toLowerCase();
    console.log("Username entered:", trimmedUsername);

    if (!trimmedUsername || !password) {
      console.log("Missing username or password");
      Alert.alert("Please enter your username and password.");
      return;
    }

    setLoading(true);
    console.log("Starting sign in request...");

    try {
      const generatedEmail = `${trimmedUsername}@munimend.local`;
      const { data, error } = await db.auth.signInWithPassword({
        email: generatedEmail,
        password,
      });

      console.log("Supabase response:", { data, error });

      if (error) {
        console.error("Sign-in error:", error);
        Alert.alert("Login failed", error.message);
        return;
      }

      console.log("Login successful");
      router.replace("/tabs");
    } catch (error) {
      console.error("Network or unexpected error during sign-in:", error);
      Alert.alert("Network error", error.message ?? "Network request failed");
    } finally {
      console.log("Finished sign in attempt");
      setLoading(false);
    }
  }

  const isSignInDisabled =
    loading || username.trim().length === 0 || password.length === 0;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Image
        source={require("../assets/images/logo.png")}
        style={styles.logo}
      />

      <View style={styles.inputField}>
        <MaterialCommunityIcons
          name="account"
          size={30}
          color={theme.colors.textQuaternary}
        />
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor={theme.colors.textQuaternary}
          autoCapitalize="none"
          autoCorrect={false}
          multiline={false}
          style={styles.input}
        />
      </View>

      <View style={styles.inputField}>
        <MaterialCommunityIcons
          name="lock"
          size={30}
          color={theme.colors.textQuaternary}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={theme.colors.textQuaternary}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          multiline={false}
          style={styles.input}
        />
        <TouchableOpacity
          onPress={() => setShowPassword((prev) => !prev)}
          activeOpacity={0.6}
        >
          <MaterialCommunityIcons
            name={showPassword ? "eye-off-outline" : "eye-outline"}
            size={30}
            color={theme.colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.buttonContainer,
          isSignInDisabled ? styles.buttonDisabled : styles.buttonActive,
        ]}
      >
        <TouchableOpacity
          onPress={signInWithUsername}
          disabled={isSignInDisabled}
          activeOpacity={0.6}
        >
          <Text
            style={[styles.button, isSignInDisabled && styles.buttonDisabled]}
          >
            Sign In
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.signupRow}>
        <Text style={styles.signupText}>Don't have an account?</Text>
        <TouchableOpacity onPress={() => router.replace("/sign-up")}>
          <Text style={styles.signupLink}> Sign up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 20,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.backgroundPrimary,
  },
  logo: {
    width: 350,
    height: 200,
    borderWidth: theme.styling.borderWidthBiggest,
    borderRadius: theme.styling.borderRadiusBiggest,
    borderColor: theme.colors.backgroundSecondary,
  },
  input: {
    flex: 1,
    fontFamily: theme.styling.fontFamilyMain,
    fontSize: theme.sizes.textSmall,
  },
  inputField: {
    width: 300,
    padding: 15,
    borderWidth: theme.styling.borderWidthBiggest,
    borderRadius: theme.styling.borderRadiusBiggest,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    backgroundColor: theme.colors.yellowLight,
    borderColor: theme.colors.backgroundSecondary,
  },
  buttonContainer: {
    width: 300,
    padding: 25,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: theme.styling.borderWidthBiggest,
    borderRadius: theme.styling.borderRadiusBiggest,
    borderColor: theme.colors.backgroundSecondary,
    backgroundColor: theme.colors.buttonInactive,
  },
  button: {
    fontFamily: theme.styling.fontFamilyMain,
    color: theme.colors.textQuaternary,
    fontSize: theme.sizes.textSmall,
  },
  buttonActive: {
    backgroundColor: theme.colors.buttonActive,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.buttonInactive,
  },
  signupRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  signupText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.styling.fontFamilyMain,
    fontSize: theme.sizes.textSmall,
  },
  signupLink: {
    color: theme.colors.yellow,
    fontFamily: theme.styling.fontFamilyMain,
    fontSize: theme.sizes.textSmall,
    textDecorationLine: "underline",
  },
});
