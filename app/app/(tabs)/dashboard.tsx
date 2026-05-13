import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
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

type Platform = {
  key: string;
  name: string;
  followers: number;
  delta7d: number;
  primaryLabel: string;
  primaryValue: number;
  connected: boolean;
};

const ME = { name: "Kira Noel" };

const PLATFORMS: Platform[] = [
  { key: "spotify",   name: "Spotify",      followers: 18400, delta7d: 4.2, primaryLabel: "Monthly listeners", primaryValue: 42800,  connected: true  },
  { key: "apple",     name: "Apple Music",  followers: 9200,  delta7d: 2.1, primaryLabel: "Plays (7d)",         primaryValue: 61200,  connected: true  },
  { key: "instagram", name: "Instagram",    followers: 26800, delta7d: 1.3, primaryLabel: "Reach (7d)",         primaryValue: 142000, connected: true  },
  { key: "youtube",   name: "YouTube",      followers: 0,     delta7d: 0,   primaryLabel: "Subscribers",        primaryValue: 0,      connected: false },
  { key: "tiktok",    name: "TikTok",       followers: 0,     delta7d: 0,   primaryLabel: "Views (7d)",         primaryValue: 0,      connected: false },
];

const ACTIVITY = [
  { id: 1, title: "Neon Requiem crossed 500K streams",     meta: "Spotify, 2h ago" },
  { id: 2, title: "New listener pocket in Mexico City",    meta: "+38% this week" },
  { id: 3, title: "Luca Osei sent you a collab request",   meta: "Collabs, 1d ago" },
  { id: 4, title: "Instagram reach up 22% week-over-week", meta: "Instagram, 1d ago" },
];

const BIG_HIT_SLOP = { top: 12, bottom: 12, left: 16, right: 16 };

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function connectedPlatforms(plats: Platform[]): Platform[] {
  return plats.filter((p) => p.connected);
}

function totalFollowers(plats: Platform[]): number {
  return connectedPlatforms(plats).reduce((sum, p) => sum + p.followers, 0);
}

// Weight each connected platform's 7-day delta by its follower share so the
// aggregate number reflects the platforms that drive most of the audience.
function weightedDelta(plats: Platform[]): number {
  const connected = connectedPlatforms(plats);
  const total = totalFollowers(plats);
  if (total === 0) return 0;
  return connected.reduce(
    (sum, p) => sum + p.delta7d * (p.followers / total),
    0,
  );
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Delta({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const up = pct >= 0;
  const color = up ? C.positive : C.negative;
  return (
    <Text style={[styles.delta, { color }]}>
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </Text>
  );
}

export default function Dashboard() {
  const [lastSync, setLastSync] = useState<string>(() => formatTime(new Date()));
  const total = totalFollowers(PLATFORMS);
  const totalDelta = weightedDelta(PLATFORMS);
  const connectedCount = connectedPlatforms(PLATFORMS).length;

  function onRefresh() {
    setLastSync(formatTime(new Date()));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.name}>{ME.name}</Text>
          <TouchableOpacity
            onPress={onRefresh}
            hitSlop={BIG_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Refresh dashboard"
          >
            <Text style={styles.refresh}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* The hero metric sums connected platforms and the delta is weighted by follower share. */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Total audience</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroValue}>{formatNumber(total)}</Text>
            <Delta pct={totalDelta} />
          </View>
          <Text style={styles.heroMeta}>
            {connectedCount} platforms connected, synced at {lastSync}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Platforms</Text>
        <View style={styles.list}>
          {PLATFORMS.map((p, i) => (
            <View
              key={p.key}
              style={[styles.row, i < PLATFORMS.length - 1 && styles.rowBorder]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{p.name}</Text>
                <Text style={styles.rowMeta}>
                  {p.connected
                    ? `${formatNumber(p.followers)} followers, ${p.primaryLabel.toLowerCase()} ${formatNumber(p.primaryValue)}`
                    : "Not connected"}
                </Text>
              </View>
              {p.connected && <Delta pct={p.delta7d} />}
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Activity</Text>
        <View style={styles.list}>
          {ACTIVITY.map((a, i) => (
            <View
              key={a.id}
              style={[styles.row, i < ACTIVITY.length - 1 && styles.rowBorder]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{a.title}</Text>
                <Text style={styles.rowMeta}>{a.meta}</Text>
              </View>
            </View>
          ))}
        </View>

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
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  name: { fontSize: 22, fontWeight: "600", color: C.text, letterSpacing: -0.3 },
  refresh: { fontSize: 14, color: C.sub, fontWeight: "500" },

  hero: {
    paddingVertical: 28,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
    marginBottom: 32,
  },
  heroLabel: {
    fontSize: 12,
    color: C.muted,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  heroRow: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  heroValue: {
    fontSize: 44,
    fontWeight: "600",
    color: C.text,
    letterSpacing: -1.2,
  },
  heroMeta: { fontSize: 13, color: C.muted, marginTop: 8 },

  sectionLabel: {
    fontSize: 12,
    color: C.muted,
    letterSpacing: 0.3,
    marginBottom: 8,
    marginTop: 8,
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

  delta: { fontSize: 13, fontWeight: "500" },
});
