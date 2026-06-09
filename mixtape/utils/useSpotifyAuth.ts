/*
 * Spotify OAuth + listening-data hook.
 *
 * Drives the Spotify Authorization Code (PKCE) flow via expo-auth-session,
 * exchanges the code for an access token, fetches the fan's profile, top
 * tracks, top artists, and recently played, and persists that snapshot to the
 * `fan_spotify_data` table. See REDIRECT_URI below for the redirect-URI config
 * that the Spotify dashboard must match (issue #30).
 */

import { useEffect, useState } from "react";
import {
  useAuthRequest,
  ResponseType,
  makeRedirectUri,
} from "expo-auth-session";

import { supabase } from "@/database/db";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Config

/*
 * Spotify requires the redirect URI to EXACTLY match one of the URIs registered
 * in the Spotify Developer Dashboard. A bare `makeRedirectUri()` derives the URI
 * from the local Expo dev-server address (e.g. exp://192.168.1.5:8081), which
 * changes between machines, networks, and runs — causing "INVALID_CLIENT: Invalid
 * redirect URI" errors (see issue #30).
 *
 * To make the redirect stable we, in order of preference:
 *   1. Use EXPO_PUBLIC_SPOTIFY_REDIRECT_URI when set. Put the exact value you
 *      registered in the Spotify dashboard here (e.g. a deployed https callback
 *      or "mixtape://spotify-auth-callback").
 *   2. Otherwise derive a deterministic URI from the app's own custom scheme
 *      ("mixtape", declared in app.json), yielding "mixtape://spotify-auth-callback".
 *      This is stable across runs/devices in a dev or production build.
 *
 * Whichever value this resolves to MUST be added to the app's Redirect URIs in
 * the Spotify Developer Dashboard. Log it once on startup so it is easy to copy.
 */
const REDIRECT_URI =
  process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI ??
  makeRedirectUri({ scheme: "mixtape", path: "spotify-auth-callback" });
const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID!;

if (__DEV__) {
  console.log("[Spotify] Redirect URI (register this in the dashboard):", REDIRECT_URI);
}

const SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
];

const DISCOVERY = {
  authorizationEndpoint: "https://accounts.spotify.com/authorize",
  tokenEndpoint: "https://accounts.spotify.com/api/token",
};

const ENDPOINTS = {
  me: "https://api.spotify.com/v1/me",
  topTracks: "https://api.spotify.com/v1/me/top/tracks",
  topArtists: "https://api.spotify.com/v1/me/top/artists",
  recentlyPlayed: "https://api.spotify.com/v1/me/player/recently-played",
};

// Types

export interface FanSpotifyData {
  profile: {
    id: string;
    display_name: string;
    country: string;
    email: string;
  } | null;
  topTracks: SpotifyApi.TrackObjectFull[];
  topArtists: SpotifyApi.ArtistObjectFull[];
  recentlyPlayed: SpotifyApi.PlayHistoryObject[];
}

// Token reuse
//
// The OAuth access token lives only in hook state, so once the connect-music
// screen unmounts there is no way to refresh a fan's listening data without a
// brand-new OAuth. We persist the most recent access token (Spotify tokens last
// ~1 hour) so a later step in the same session -- notably share-consent -- can
// re-sync the fan's data without sending them back through Spotify.

const TOKEN_KEY = "spotify_access_token";
const TOKEN_AT_KEY = "spotify_access_token_at";
const TOKEN_MAX_AGE_MS = 55 * 60 * 1000; // stay inside Spotify's ~60m expiry

async function persistAccessToken(token: string): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [TOKEN_AT_KEY, String(Date.now())],
    ]);
  } catch {
    // Non-fatal: the token just won't be reusable later.
  }
}

// Returns a still-valid stored access token, or null if missing/expired.
export async function getStoredSpotifyToken(): Promise<string | null> {
  try {
    const [[, token], [, at]] = await AsyncStorage.multiGet([
      TOKEN_KEY,
      TOKEN_AT_KEY,
    ]);
    if (!token || !at) return null;
    if (Date.now() - Number(at) > TOKEN_MAX_AGE_MS) return null;
    return token;
  } catch {
    return null;
  }
}

