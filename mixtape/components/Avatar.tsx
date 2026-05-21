// Reusable avatar component that shows a profile image or falls back to
// an initials circle. Works with both the light (fan) and dark (artist) themes.

import { Image, StyleSheet, Text, View } from "react-native";

import theme from "@/assets/theme";

type AvatarProps = {
  imageUrl?: string | null;
  name: string;
  size?: number;
  dark?: boolean;
};

function initialsFromName(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export default function Avatar({
  imageUrl,
  name,
  size = 64,
  dark = false,
}: AvatarProps) {
  const radius = size / 2;
  const fontSize = size * 0.32;

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: radius,
          },
        ]}
      />
    );
  }

  const textColor = dark ? theme.colors.darkText : "#fff";

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
      ]}
    >
      <Text
        style={[
          styles.initials,
          {
            fontSize,
            color: textColor,
          },
        ]}
      >
        {initialsFromName(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: "cover",
    backgroundColor: theme.colors.primary,
  },
  fallback: {
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: theme.fonts.sansBold,
    letterSpacing: 1,
  },
});
