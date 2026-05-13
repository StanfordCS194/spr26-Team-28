import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ── Color tokens ──────────────────────────────────────────────────────────────

const T = {
  bg: "#F2EDE6",
  bgAlt: "#EAE4DC",
  white: "#FFFFFF",
  border: "rgba(0,0,0,0.07)",
  border2: "rgba(0,0,0,0.12)",
  text: "#1C1A18",
  sub: "#7A746E",
  muted: "#B5AFA9",
  yellow: "#F5B93E",
  sage: "#9BBFA8",
  blush: "#F0B8AC",
  lav: "#BEB0D8",
  sky: "#A8C8E0",
  green: "#4A9E6F",
  red: "#D96B5A",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Artist = {
  id: number;
  name: string;
  handle: string;
  genre: string;
  tags: string[];
  overlap: number;
  listeners: string;
  listenerNum: number;
  markets: string[];
  recentShow: string;
  bio: string;
  open: boolean;
  lookingFor: string[];
  color: string;
  initials: string;
  activity: string;
  mutualFans: string;
};

type CollabRequest = {
  id: number;
  artistName: string;
  initials: string;
  color: string;
  type: string;
  status: "pending" | "accepted";
  date: string;
  msg: string;
  direction: "sent" | "received";
};

type Screen =
  | { id: "discover" }
  | { id: "profile"; artist: Artist }
  | { id: "request"; artist: Artist }
  | { id: "mycollabs" }
  | { id: "success"; artist: Artist };

// ── Mock data ─────────────────────────────────────────────────────────────────

const ARTISTS: Artist[] = [
  {
    id: 1,
    name: "Faye Hollow",
    handle: "@fayehollow",
    genre: "Dream Pop",
    tags: ["Dream Pop", "Shoegaze", "Ethereal"],
    overlap: 72,
    listeners: "18.4K",
    listenerNum: 18400,
    markets: ["New York", "LA", "Portland"],
    recentShow: "Mercury Lounge, NYC — Mar 2026",
    bio: "Faye makes slow-burning dream pop with a knack for cinematic arrangements. Currently touring the East Coast.",
    open: true,
    lookingFor: ["Opener Slot", "Joint Show"],
    color: T.lav,
    initials: "FH",
    activity: "Active 2 days ago",
    mutualFans: "4.1K",
  },
  {
    id: 2,
    name: "The Foxgloves",
    handle: "@thefoxgloves",
    genre: "Indie Folk",
    tags: ["Indie Folk", "Americana", "Acoustic"],
    overlap: 64,
    listeners: "24.1K",
    listenerNum: 24100,
    markets: ["Nashville", "Chicago", "Austin"],
    recentShow: "The Basement East, Nashville — Apr 2026",
    bio: "A three-piece indie folk band blending old Americana with modern indie production. Midwest touring base.",
    open: true,
    lookingFor: ["Co-Headliner", "Opener Slot"],
    color: T.sage,
    initials: "TF",
    activity: "Active today",
    mutualFans: "3.2K",
  },
  {
    id: 3,
    name: "Luca Osei",
    handle: "@lucaosei",
    genre: "Alt. R&B",
    tags: ["Alt. R&B", "Neo-Soul", "Indie"],
    overlap: 58,
    listeners: "31.8K",
    listenerNum: 31800,
    markets: ["LA", "Atlanta", "Houston"],
    recentShow: "Troubadour, LA — Apr 2026",
    bio: "Luca writes soulful alt-R&B that sits between Frank Ocean and Bon Iver. Strong Southern and West Coast presence.",
    open: true,
    lookingFor: ["Co-Headliner", "Joint Show"],
    color: T.yellow,
    initials: "LO",
    activity: "Active 5 days ago",
    mutualFans: "2.7K",
  },
  {
    id: 4,
    name: "Solene Park",
    handle: "@solenepark",
    genre: "Bedroom Pop",
    tags: ["Bedroom Pop", "Lo-fi", "Indie"],
    overlap: 51,
    listeners: "9.2K",
    listenerNum: 9200,
    markets: ["Seattle", "Portland", "SF"],
    recentShow: "Neumos, Seattle — Feb 2026",
    bio: "Solene makes intimate bedroom pop with layered vocals and warm synthesizers. Growing West Coast presence.",
    open: false,
    lookingFor: ["Opener Slot"],
    color: T.blush,
    initials: "SP",
    activity: "Active 3 weeks ago",
    mutualFans: "2.1K",
  },
  {
    id: 5,
    name: "Tide & Ember",
    handle: "@tideember",
    genre: "Indie Rock",
    tags: ["Indie Rock", "Post-Punk", "Art Rock"],
    overlap: 45,
    listeners: "41.2K",
    listenerNum: 41200,
    markets: ["Chicago", "Detroit", "New York"],
    recentShow: "Empty Bottle, Chicago — Apr 2026",
    bio: "Tide & Ember brings angular indie rock with post-punk energy and a poetic lyrical sensibility.",
    open: true,
    lookingFor: ["Co-Headliner"],
    color: T.sky,
    initials: "TE",
    activity: "Active 1 day ago",
    mutualFans: "1.8K",
  },
];

const ALL_GENRES = [
  "All",
  "Dream Pop",
  "Indie Folk",
  "Alt. R&B",
  "Bedroom Pop",
  "Indie Rock",
];
const COLLAB_TYPES: { key: string; emoji: string; desc: string }[] = [
  {
    key: "Opener Slot",
    emoji: "🎸",
    desc: "You perform before their headline set",
  },
  { key: "Co-Headliner", emoji: "⭐", desc: "Equal billing on a shared show" },
  {
    key: "Joint Show",
    emoji: "🎪",
    desc: "A unique joint performance concept",
  },
];
const TYPE_COLORS: Record<string, string> = {
  "Opener Slot": T.sage,
  "Co-Headliner": T.lav,
  "Joint Show": T.yellow,
};

// ── Primitives ────────────────────────────────────────────────────────────────

function Avatar({
  initials,
  color,
  size = 48,
}: {
  initials: string;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          backgroundColor: color + "44",
          borderColor: color + "66",
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.3, color }]}>
        {initials}
      </Text>
    </View>
  );
}

