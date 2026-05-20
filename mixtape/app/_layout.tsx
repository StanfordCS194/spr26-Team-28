/*
 * Root layout for the app.
 *
 * Handles global font loading and splash screen control before rendering
 * the routed application content. Ensures custom fonts are available
 * before the UI is displayed and configures the global status bar.
 */

import { useCallback, useRef } from "react";
import { Stack } from "expo-router";
import { View, StatusBar } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import theme from "@/assets/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const hideSplashRef = useRef(false);

  // Load fonts and the splash screen
  const [fontsLoaded, fontError] = useFonts({
    Spectral: require("../assets/Fonts/Spectral/Spectral-Regular.ttf"),
    "Spectral-Medium": require("../assets/Fonts/Spectral/Spectral-Medium.ttf"),
    "Spectral-SemiBold": require("../assets/Fonts/Spectral/Spectral-SemiBold.ttf"),
    "Spectral-SemiBoldItalic": require("../assets/Fonts/Spectral/Spectral-SemiBoldItalic.ttf"),
    "Spectral-Bold": require("../assets/Fonts/Spectral/Spectral-Bold.ttf"),
    "Spectral-Italic": require("../assets/Fonts/Spectral/Spectral-Italic.ttf"),
    "Spectral-BoldItalic": require("../assets/Fonts/Spectral/Spectral-BoldItalic.ttf"),

    GoogleSans: require("../assets/Fonts/Google_Sans/GoogleSans-Bold.ttf"),
    "GoogleSans-Regular": require("../assets/Fonts/Google_Sans/GoogleSans-Regular.ttf"),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && !hideSplashRef.current) {
      hideSplashRef.current = true;
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        // Silently ignore if splash screen is already hidden
      }
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      onLayout={onLayoutRootView}
    >
      <StatusBar barStyle={theme.statusBar} />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
