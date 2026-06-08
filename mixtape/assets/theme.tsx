/*
 * Central design tokens for the app: colors, fonts, font sizes/weights, and
 * border radii. Import this everywhere instead of hardcoding values so the fan
 * (light) and artist (dark) surfaces stay visually consistent and themeable
 * from one place.
 */

const theme = {
  statusBar: "dark-content" as const,
  colors: {
    background: "#EFE9DC", // need to change this
    text: "#0F1A2B",
    muted: "#4f5461",

    card: "#F4EDDD",
    border: "rgba(15,26,43,0.12)",

    white: "#fff",
    black: "#000",
    primary: "#e68b85",
    secondary: "#4281A4",

    darkBackground: "#2C2A2C",
    darkCard: "#38353A",
    darkText: "#FFFFFF",
    darkMuted: "rgba(255,255,255,0.55)",

    spotify: "#1DB954",
    success: "#4281A4",
    danger: "#FE938C",
  },
  fonts: {
    sans: "Spectral",
    sansMedium: "Spectral-Medium",
    sansSemiBold: "Spectral-SemiBold",
    sansSemiBoldItalic: "Spectral-SemiBoldItalic",
    sansBold: "Spectral-Bold",
    sansItalic: "Spectral-Italic",
    sansBoldItalic: "Spectral-BoldItalic",
    ui: "GoogleSans",
    uiRegular: "GoogleSans-Regular",
    mono: "System",
  },
  fontSizes: {
    tiny: 10,
    small: 14,
    body: 16,
    button: 17,
    subtitle: 20,
    title: 30,
    headline: 32,
    display: 58,
  },
  fontWeights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  border: {
    field: 20,
    button: 40,
  },
} as const;

export default theme;