function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.backButton}>
      <Text style={styles.backArrow}>‹</Text>
    </TouchableOpacity>
  );
}

function ScreenHeader({
  title,
  left,
  right,
}: {
  title: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.screenHeader}>
      <View style={styles.screenHeaderSide}>{left}</View>
      <Text style={styles.screenHeaderTitle}>{title}</Text>
      <View style={styles.screenHeaderSide}>{right}</View>
    </View>
  );
}

// Animated overlap progress bar
function OverlapBar({
  pct,
  color,
  delay = 0,
}: {
  pct: number;
  color: string;
  delay?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct / 100,
      duration: 900,
      delay,
      useNativeDriver: false, // animating width (layout prop)
    }).start();
  }, [pct]);

  return (
    <View style={styles.overlapBarTrack}>
      <Animated.View
        style={[
          styles.overlapBarFill,
          {
            backgroundColor: color,
            width: anim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}

// ── ArtistCard ────────────────────────────────────────────────────────────────

function ArtistCard({
  artist: a,
  onPress,
  delay = 0,
}: {
  artist: Artist;
  onPress: () => void;
  delay?: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
    >
      <TouchableOpacity
        onPress={onPress}
        style={styles.artistCard}
        activeOpacity={0.75}
      >
        {/* Top row */}
        <View style={styles.artistCardTop}>
          <Avatar initials={a.initials} color={a.color} size={50} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.artistCardNameRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.artistName}>{a.name}</Text>
                <Text style={styles.artistHandle}>
                  {a.handle} · {a.listeners} listeners
                </Text>
              </View>
              <View
                style={[
                  styles.overlapBadge,
                  {
                    backgroundColor: a.color + "28",
                    borderColor: a.color + "50",
                  },
                ]}
              >
                <Text style={[styles.overlapBadgeText, { color: a.color }]}>
                  {a.overlap}%
                </Text>
              </View>
            </View>
            {/* Tags */}
            <View style={styles.tagRow}>
              {a.tags.slice(0, 2).map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
              {a.open && (
                <View
                  style={[styles.openBadge, { borderColor: T.sage + "50" }]}
                >
                  <Text style={[styles.openBadgeText, { color: T.sage }]}>
                    Open to collabs
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Overlap bar */}
        <View style={{ marginTop: 4 }}>
          <View style={styles.overlapBarHeader}>
            <Text style={styles.overlapBarLabel}>Fan overlap with you</Text>
            <Text style={styles.overlapBarFans}>
              {a.mutualFans} shared fans
            </Text>
          </View>
          <OverlapBar pct={a.overlap} color={a.color} delay={delay} />
        </View>

        {/* Bottom row */}
        <View style={styles.artistCardBottom}>
          <Text style={styles.artistMeta}>📍 {a.markets[0]}</Text>
          <Text style={styles.artistMeta}>{a.activity}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Screen 1: Discover ────────────────────────────────────────────────────────

function DiscoverScreen({
  onArtistPress,
  onInboxPress,
}: {
  onArtistPress: (a: Artist) => void;
  onInboxPress: () => void;
}) {
  const [genre, setGenre] = useState("All");

  const filtered =
    genre === "All" ? ARTISTS : ARTISTS.filter((a) => a.tags.includes(genre));

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.discoverHeader}>
        <View>
          <Text style={styles.discoverTitle}>Find Collabs</Text>
          <Text style={styles.discoverSub}>
            Artists matched to your fanbase
          </Text>
        </View>
      </View>

      {/* Genre chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 4 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingVertical: 10,
          gap: 8,
        }}
        nestedScrollEnabled
      >
        {ALL_GENRES.map((g) => (
          <TouchableOpacity
            key={g}
            onPress={() => setGenre(g)}
            style={[
              styles.genreChip,
              genre === g && { backgroundColor: T.text, borderWidth: 0 },
            ]}
          >
            <Text
              style={[styles.genreChipText, genre === g && { color: T.bg }]}
            >
              {g}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Artist list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.matchCount}>{filtered.length} matches found</Text>
        {filtered.map((a, i) => (
          <ArtistCard
            key={a.id}
            artist={a}
            onPress={() => onArtistPress(a)}
            delay={i * 60}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── Screen 2: Profile ─────────────────────────────────────────────────────────

function ProfileScreen({
  artist: a,
  onBack,
  onSendRequest,
}: {
  artist: Artist;
  onBack: () => void;
  onSendRequest: () => void;
}) {
  const marketColors = [a.color, T.yellow, T.blush];
  const barWidths = [85, 65, 45];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 0,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Artist Profile"
          left={<BackButton onPress={onBack} />}
        />

        {/* Identity */}
        <SectionCard style={{ marginBottom: 14 }}>
          <View
            style={{
              flexDirection: "row",
              gap: 14,
              alignItems: "flex-start",
              marginBottom: 14,
            }}
          >
            <Avatar initials={a.initials} color={a.color} size={60} />
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{a.name}</Text>
              <Text style={styles.profileHandle}>{a.handle}</Text>
              <View style={[styles.tagRow, { marginTop: 8 }]}>
                {a.tags.map((tag) => (
                  <View
                    key={tag}
                    style={[
                      styles.tag,
                      { backgroundColor: a.color + "22", borderWidth: 0 },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: a.color }]}>
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          <Text style={styles.bio}>{a.bio}</Text>
        </SectionCard>

        {/* Fan audience overlap */}
        <SectionCard style={{ marginBottom: 14 }}>
          <Text style={styles.cardSectionLabel}>Fan Audience Overlap</Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            {[
              { label: "Shared fans", value: a.mutualFans, color: T.text },
              { label: "Their listeners", value: a.listeners, color: a.color },
            ].map((s) => (
              <View key={s.label} style={styles.statPill}>
                <Text style={[styles.statPillValue, { color: s.color }]}>
                  {s.value}
                </Text>
                <Text style={styles.statPillLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </SectionCard>

        {/* Top markets */}
        <SectionCard style={{ marginBottom: 14 }}>
          <Text style={styles.cardSectionLabel}>Top Markets</Text>
          {a.markets.map((city, i) => (
            <View
              key={city}
              style={[
                styles.marketRow,
                i < a.markets.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: T.border,
                },
              ]}
            >
              <View
                style={[
                  styles.rankBadge,
                  { backgroundColor: marketColors[i] + "25" },
                ]}
              >
                <Text style={[styles.rankText, { color: marketColors[i] }]}>
                  {i + 1}
                </Text>
              </View>
              <Text style={styles.marketCity}>{city}</Text>
              <View style={styles.marketBarTrack}>
                <View
                  style={[
                    styles.marketBarFill,
                    {
                      width: `${barWidths[i]}%`,
                      backgroundColor: marketColors[i],
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </SectionCard>

        {/* Open to */}
        <SectionCard style={{ marginBottom: 14 }}>
          <Text style={styles.cardSectionLabel}>Open To</Text>
          <View style={styles.tagRow}>
            {a.lookingFor.map((l) => (
              <View
                key={l}
                style={[
                  styles.tag,
                  {
                    backgroundColor: a.color + "22",
                    borderColor: a.color + "44",
                    paddingVertical: 7,
                    paddingHorizontal: 16,
                  },
                ]}
              >
                <Text
                  style={[styles.tagText, { color: a.color, fontSize: 13 }]}
                >
                  {l}
                </Text>
              </View>
            ))}
          </View>
        </SectionCard>

        {/* Recent show */}
        <View style={styles.recentShowRow}>
          <Text style={{ fontSize: 18 }}>🎤</Text>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.recentShowLabel}>Most recent show</Text>
            <Text style={styles.recentShowValue}>{a.recentShow}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function CollabsTab() {
  const [screen, setScreen] = useState<Screen>({ id: "discover" });

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {screen.id === "discover" && (
        <DiscoverScreen
          onArtistPress={(a) => setScreen({ id: "profile", artist: a })}
          onInboxPress={() => setScreen({ id: "mycollabs" })}
        />
      )}
      {screen.id === "profile" && (
        <ProfileScreen
          artist={screen.artist}
          onBack={() => setScreen({ id: "discover" })}
          onSendRequest={() =>
            setScreen({ id: "request", artist: screen.artist })
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },

  // Avatar
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    flexShrink: 0,
  },
  avatarText: {
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  // Section card
  sectionCard: {
    backgroundColor: T.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  // Back button
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.white,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  backArrow: {
    fontSize: 22,
    color: T.text,
    lineHeight: 24,
    marginTop: -2,
  },

  // Screen header
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  screenHeaderSide: {
    width: 36,
    alignItems: "center",
  },
  screenHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: T.text,
  },

  // Overlap bar
  overlapBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: T.bgAlt,
    overflow: "hidden",
  },
  overlapBarFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Venn circle
  vennCircle: {},

  // Toggle
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: T.text,
    marginBottom: 2,
  },
  toggleSub: {
    fontSize: 12,
    color: T.muted,
  },
  toggleTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    flexShrink: 0,
  },
  toggleThumb: {
    position: "absolute",
    top: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: T.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },

  // Discover header
  discoverHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  discoverTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: T.text,
    lineHeight: 28,
  },
  discoverSub: {
    fontSize: 14,
    color: T.sub,
    marginTop: 3,
  },

  // Inbox button
  inboxButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: T.white,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  inboxIcon: {
    fontSize: 16,
    color: T.text,
  },
  inboxBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.yellow,
    borderWidth: 1.5,
    borderColor: T.bg,
  },

  // Genre chips
  genreChip: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 99,
    backgroundColor: T.white,
    borderWidth: 1.5,
    borderColor: T.border2,
    flexShrink: 0,
  },
  genreChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: T.sub,
  },

  // Match count
  matchCount: {
    fontSize: 12,
    color: T.muted,
    fontWeight: "500",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Artist card
  artistCard: {
    backgroundColor: T.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  artistCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  artistCardNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 7,
  },
  artistName: {
    fontSize: 16,
    fontWeight: "800",
    color: T.text,
  },
  artistHandle: {
    fontSize: 12,
    color: T.muted,
    marginTop: 1,
  },
  overlapBadge: {
    borderRadius: 99,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    marginLeft: 8,
    flexShrink: 0,
    alignSelf: "flex-start",
  },
  overlapBadgeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 2,
  },
  tag: {
    backgroundColor: T.bgAlt,
    borderRadius: 99,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tagText: {
    fontSize: 11,
    color: T.sub,
    fontWeight: "500",
  },
  openBadge: {
    backgroundColor: T.sage + "30",
    borderRadius: 99,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderWidth: 1,
  },
  openBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  overlapBarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  overlapBarLabel: {
    fontSize: 11,
    color: T.muted,
  },
  overlapBarFans: {
    fontSize: 11,
    fontWeight: "600",
    color: T.sub,
  },
  artistCardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  artistMeta: {
    fontSize: 12,
    color: T.muted,
  },

  // Profile screen
  profileName: {
    fontSize: 20,
    fontWeight: "800",
    color: T.text,
    lineHeight: 24,
  },
  profileHandle: {
    fontSize: 13,
    color: T.muted,
    marginTop: 3,
  },
  bio: {
    fontSize: 14,
    color: T.sub,
    lineHeight: 22,
  },
  cardSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: T.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  vennPct: {
    fontSize: 18,
    fontWeight: "800",
    color: T.text,
  },
  vennLabel: {
    fontSize: 10,
    color: T.sub,
    marginTop: 2,
  },
  statPill: {
    flex: 1,
    backgroundColor: T.bgAlt,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  statPillValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  statPillLabel: {
    fontSize: 11,
    color: T.muted,
    marginTop: 3,
  },
  marketRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rankText: {
    fontSize: 12,
    fontWeight: "800",
  },
  marketCity: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: T.text,
  },
  marketBarTrack: {
    width: 60,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.bgAlt,
    overflow: "hidden",
  },
  marketBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  recentShowRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.bgAlt,
    borderRadius: 18,
    padding: 12,
    marginBottom: 24,
  },
  recentShowLabel: {
    fontSize: 12,
    color: T.muted,
  },
  recentShowValue: {
    fontSize: 13,
    fontWeight: "600",
    color: T.text,
    marginTop: 2,
  },

  // Sticky bottom
  stickyBottom: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 4 : 12,
    backgroundColor: T.bg,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  ctaButton: {
    backgroundColor: T.text,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  ctaButtonText: {
    color: T.bg,
    fontSize: 16,
    fontWeight: "800",
  },

  // Request screen
  toLabel: {
    fontSize: 11,
    color: T.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  toName: {
    fontSize: 16,
    fontWeight: "800",
    color: T.text,
  },
  toMeta: {
    fontSize: 12,
    color: T.muted,
    marginTop: 1,
  },
  pickerSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: T.sub,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: T.white,
    borderWidth: 1.5,
    borderColor: T.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  typeEmoji: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  typeTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: T.text,
  },
  typeDesc: {
    fontSize: 12,
    color: T.muted,
    marginTop: 2,
  },
  typeCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
    flexShrink: 0,
  },
  messageInput: {
    backgroundColor: T.white,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: T.border,
    padding: 14,
    fontSize: 14,
    color: T.text,
    minHeight: 110,
    lineHeight: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  charCount: {
    fontSize: 11,
    color: T.muted,
    textAlign: "right",
    marginTop: 6,
    marginBottom: 16,
  },
  privacyNote: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: T.bgAlt,
    borderRadius: 14,
    padding: 12,
    marginBottom: 24,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: T.sub,
    lineHeight: 18,
  },

  // My Collabs
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: T.bgAlt,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: "center",
  },
  segmentButtonActive: {
    backgroundColor: T.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "500",
    color: T.muted,
  },
  segmentTextActive: {
    fontWeight: "700",
    color: T.text,
  },
  collabCard: {
    backgroundColor: T.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  collabArtistName: {
    fontSize: 15,
    fontWeight: "800",
    color: T.text,
  },
  collabMeta: {
    fontSize: 12,
    color: T.muted,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 99,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  messagePreview: {
    backgroundColor: T.bgAlt,
    borderRadius: 12,
    padding: 10,
  },
  messagePreviewText: {
    fontSize: 13,
    color: T.sub,
    lineHeight: 20,
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: T.text,
    alignItems: "center",
  },
  acceptButtonText: {
    color: T.bg,
    fontSize: 13,
    fontWeight: "700",
  },
  declineButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: T.bgAlt,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
  },
  declineButtonText: {
    color: T.sub,
    fontSize: 13,
    fontWeight: "600",
  },
  messageButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: T.sage + "22",
    borderWidth: 1,
    borderColor: T.sage + "50",
    alignItems: "center",
  },
  messageButtonText: {
    color: T.green,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: T.text,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: T.muted,
  },

  // Success sheet
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(242,237,230,0.97)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    zIndex: 10,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: T.sage + "30",
    borderWidth: 2,
    borderColor: T.sage + "60",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: T.text,
    marginBottom: 8,
  },
  successBody: {
    fontSize: 15,
    color: T.sub,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 260,
    marginBottom: 32,
  },
  successButton: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 99,
    backgroundColor: T.text,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  successButtonText: {
    color: T.bg,
    fontSize: 16,
    fontWeight: "800",
  },
});
