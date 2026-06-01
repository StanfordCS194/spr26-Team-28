/*
 * Sign-in route group layout.
 *
 * Wraps all authentication, onboarding, music connection, and sharing consent
 * screens in a stack navigator with hidden headers.
 */
import { Stack } from "expo-router";

export default function SignInLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