// Fetch the fan's Spotify listening data and upsert it into Supabase. Shared by
// the OAuth hook (right after connecting) and the share-consent step (re-sync on
// the stored token). Returns the fetched data, or null if there is no user.
export async function syncFanSpotifyData(
  token: string,
): Promise<FanSpotifyData | null> {
  const data = await fetchFanData(token);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return data;

  const { error } = await supabase.from("fan_spotify_data").upsert(
    {
      fan_id: user.id,
      profile: data.profile,
      top_tracks: data.topTracks,
      top_artists: data.topArtists,
      recently_played: data.recentlyPlayed,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "fan_id" },
  );

  if (error) {
    console.error("Failed to save Spotify data:", error.message);
  } else {
    console.log("Spotify data saved to Supabase.");
  }
  return data;
}

// Hook

export function useSpotifyAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [fanData, setFanData] = useState<FanSpotifyData | null>(null);
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsync] = useAuthRequest(
    {
      responseType: ResponseType.Code,
      clientId: CLIENT_ID,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
      usePKCE: true,
    },
    DISCOVERY,
  );

  // Step 1: Exchange code for token when auth completes
  useEffect(() => {
    if (response?.type === "success" && request?.codeVerifier) {
      const { code } = response.params;
      if (code) {
        setLoading(true);
        exchangeCodeForToken(code, request.codeVerifier)
          .then((token) => {
            if (token) {
              setAccessToken(token);
              persistAccessToken(token);
              console.log("Spotify connected. Access token received.");
            } else {
              console.error("Token exchange returned null.");
            }
          })
          .catch((e) => console.error("Token exchange failed:", e))
          .finally(() => setLoading(false));
      }
    }

    if (response?.type === "error") {
      console.error("Spotify auth error:", response.error);
    }

    if (response?.type === "dismiss") {
      console.log("Spotify auth dismissed by user.");
    }
  }, [response, request]);

  // Step 2: Fetch + persist fan data once we have a token
  useEffect(() => {
    if (!accessToken) return;

    setLoading(true);
    syncFanSpotifyData(accessToken)
      .then((data) => {
        setFanData(data);
        if (data) {
          console.log(
            "Spotify data synced:",
            data.profile?.display_name,
            "-",
            `${data.topTracks.length} tracks, ${data.topArtists.length} artists`,
          );
        }
      })
      .catch((e) => console.error("Failed to sync fan data:", e))
      .finally(() => setLoading(false));
  }, [accessToken]);

  return { accessToken, fanData, loading, request, promptAsync };
}

// Token exchange

async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
): Promise<string | null> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const res = await fetch(DISCOVERY.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();

  if (data.error) {
    console.error(
      "Spotify token error:",
      data.error,
      data.error_description,
    );
    return null;
  }

  return data.access_token;
}

// Fan data fetching

async function spotifyGet<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Spotify API error ${res.status} on ${url}`);
  }

  return res.json();
}

async function fetchFanData(token: string): Promise<FanSpotifyData> {
  const [profile, topTracksRes, topArtistsRes, recentlyPlayedRes] =
    await Promise.all([
      spotifyGet<any>(ENDPOINTS.me, token),
      spotifyGet<SpotifyApi.UsersTopTracksResponse>(
        `${ENDPOINTS.topTracks}?time_range=medium_term&limit=50`,
        token,
      ),
      spotifyGet<SpotifyApi.UsersTopArtistsResponse>(
        `${ENDPOINTS.topArtists}?time_range=medium_term&limit=50`,
        token,
      ),
      spotifyGet<SpotifyApi.UsersRecentlyPlayedTracksResponse>(
        `${ENDPOINTS.recentlyPlayed}?limit=50`,
        token,
      ),
    ]);

  return {
    profile: {
      id: profile.id,
      display_name: profile.display_name,
      country: profile.country,
      email: profile.email,
    },
    topTracks: topTracksRes.items ?? [],
    topArtists: topArtistsRes.items ?? [],
    recentlyPlayed: recentlyPlayedRes.items ?? [],
  };
}
