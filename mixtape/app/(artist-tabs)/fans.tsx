/*
 * Fans tab — global listener map with expandable top cities panel.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { Country, City } from "country-state-city";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CityData {
  id: number;
  city: string;
  country: string;
  lat: number;
  lng: number;
  monthlyListeners: number;
  topSong: string;
}

// ─── Shared color helper (used by both Leaflet HTML and the city panel) ────────

function getDotColor(listeners: number, minL: number, maxL: number): string {
  const t = (listeners - minL) / (maxL - minL || 1);
  const r = Math.round(t * 255);
  const g = Math.round(220 - t * 220);
  const b = Math.round(200 + t * 55);
  return `rgb(${r},${g},${b})`;
}

// ─── Coordinate lookup ────────────────────────────────────────────────────────

const COUNTRY_ISO: Record<string, string> = Object.fromEntries(
  Country.getAllCountries().map((c) => [c.name, c.isoCode])
);

function resolveCoords(
  cityName: string,
  countryName: string
): { lat: number; lng: number } | null {
  const iso = COUNTRY_ISO[countryName];
  if (!iso) return null;
  const match = City.getCitiesOfCountry(iso)?.find((c) => c.name === cityName);
  if (!match?.latitude || !match?.longitude) return null;
  return { lat: parseFloat(match.latitude), lng: parseFloat(match.longitude) };
}


// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchMapData(artistId: string): Promise<CityData[]> {
  const { data, error } = await supabase
    .from("fan_follows")
    .select("fan_id, top_track, profiles!fan_follows_fan_id_fkey(city, country)")
    .eq("artist_id", artistId)
    .not("consented_at", "is", null);

  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  const counts: Record<string, {
    city: string;
    country: string;
    count: number;
    tracks: string[];
  }> = {};

  for (const row of data as any[]) {
    const profile = row.profiles;
    if (!profile?.city || !profile?.country) continue;
    const key = `${profile.city}||${profile.country}`;
    if (!counts[key]) {
      counts[key] = { city: profile.city, country: profile.country, count: 0, tracks: [] };
    }
    counts[key].count += 1;
    if (row.top_track) counts[key].tracks.push(row.top_track);
  }

  const result: CityData[] = [];
  let id = 1;

  for (const { city, country, count, tracks } of Object.values(counts)) {
    const coords = resolveCoords(city, country);
    if (!coords) continue;

    // Find the most frequently occurring top_track for this city
    const topSong = tracks.length > 0
      ? Object.entries(
          tracks.reduce<Record<string, number>>((acc, t) => {
            acc[t] = (acc[t] ?? 0) + 1;
            return acc;
          }, {})
        ).sort((a, b) => b[1] - a[1])[0][0]
      : "—";

    result.push({
      id: id++,
      city,
      country,
      lat: coords.lat,
      lng: coords.lng,
      monthlyListeners: count,
      topSong,
    });
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
}

// ─── Leaflet HTML ─────────────────────────────────────────────────────────────

function buildMapHTML(data: CityData[]): string {
  if (!data.length) return `
    <!DOCTYPE html><html><body style="margin:0;background:#0d1117;
    display:flex;align-items:center;justify-content:center;height:100vh;">
    <p style="color:#8892a4;font-family:sans-serif;font-size:14px;">
      No location data yet
    </p></body></html>`;

  const maxL = Math.max(...data.map((d) => d.monthlyListeners));
  const minL = Math.min(...data.map((d) => d.monthlyListeners));

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0d1117; }
    #map { width: 100vw; height: 100vh; }
    .leaflet-control-attribution { display: none; }
    @keyframes pulse {
      0%   { transform: scale(1);   opacity: 0.7; }
      50%  { transform: scale(1.5); opacity: 0.2; }
      100% { transform: scale(1);   opacity: 0.7; }
    }
    .pulse-ring { border-radius: 50%; animation: pulse 2.2s ease-out infinite; pointer-events: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', {
      center: [20, 10], zoom: 2, minZoom: 1.5, maxZoom: 8,
      zoomControl: false, attributionControl: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

    const data = ${JSON.stringify(data)};
    const maxL = ${maxL};
    const minL = ${minL};
    const range = maxL - minL || 1;

    function getColor(listeners) {
      const t = (listeners - minL) / range;
      return \`rgb(\${Math.round(t*255)},\${Math.round(220-t*220)},\${Math.round(200+t*55)})\`;
    }
    function getRadius(listeners) { return 7 + ((listeners - minL) / range) * 20; }

    data.forEach(city => {
      const color  = getColor(city.monthlyListeners);
      const radius = getRadius(city.monthlyListeners);
      const ringSize = radius * 2 + 20;
      L.marker([city.lat, city.lng], {
        icon: L.divIcon({
          className: '',
          html: \`<div class="pulse-ring" style="width:\${ringSize}px;height:\${ringSize}px;background:\${color};opacity:0.3;margin-left:\${-ringSize/2}px;margin-top:\${-ringSize/2}px;"></div>\`,
          iconSize: [0, 0],
        }),
        interactive: false,
      }).addTo(map);
      L.circleMarker([city.lat, city.lng], {
        radius, fillColor: color, color: '#fff', weight: 1.5, opacity: 0.9, fillOpacity: 0.85,
      }).addTo(map).on('click', () => {
        window.ReactNativeWebView?.postMessage(JSON.stringify(city));
      });
    });
  </script>
</body>
</html>`;
}

// ─── Top Cities Panel ─────────────────────────────────────────────────────────

const COLLAPSED_H = 52;
const EXPANDED_H  = 340;

function TopCitiesPanel({
  data,
  initiallyExpanded = false,
}: {
  data: CityData[];
  initiallyExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const animH = useRef(
    new Animated.Value(initiallyExpanded ? EXPANDED_H : COLLAPSED_H)
  ).current;

  function toggle() {
    Animated.spring(animH, {
      toValue: expanded ? COLLAPSED_H : EXPANDED_H,
      useNativeDriver: false,
      bounciness: 0,
      speed: 18,
    }).start();
    setExpanded((e) => !e);
  }

  const sorted = [...data].sort((a, b) => b.monthlyListeners - a.monthlyListeners);
  const maxL = sorted[0]?.monthlyListeners ?? 1;
  const minL = sorted[sorted.length - 1]?.monthlyListeners ?? 0;

  return (
    <Animated.View style={[panelStyles.container, { height: animH }]}>
      {/* Handle / toggle row */}
      <TouchableOpacity
        style={panelStyles.handle}
        onPress={toggle}
        activeOpacity={0.8}
      >
        <Text style={panelStyles.handleText}>VIEW YOUR TOP CITIES</Text>
        <Ionicons
          name={expanded ? "chevron-down" : "chevron-up"}
          size={16}
          color={theme.colors.darkMuted}
        />
      </TouchableOpacity>

      {/* City list — only rendered when panel has space */}
      {expanded && (
        <ScrollView
          style={panelStyles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {sorted.map((item, index) => {
            const pct = maxL > 0 ? item.monthlyListeners / maxL : 0;
            const color = getDotColor(item.monthlyListeners, minL, maxL);
            const rank = String(index + 1).padStart(2, "0");

            return (
              <View key={item.id} style={panelStyles.row}>
                <Text style={panelStyles.rank}>{rank}</Text>

                <View style={panelStyles.cityBlock}>
                  <Text style={panelStyles.cityName}>
                    {item.city}, {item.country}
                  </Text>
                  {/* Colored bar */}
                  <View style={panelStyles.barTrack}>
                    <View
                      style={[
                        panelStyles.barFill,
                        { width: `${Math.round(pct * 100)}%`, backgroundColor: color },
                      ]}
                    />
                  </View>
                </View>

                <Text style={panelStyles.count}>
                  {formatNumber(item.monthlyListeners)}
                </Text>
              </View>
            );
          })}
          {/* Bottom padding inside scroll */}
          <View style={{ height: 12 }} />
        </ScrollView>
      )}
    </Animated.View>
  );
}

