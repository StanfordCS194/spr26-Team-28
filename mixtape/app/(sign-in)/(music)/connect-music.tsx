import { Alert, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";

import { useSpotifyAuth } from "@/utils/useSpotifyAuth";
import theme from "@/assets/theme";

export default function ConnectMusic() {
  const router = useRouter();
  const [showSpotifyModal, setShowSpotifyModal] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);

  const {
    accessToken,
    fanData,
    loading,
    error: spotifyError,
    isConfigured,
    redirectUri,
    promptAsync,
  } = useSpotifyAuth();

  useEffect(() => {
    if (accessToken) {
      setSpotifyConnected(true);
      setShowSpotifyModal(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (fanData) {
      console.log("Fan data ready for Supabase storage:", {
        profile: fanData.profile,
        topTrackCount: fanData.topTracks.length,
        topArtistCount: fanData.topArtists.length,
        recentlyPlayedCount: fanData.recentlyPlayed.length,
      });
    }
  }, [fanData]);

  async function handleContinueToSpotify() {
    if (!isConfigured) {
      Alert.alert(
        "Spotify is not configured",
        `Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID and register this redirect URI: ${redirectUri}`,
      );
      return;
    }
    await promptAsync();
  }

  // Skip Spotify entirely - go straight to tabs
  function skip() {
    router.replace("/(tabs)");
  }

  // Spotify connected - proceed to follow an artist
  function continueWithSources() {
    router.push("/(sign-in)/follow-artist");
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.topRow}>
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </Pressable>
          <Pressable onPress={skip}>
            <Text style={styles.skip}>SKIP</Text>
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Connect your music</Text>
          <Text style={styles.subtitle}>
            Mixtape reads from the services you already use. Connect Spotify now
            and add Apple Music later.
          </Text>
        </View>

        <View style={styles.services}>
          <ServiceCard
            logo={
              <Image
                source={require("@/assets/images/spotify.png")}
                style={styles.logo}
              />
            }
            name="Spotify"
            status={
              spotifyConnected
                ? "CONNECTED"
                : isConfigured
                  ? "NOT CONNECTED"
                  : "CONFIG NEEDED"
            }
            connected={spotifyConnected}
            connectedColor={theme.colors.spotify}
            onPress={() => !spotifyConnected && setShowSpotifyModal(true)}
          />

          <ServiceCard
            logo={
              <Image
                source={require("@/assets/images/apple.png")}
                style={styles.logo}
              />
            }
            name="Apple Music"
            status="COMING SOON"
            connected={false}
            connectedColor={theme.colors.muted}
            onPress={() => {}}
          />
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.privacyCard}>
          <Ionicons
            name="shield-checkmark-outline"
            size={16}
            color={theme.colors.muted}
          />
          <Text style={styles.privacyText}>
            We only read from your accounts. We never post, follow, or change
            anything. You can disconnect at any time.
          </Text>
        </View>

        <Pressable
          style={[styles.button, !spotifyConnected && styles.buttonDisabled]}
          onPress={continueWithSources}
          disabled={!spotifyConnected}
        >
          <Text style={styles.buttonLabel}>Continue</Text>
        </Pressable>

        <Pressable onPress={skip} style={styles.skipLink}>
          <Text style={styles.skipLinkText}>I'll add a source later</Text>
        </Pressable>
      </View>

      <Modal
        visible={showSpotifyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSpotifyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />

            <View style={styles.modalIcons}>
              <Image
                source={require("@/assets/images/spotify.png")}
                style={styles.modalLogo}
              />
              <Text style={styles.modalDots}>...</Text>
              <Image
                source={require("@/assets/images/logo.png")}
                style={styles.modalLogo}
              />
            </View>

            <Text style={styles.modalTitle}>
              Sign in to Spotify to{"\n"}continue to Mixtape
            </Text>
            <Text style={styles.modalSubtitle}>
              You'll sign in on Spotify's site. We won't see your password.
            </Text>
            {!isConfigured && (
              <Text style={styles.errorText}>
                Missing Spotify client ID for this build.
              </Text>
            )}
            {spotifyError && isConfigured && (
              <Text style={styles.errorText}>{spotifyError}</Text>
            )}

            <View style={styles.urlPill}>
              <Ionicons
                name="lock-closed-outline"
                size={12}
                color={theme.colors.muted}
              />
              <Text style={styles.urlText}>accounts.spotify.com</Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                pressed && !loading && isConfigured && styles.modalButtonPressed,
                (loading || !isConfigured) && styles.buttonDisabled,
              ]}
              onPress={handleContinueToSpotify}
              disabled={loading || !isConfigured}
            >
              <Text style={styles.modalButtonLabel}>
                {loading ? "Connecting..." : "Continue to Spotify"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowSpotifyModal(false)}
              style={styles.cancelLink}
              disabled={loading}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ServiceCard({
  logo,
  name,
  status,
  connected,
  connectedColor,
  onPress,
}: {
  logo: React.ReactNode;
  name: string;
  status: string;
  connected: boolean;
  connectedColor: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        {logo}
        <View style={{ gap: 4 }}>
          <Text style={styles.cardName}>{name}</Text>
          <Text
            style={[
              styles.cardStatus,
              connected && { color: connectedColor },
              status === "COMING SOON" && styles.cardStatusMuted,
            ]}
          >
            {status}
          </Text>
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.connectButton,
          connected
            ? styles.connectButtonConnected
            : styles.connectButtonDefault,
          status === "COMING SOON" && styles.connectButtonDisabled,
          pressed &&
            status !== "COMING SOON" &&
            !connected &&
            styles.connectButtonPressed,
        ]}
        onPress={onPress}
        disabled={status === "COMING SOON" || connected}
      >
        <Text
          style={[
            styles.connectButtonLabel,
            connected && styles.connectButtonLabelConnected,
            status === "COMING SOON" && styles.connectButtonLabelDisabled,
          ]}
        >
          {connected
            ? "Connected"
            : status === "COMING SOON"
              ? "Soon"
              : "Connect"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  skip: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
    letterSpacing: 0.6,
  },
  header: { marginTop: 10, marginBottom: 28 },
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
    lineHeight: 24,
    color: theme.colors.muted,
  },
  services: { gap: 20, marginBottom: 20 },
  logo: { width: 44, height: 44, borderRadius: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  cardName: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
  },
  cardStatus: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.5,
  },
  cardStatusMuted: { color: theme.colors.muted },
  connectButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
  },
  connectButtonDefault: { backgroundColor: theme.colors.text },
  connectButtonConnected: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: theme.colors.spotify,
  },
  connectButtonDisabled: { backgroundColor: theme.colors.border },
  connectButtonPressed: { opacity: 0.7 },
  connectButtonLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkText,
  },
  connectButtonLabelConnected: { color: theme.colors.spotify },
  connectButtonLabelDisabled: { color: theme.colors.muted },
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 20,
  },
  privacyText: {
    flex: 1,
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    lineHeight: 20,
    color: theme.colors.muted,
  },
  button: {
    width: "100%",
    height: 55,
    backgroundColor: theme.colors.primary,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.button,
    color: theme.colors.darkText,
  },
  skipLink: { alignItems: "center" },
  skipLinkText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
    textDecorationLine: "underline",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingBottom: 60,
    paddingTop: 24,
    alignItems: "center",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 28,
  },
  modalIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  modalLogo: { width: 52, height: 52, borderRadius: 14 },
  modalDots: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.muted,
    letterSpacing: 2,
  },
  modalTitle: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.headline,
    lineHeight: 42,
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 10,
  },
  modalSubtitle: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    lineHeight: 20,
    color: theme.colors.muted,
    textAlign: "center",
    marginBottom: 20,
  },
  errorText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    lineHeight: 20,
    color: theme.colors.danger,
    textAlign: "center",
    marginBottom: 14,
  },
  urlPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: "100%",
    marginBottom: 20,
  },
  urlText: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
  },
  modalButton: {
    width: "100%",
    height: 55,
    backgroundColor: theme.colors.text,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalButtonPressed: { backgroundColor: theme.colors.primary },
  modalButtonLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.button,
    color: theme.colors.darkText,
  },
  cancelLink: { alignItems: "center" },
  cancelText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
  },
});
