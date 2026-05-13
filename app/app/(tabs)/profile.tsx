import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Neutral palette inspired by shadcn. One accent color keeps the UI quiet.
const C = {
  bg: "#FAFAFA",
  card: "#FFFFFF",
  border: "#E5E5E5",
  text: "#0A0A0A",
  sub: "#525252",
  muted: "#A3A3A3",
  positive: "#16A34A",
  negative: "#DC2626",
};

type ConnectedPlatform = {
  key: string;
  name: string;
  handle: string;
  connected: boolean;
  lastSync: string;
};

type RecentShow = {
  id: number;
  venue: string;
  city: string;
  date: string;
  attendance: string;
};

const ME = {
  name: "Kira Noel",
  handle: "@kiranoel",
  initials: "KN",
  tags: ["Indie Pop", "Dream Pop", "Bedroom Pop"],
  location: "Los Angeles, CA",
  bio: "Indie pop with cinematic edges. Home-recorded in a converted garage, now touring the West Coast.",
  openToCollab: true,
  lookingFor: ["Opener Slot", "Joint Show"],
  monthlyListeners: 42800,
  followers: 18400,
  totalStreams: 1240000,
};

const CONNECTED_PLATFORMS: ConnectedPlatform[] = [
  { key: "spotify",   name: "Spotify",     handle: "@kiranoel",  connected: true,  lastSync: "2m ago" },
  { key: "apple",     name: "Apple Music", handle: "@kiranoel",  connected: true,  lastSync: "5m ago" },
  { key: "youtube",   name: "YouTube",     handle: "@kiranoel",  connected: false, lastSync: "" },
  { key: "instagram", name: "Instagram",   handle: "@kira.noel", connected: true,  lastSync: "1h ago" },
  { key: "tiktok",    name: "TikTok",      handle: "@kiranoel",  connected: false, lastSync: "" },
];

const RECENT_SHOWS: RecentShow[] = [
  { id: 1, venue: "The Echo",      city: "Los Angeles, CA",   date: "Apr 18, 2026", attendance: "420" },
  { id: 2, venue: "Neumos",        city: "Seattle, WA",       date: "Mar 22, 2026", attendance: "285" },
  { id: 3, venue: "Rickshaw Stop", city: "San Francisco, CA", date: "Feb 14, 2026", attendance: "310" },
];

const BIG_HIT_SLOP = { top: 12, bottom: 12, left: 16, right: 16 };

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function Avatar({ initials, size = 72 }: { initials: string; size?: number }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.3 }]}>
        {initials}
      </Text>
    </View>
  );
}

export default function Profile() {
  // Local-only until the profile store exists; changing this does not persist yet.
  const [openToCollab, setOpenToCollab] = useState(ME.openToCollab);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            hitSlop={BIG_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <Text style={styles.headerAction}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Identity block keeps the avatar, name, and one-line summary together. */}
        <View style={styles.identity}>
          <Avatar initials={ME.initials} size={72} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{ME.name}</Text>
            <Text style={styles.sub}>
              {ME.handle}, {ME.location}
            </Text>
            <Text style={styles.tags}>{ME.tags.join(", ")}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {formatNumber(ME.monthlyListeners)}
            </Text>
            <Text style={styles.statLabel}>Monthly listeners</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatNumber(ME.followers)}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {formatNumber(ME.totalStreams)}
            </Text>
            <Text style={styles.statLabel}>Total streams</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>About</Text>
        <Text style={styles.bio}>{ME.bio}</Text>

        <Text style={styles.sectionLabel}>Collaborations</Text>
        <View style={styles.list}>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Open to collab</Text>
              <Text style={styles.rowMeta}>Show your profile in discovery</Text>
            </View>
            <Switch
              value={openToCollab}
              onValueChange={setOpenToCollab}
              trackColor={{ false: C.border, true: C.text }}
              thumbColor={C.card}
              accessibilityLabel="Open to collaboration"
            />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Looking for</Text>
              <Text style={styles.rowMeta}>{ME.lookingFor.join(", ")}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Connected platforms</Text>
        <View style={styles.list}>
          {CONNECTED_PLATFORMS.map((p, i) => (
            <View
              key={p.key}
              style={[
                styles.row,
                i < CONNECTED_PLATFORMS.length - 1 && styles.rowBorder,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{p.name}</Text>
                <Text style={styles.rowMeta}>
                  {p.connected
                    ? `${p.handle}, synced ${p.lastSync}`
                    : "Not connected"}
                </Text>
              </View>
              <TouchableOpacity
                hitSlop={BIG_HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={
                  p.connected
                    ? `Manage ${p.name} connection`
                    : `Connect ${p.name}`
                }
              >
                <Text
                  style={[
                    styles.rowAction,
                    !p.connected && styles.rowActionPrimary,
                  ]}
                >
                  {p.connected ? "Manage" : "Connect"}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Recent shows</Text>
        <View style={styles.list}>
          {RECENT_SHOWS.map((s, i) => (
            <View
              key={s.id}
              style={[
                styles.row,
                i < RECENT_SHOWS.length - 1 && styles.rowBorder,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{s.venue}</Text>
                <Text style={styles.rowMeta}>
                  {s.city}, {s.date}
                </Text>
              </View>
              <Text style={styles.showCount}>{s.attendance}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.signOut}
          hitSlop={BIG_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 12 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: C.text,
    letterSpacing: -0.3,
  },
  headerAction: { fontSize: 14, color: C.sub, fontWeight: "500" },

  identity: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 8,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  avatarText: { color: C.text, fontWeight: "600" },
  name: {
    fontSize: 22,
    fontWeight: "600",
    color: C.text,
    letterSpacing: -0.3,
  },
  sub: { fontSize: 13, color: C.muted, marginTop: 3 },
  tags: { fontSize: 13, color: C.sub, marginTop: 6 },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
    paddingVertical: 20,
    marginTop: 16,
    marginBottom: 24,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "600", color: C.text },
  statLabel: {
    fontSize: 11,
    color: C.muted,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  statDivider: { width: 1, height: 32, backgroundColor: C.border },

  sectionLabel: {
    fontSize: 12,
    color: C.muted,
    letterSpacing: 0.3,
    marginBottom: 8,
    marginTop: 8,
  },

  bio: {
    fontSize: 14,
    color: C.sub,
    lineHeight: 22,
    marginBottom: 24,
  },

  list: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  rowTitle: { fontSize: 15, fontWeight: "500", color: C.text },
  rowMeta: { fontSize: 13, color: C.muted, marginTop: 2 },
  rowAction: { fontSize: 13, color: C.sub, fontWeight: "500" },
  rowActionPrimary: { color: C.text, fontWeight: "600" },

  showCount: { fontSize: 14, color: C.text, fontWeight: "500" },

  signOut: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  signOutText: { fontSize: 14, color: C.negative, fontWeight: "500" },
});
