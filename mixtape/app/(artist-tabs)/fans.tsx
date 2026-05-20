/*
 * Fans tab — global listener map.
 *
 * Fetches real fan location data from Supabase:
 *   fan_follows (artist_id = current user, consented_at not null)
 *   → joined to profiles (city, country)
 *   → aggregated by city
 *   → lat/lng resolved via country-state-city package
 *
 * Top song is currently a placeholder — replace with a real per-city
 * aggregation once fan_spotify_data is populated.
 */

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { LinearGradient } from "expo-linear-gradient";
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
  totalListens: number;
  topSong: string;
}

// ─── Coordinate lookup (built once at module load) ────────────────────────────

// Map country display name → ISO code so we can call getCitiesOfCountry
const COUNTRY_ISO: Record<string, string> = Object.fromEntries(
  Country.getAllCountries().map((c) => [c.name, c.isoCode])
);

function resolveCoords(
  cityName: string,
  countryName: string
): { lat: number; lng: number } | null {
  const iso = COUNTRY_ISO[countryName];
  if (!iso) return null;
  const match = City.getCitiesOfCountry(iso)?.find(
    (c) => c.name === cityName
  );
  if (!match?.latitude || !match?.longitude) return null;
  return {
    lat: parseFloat(match.latitude),
    lng: parseFloat(match.longitude),
  };
}

// ─── Dummy top song (replace when fan_spotify_data is wired up) ───────────────

const PLACEHOLDER_TOP_SONG = "Slow Burn";

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchMapData(artistId: string): Promise<CityData[]> {
  const { data, error } = await supabase
    .from("fan_follows")
    .select("fan_id, profiles!fan_follows_fan_id_fkey(city, country)")
    .eq("artist_id", artistId)
    .not("consented_at", "is", null);

  console.log("1. raw query error:", error);
  console.log("2. raw rows returned:", data?.length);
  console.log("3. sample row:", JSON.stringify(data?.[0]));

  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  const counts: Record<string, { city: string; country: string; count: number }> = {};

  for (const row of data as any[]) {
    const profile = row.profiles;
    console.log("4. profile on row:", JSON.stringify(profile));
    if (!profile?.city || !profile?.country) continue;
    const key = `${profile.city}||${profile.country}`;
    if (!counts[key]) {
      counts[key] = { city: profile.city, country: profile.country, count: 0 };
    }
    counts[key].count += 1;
  }

  console.log("5. aggregated cities:", JSON.stringify(counts));

  const result: CityData[] = [];
  let id = 1;

  for (const { city, country, count } of Object.values(counts)) {
    const coords = resolveCoords(city, country);
    console.log(`6. coords for ${city}, ${country}:`, coords);
    if (!coords) continue;
    result.push({ id: id++, city, country, lat: coords.lat, lng: coords.lng,
      monthlyListeners: count, totalListens: count * 7, topSong: PLACEHOLDER_TOP_SONG });
  }

  console.log("7. final result length:", result.length);
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
    .pulse-ring {
      border-radius: 50%;
      animation: pulse 2.2s ease-out infinite;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', {
      center: [20, 10], zoom: 2, minZoom: 1.5, maxZoom: 8,
      zoomControl: false, attributionControl: false,
    });
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 19 }
    ).addTo(map);

    const data = ${JSON.stringify(data)};
    const maxL = ${maxL};
    const minL = ${minL};
    const range = maxL - minL || 1;

    function getColor(listeners) {
      const t = (listeners - minL) / range;
      return \`rgb(\${Math.round(t*255)},\${Math.round(220-t*220)},\${Math.round(200+t*55)})\`;
    }
    function getRadius(listeners) {
      return 7 + ((listeners - minL) / range) * 20;
    }

    data.forEach(city => {
      const color  = getColor(city.monthlyListeners);
      const radius = getRadius(city.monthlyListeners);
      const ringSize = radius * 2 + 20;

      L.marker([city.lat, city.lng], {
        icon: L.divIcon({
          className: '',
          html: \`<div class="pulse-ring" style="
            width:\${ringSize}px;height:\${ringSize}px;
            background:\${color};opacity:0.3;
            margin-left:\${-ringSize/2}px;margin-top:\${-ringSize/2}px;
          "></div>\`,
          iconSize: [0, 0],
        }),
        interactive: false,
      }).addTo(map);

      L.circleMarker([city.lat, city.lng], {
        radius, fillColor: color, color: '#fff',
        weight: 1.5, opacity: 0.9, fillOpacity: 0.85,
      }).addTo(map).on('click', () => {
        window.ReactNativeWebView?.postMessage(JSON.stringify(city));
      });
    });
  </script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FansTab() {
  const [mapData, setMapData] = useState<CityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CityData | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Wait for a valid session rather than assuming one exists
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
  
    // Listen for auth state to be confirmed before loading
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          subscription.unsubscribe();
          load();
        }
      }
    );
  
    // Also try immediately in case session is already ready
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
        {!loading && !error && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {formatNumber(totalFans)} listener{totalFans !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </View>

      {/* Map / loading / error states */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <Text style={styles.centeredText}>Loading fan locations…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.centeredText}>⚠ {error}</Text>
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

      {/* Legend */}
      {!loading && !error && mapData.length > 0 && (
        <View style={styles.legend}>
          <Text style={styles.legendLabel}>Fewer listeners</Text>
          <LinearGradient
            colors={["#00dcc8", "#ff00cc"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.legendBar}
          />
          <Text style={styles.legendLabel}>More listeners</Text>
        </View>
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
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  style={styles.closeBtn}
                >
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <View style={styles.statsRow}>
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>
                    {selected ? formatNumber(selected.monthlyListeners) : "—"}
                  </Text>
                  <Text style={styles.statLabel}>{"Listeners\nThis Month"}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>
                    {selected ? formatNumber(selected.totalListens) : "—"}
                  </Text>
                  <Text style={styles.statLabel}>{"Est. Total\nListens"}</Text>
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

  legend: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.colors.darkBackground,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  legendBar: { flex: 1, height: 6, borderRadius: 3 },
  legendLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.darkMuted,
    letterSpacing: 0.3,
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
  closeText: {
    fontFamily: theme.fonts.ui,
    fontSize: 14,
    color: theme.colors.darkMuted,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 16,
  },
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
