import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';

// Dataset

const CITY_DATA = [
  { id: 1,  city: 'New York',     country: 'USA',          lat: 40.7128,  lng: -74.0060,  monthlyListeners: 482000, totalListens: 3200000, topSong: 'Neon Requiem'      },
  { id: 2,  city: 'Los Angeles',  country: 'USA',          lat: 34.0522,  lng: -118.2437, monthlyListeners: 391000, totalListens: 2800000, topSong: 'Pacific Drive'      },
  { id: 3,  city: 'London',       country: 'UK',           lat: 51.5074,  lng: -0.1278,   monthlyListeners: 520000, totalListens: 4100000, topSong: 'Grey Skies'         },
  { id: 4,  city: 'Tokyo',        country: 'Japan',        lat: 35.6762,  lng: 139.6503,  monthlyListeners: 610000, totalListens: 5200000, topSong: 'Shibuya Drift'      },
  { id: 5,  city: 'São Paulo',    country: 'Brazil',       lat: -23.5505, lng: -46.6333,  monthlyListeners: 280000, totalListens: 1900000, topSong: 'Carnival Lights'    },
  { id: 6,  city: 'Lagos',        country: 'Nigeria',      lat: 6.5244,   lng: 3.3792,    monthlyListeners: 175000, totalListens: 980000,  topSong: 'Lagos Heat'         },
  { id: 7,  city: 'Mumbai',       country: 'India',        lat: 19.0760,  lng: 72.8777,   monthlyListeners: 430000, totalListens: 3600000, topSong: 'Monsoon Season'     },
  { id: 8,  city: 'Berlin',       country: 'Germany',      lat: 52.5200,  lng: 13.4050,   monthlyListeners: 310000, totalListens: 2200000, topSong: 'Techno Lullaby'     },
  { id: 9,  city: 'Sydney',       country: 'Australia',    lat: -33.8688, lng: 151.2093,  monthlyListeners: 198000, totalListens: 1400000, topSong: 'Harbour Light'      },
  { id: 10, city: 'Toronto',      country: 'Canada',       lat: 43.6532,  lng: -79.3832,  monthlyListeners: 245000, totalListens: 1750000, topSong: 'Winter Drive'       },
  { id: 11, city: 'Seoul',        country: 'South Korea',  lat: 37.5665,  lng: 126.9780,  monthlyListeners: 380000, totalListens: 2900000, topSong: 'Neon Seoul'         },
  { id: 12, city: 'Mexico City',  country: 'Mexico',       lat: 19.4326,  lng: -99.1332,  monthlyListeners: 220000, totalListens: 1600000, topSong: 'Mirage'             },
  { id: 13, city: 'Paris',        country: 'France',       lat: 48.8566,  lng: 2.3522,    monthlyListeners: 340000, totalListens: 2600000, topSong: 'Grey Skies'         },
  { id: 14, city: 'Cairo',        country: 'Egypt',        lat: 30.0444,  lng: 31.2357,   monthlyListeners: 142000, totalListens: 890000,  topSong: 'Desert Rose'        },
  { id: 15, city: 'Buenos Aires', country: 'Argentina',    lat: -34.6037, lng: -58.3816,  monthlyListeners: 167000, totalListens: 1100000, topSong: 'Carnival Lights'    },
  { id: 16, city: 'Jakarta',      country: 'Indonesia',    lat: -6.2088,  lng: 106.8456,  monthlyListeners: 295000, totalListens: 2050000, topSong: 'Monsoon Season'     },
  { id: 17, city: 'Chicago',      country: 'USA',          lat: 41.8781,  lng: -87.6298,  monthlyListeners: 215000, totalListens: 1530000, topSong: 'Neon Requiem'       },
  { id: 18, city: 'Istanbul',     country: 'Turkey',       lat: 41.0082,  lng: 28.9784,   monthlyListeners: 188000, totalListens: 1320000, topSong: 'Desert Rose'        },
  { id: 19, city: 'Johannesburg', country: 'South Africa', lat: -26.2041, lng: 28.0473,   monthlyListeners: 130000, totalListens: 760000,  topSong: 'Lagos Heat'         },
  { id: 20, city: 'Singapore',    country: 'Singapore',    lat: 1.3521,   lng: 103.8198,  monthlyListeners: 270000, totalListens: 1880000, topSong: 'Shibuya Drift'      },
];

type CityData = (typeof CITY_DATA)[0];

// Helpers

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
  return n.toString();
}

// Leaflet HTML injected into the WebView

