/*
 * Login screen for the app.
 *
 * Displays the Mixtape landing screen with primary sign-up and sign-in actions.
 * Routes users to account creation or sign-in using Expo Router.
 */
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import theme from "@/assets/theme";

export default function Login() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.brandBlock}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>mixtape</Text>
          <Text style={styles.tagline}>
            Share what you love with the artists who made it.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push("/make-account")}
          >
            {({ pressed }) => (
              <>
                <Ionicons
                  name="person-add-outline"
                  size={18}
                  color={pressed ? theme.colors.primary : "#FFFFFF"}
                />
                <Text
                  style={[
                    styles.buttonLabel,
                    pressed && styles.buttonLabelPressed,
                  ]}
                >
                  Sign up
                </Text>
              </>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.buttonOutline,
              pressed && styles.buttonOutlinePressed,
            ]}
            onPress={() => router.push("/sign-in")}
          >
            {({ pressed }) => (
              <>
                <Ionicons
                  name="log-in-outline"
                  size={18}
                  color={pressed ? theme.colors.primary : theme.colors.text}
                />
                <Text
                  style={[
                    styles.buttonOutlineLabel,
                    pressed && styles.buttonLabelPressed,
                  ]}
                >
                  Sign in
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 60,
  },
  brandBlock: {
    width: "100%",
    alignItems: "center",
    marginBottom: 36,
  },
  logo: {
    width: "80%",
    aspectRatio: 1,
    marginBottom: -10,
  },
  title: {
    fontFamily: theme.fonts.sansSemiBoldItalic,
    fontSize: theme.fontSizes.display,
    lineHeight: 70,
    color: theme.colors.text,
  },
  tagline: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    lineHeight: 21,
    color: theme.colors.muted,
    textAlign: "center",
    marginTop: 8,
  },
  actions: {
    width: "100%",
    alignItems: "center",
  },
  button: {
    width: "100%",
    height: 55,
    backgroundColor: theme.colors.black,
    borderRadius: theme.border.button,
    borderWidth: 1.5,
    borderColor: theme.colors.text,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 15,
  },
  buttonPressed: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.primary,
  },
  buttonLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.button,
    color: "#FFFFFF",
  },
  buttonLabelPressed: {
    color: theme.colors.primary,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
    marginHorizontal: 12,
  },
  buttonOutline: {
    width: "100%",
    height: 55,
    borderRadius: theme.border.button,
    borderWidth: 1.5,
    borderColor: theme.colors.text,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 15,
  },
  buttonOutlinePressed: {
    borderColor: theme.colors.primary,
  },
  buttonOutlineLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.button,
    color: theme.colors.text,
  },
});
