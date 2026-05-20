/*
 * Loading screen component that displays a centered activity indicator.
 * Used to indicate in-progress or transitional states while data or
 * navigation is loading.
 */

import { ActivityIndicator, StyleSheet, View } from "react-native";

import theme from "@/assets/theme";

export default function Loading() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
});