const panelStyles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.darkBackground,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  handle: {
    height: COLLAPSED_H,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  handleText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
    letterSpacing: 0.4,
  },
  list: {
    flex: 1,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    gap: 12,
  },
  rank: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
    width: 22,
  },
  cityBlock: {
    flex: 1,
    gap: 6,
  },
  cityName: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  count: {
    fontFamily: theme.fonts.sansBold,
    fontSize: theme.fontSizes.subtitle,
    color: theme.colors.darkText,
    minWidth: 40,
    textAlign: "right",
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function FansTab() {
  const [mapData, setMapData] = useState<CityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CityData | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("Not signed in");
        const cities = await fetchMapData(session.user.id);
        setMapData(cities);
      } catch (e: any) {
        setError(e.message ?? "Failed to load fan data");
      } finally {
        setLoading(false);
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          subscription.unsubscribe();
          load();
        }
      }
    );

    load().catch(() => {});
    return () => subscription.unsubscribe();
  }, []);

  function handleMessage(event: { nativeEvent: { data: string } }) {
    try { setSelected(JSON.parse(event.nativeEvent.data)); } catch {}
  }

  const totalFans = mapData.reduce((sum, c) => sum + c.monthlyListeners, 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>FANS</Text>
          <Text style={styles.headerTitle}>Listener Map</Text>
        </View>
        {!loading && !error && totalFans > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {formatNumber(totalFans)} listener{totalFans !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </View>

      {/* Map / loading / error */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <Text style={styles.centeredText}>Loading fan locations…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.centeredText}>⚠ {error}</Text>
        </View>
      ) : Platform.OS === "web" ? (
        // react-native-webview has no web implementation, so the Leaflet map
        // can't render in the browser build. Show the cities list instead.
        <View style={[styles.map, styles.webFallback]}>
          <Ionicons name="map-outline" size={40} color={theme.colors.darkMuted} />
          <Text style={styles.webFallbackText}>
            The interactive listener map runs on iOS and Android. Your cities are
            listed below.
          </Text>
        </View>
      ) : (
        <WebView
          style={styles.map}
          originWhitelist={["*"]}
          source={{ html: buildMapHTML(mapData) }}
          onMessage={handleMessage}
          scrollEnabled={false}
          javaScriptEnabled
        />
      )}

      {/* Expandable top cities panel (replaces legend) */}
      {!loading && !error && (
        <TopCitiesPanel data={mapData} initiallyExpanded={Platform.OS === "web"} />
      )}

      {/* City detail modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setSelected(null)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cityName}>{selected?.city}</Text>
                  <Text style={styles.countryName}>{selected?.country}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <View style={styles.statsRow}>
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>
                    {selected ? formatNumber(selected.monthlyListeners) : "—"}
                  </Text>
                  <Text style={styles.statLabel}>{"Sharing\nFans"}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>
                    {selected && totalFans
                      ? `${Math.round((selected.monthlyListeners / totalFans) * 100)}%`
                      : "—"}
                  </Text>
                  <Text style={styles.statLabel}>{"Share of\nyour fans"}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.topSongRow}>
                <Text style={styles.topSongLabel}>🎵  Top Song</Text>
                <Text style={styles.topSongValue}>"{selected?.topSong}"</Text>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.darkBackground },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: theme.colors.darkBackground,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.subtitle,
    color: theme.colors.darkText,
  },
  headerBadge: {
    backgroundColor: theme.colors.darkCard,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerBadgeText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 0.5,
  },
  map: { flex: 1 },
  webFallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  webFallbackText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: theme.colors.darkBackground,
  },
  centeredText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkMuted,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
  },
  card: {
    backgroundColor: theme.colors.darkCard,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  cityName: {
    fontFamily: theme.fonts.sansBold,
    fontSize: 26,
    color: theme.colors.darkText,
    letterSpacing: 0.5,
  },
  countryName: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontFamily: theme.fonts.ui, fontSize: 14, color: theme.colors.darkMuted },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 16 },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statBlock: { flex: 1, alignItems: "center", gap: 6 },
  statValue: {
    fontFamily: theme.fonts.sansBold,
    fontSize: 32,
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  statLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    textAlign: "center",
    letterSpacing: 0.5,
    lineHeight: 17,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: 16,
  },
  topSongRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topSongLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.darkMuted,
    letterSpacing: 0.5,
  },
  topSongValue: {
    fontFamily: theme.fonts.sansItalic,
    fontSize: theme.fontSizes.body,
    color: theme.colors.darkText,
  },
});