function buildMapHTML(data: typeof CITY_DATA): string {
  const maxL = Math.max(...data.map(d => d.monthlyListeners));
  const minL = Math.min(...data.map(d => d.monthlyListeners));

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #080c14; }
    #map { width: 100vw; height: 100vh; }

    /* hide default Leaflet attribution */
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
      center: [20, 10],
      zoom: 2,
      minZoom: 1.5,
      maxZoom: 8,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 19 }
    ).addTo(map);

    const data     = ${JSON.stringify(data)};
    const maxL     = ${maxL};
    const minL     = ${minL};

    // Colors ramp from teal (low listeners) to magenta (high listeners).
    function getColor(listeners) {
      const t = (listeners - minL) / (maxL - minL);
      const r = Math.round(0   + t * 255);
      const g = Math.round(220 - t * 220);
      const b = Math.round(200 + t * 55);
      return \`rgb(\${r},\${g},\${b})\`;
    }

    function getRadius(listeners) {
      const t = (listeners - minL) / (maxL - minL);
      return 7 + t * 20; // 7px to 27px
    }

    data.forEach(city => {
      const color  = getColor(city.monthlyListeners);
      const radius = getRadius(city.monthlyListeners);

      // Outer pulsing ring (non-interactive div icon)
      const ringSize = radius * 2 + 20;
      const ringIcon = L.divIcon({
        className: '',
        html: \`<div class="pulse-ring" style="
          width:\${ringSize}px; height:\${ringSize}px;
          background:\${color}; opacity:0.3;
          margin-left:\${-ringSize/2}px; margin-top:\${-ringSize/2}px;
        "></div>\`,
        iconSize: [0, 0],
      });
      L.marker([city.lat, city.lng], { icon: ringIcon, interactive: false }).addTo(map);

      // Solid dot
      const circle = L.circleMarker([city.lat, city.lng], {
        radius:      radius,
        fillColor:   color,
        color:       '#fff',
        weight:      1.5,
        opacity:     0.9,
        fillOpacity: 0.85,
      }).addTo(map);

      circle.on('click', () => {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify(city)
        );
      });
    });
  </script>
</body>
</html>
  `;
}

// Component

export default function Index() {
  const [selected, setSelected] = useState<CityData | null>(null);

  function handleMessage(event: { nativeEvent: { data: string } }) {
    try {
      const city: CityData = JSON.parse(event.nativeEvent.data);
      setSelected(city);
    } catch {}
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080c14" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>LISTENER MAP</Text>
        <Text style={styles.headerSub}>Tap a hotspot to see stats</Text>
      </View>

      {/* Map */}
      {Platform.OS === 'web' ? (
        // react-native-webview does not support web. Render a plain iframe so
        // the map still shows in browsers. The marker-click bridge only works
        // on native, so web users see the map without the detail modal.
        <View style={styles.map}>
          {/* The iframe is not part of React Native's JSX types, so we cast the
              element through `any`. It still fills its parent through CSS. */}
          {(() => {
            const IFrame = 'iframe' as unknown as React.ComponentType<any>;
            return (
              <IFrame
                srcDoc={buildMapHTML(CITY_DATA)}
                style={{ border: 0, width: '100%', height: '100%' }}
              />
            );
          })()}
        </View>
      ) : (
        <WebView
          style={styles.map}
          originWhitelist={['*']}
          source={{ html: buildMapHTML(CITY_DATA) }}
          onMessage={handleMessage}
          scrollEnabled={false}
          javaScriptEnabled
        />
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendLabel}>Fewer listeners</Text>
        <LinearGradient
          colors={['#00dcc8', '#ff00cc']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.legendBar}
        />
        <Text style={styles.legendLabel}>More listeners</Text>
      </View>

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
              {/* City name */}
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

              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>
                    {selected ? formatNumber(selected.monthlyListeners) : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Monthly{'\n'}Listeners</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>
                    {selected ? formatNumber(selected.totalListens) : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Total{'\n'}Listens</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Top Song */}
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

// Styles

const BG      = '#080c14';
const CARD_BG = '#111827';
const ACCENT  = '#00dcc8';
const TEXT    = '#f0f4ff';
const MUTED   = '#8892a4';
const BORDER  = '#1e2d40';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    color: ACCENT,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
  },
  headerSub: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.5,
  },

  // Map
  map: {
    flex: 1,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    gap: 10,
  },
  legendBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    // teal to magenta gradient approximated
    backgroundColor: '#00dcc8',
    // React Native doesn't support linear-gradient natively without expo-linear-gradient
    // so we use a simple color here; swap for LinearGradient if desired
  },
  legendLabel: {
    color: MUTED,
    fontSize: 10,
    letterSpacing: 0.3,
  },

  // Modal overlay
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },

  // Card
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cityName: {
    color: TEXT,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  countryName: {
    color: MUTED,
    fontSize: 14,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
  },

  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 16,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    color: ACCENT,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statLabel: {
    color: MUTED,
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 17,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: BORDER,
    marginHorizontal: 16,
  },

  // Top song
  topSongRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topSongLabel: {
    color: MUTED,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  topSongValue: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '600',
    fontStyle: 'italic',
  },
});
