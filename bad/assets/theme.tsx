const theme = {
  colors: {
    background: "#EFE9DC",
    text: "#0F1A2B",
    muted: "#6B7388",

    card: "#F4EDDD",
    border: "rgba(15,26,43,0.12)",

    primary: "#FE938C",
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
    serif: "Fraunces",
    sans: "Inter",
    mono: "JetBrainsMono",
  },

  fontSizes: {
    tiny: 10,
    small: 12,
    body: 14,
    button: 15,
    subtitle: 18,
    title: 26,
    headline: 32,
    display: 56,
  },

  fontWeights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 18,
    pill: 999,
  },

  shadows: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 8,
      elevation: 1,
    },
    button: {
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 16,
      elevation: 2,
    },
  },
} as const;

export default theme;
