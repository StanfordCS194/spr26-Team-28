/*
 * Onboarding & auth stack navigator.
 *
 * Wraps the shared sign-up / sign-in / onboarding screens (make-account,
 * select-account, select-location, connect-music, follow-artist, favorite-song,
 * share-consent, sign-in, forgot-password) in a headerless stack. Both fans and
 * artists pass through here before diverging into their respective tab groups.
 */

import { Stack } from "expo-router";

export default function SignInLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
