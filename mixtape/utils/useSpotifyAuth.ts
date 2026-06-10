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
 * changes between machines, networks, and runs - causing "INVALID_CLIENT: Invalid
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
const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? "";

if (__DEV__) {
  console.log(
    "[Spotify] Redirect URI (register this in the dashboard):",
    REDIRECT_URI,
  );
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

interface SpotifyTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

// Token reuse
//
// Spotify access tokens are short-lived. Persist the access token, expiry, and
// refresh token so a later re-sync can refresh quietly instead of forcing a new
// OAuth round trip whenever the original one-hour access token expires.

const TOKEN_KEY = "spotify_access_token";
const TOKEN_AT_KEY = "spotify_access_token_at";
const TOKEN_EXPIRES_AT_KEY = "spotify_access_token_expires_at";
const TOKEN_REFRESH_KEY = "spotify_refresh_token";
const TOKEN_MAX_AGE_MS = 55 * 60 * 1000; // legacy fallback for old stored tokens
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export function isSpotifyConfigured(): boolean {
  return CLIENT_ID.trim().length > 0;
}

export function getSpotifyRedirectUri(): string {
  return REDIRECT_URI;
}

function normalizeSpotifyToken(
  token: string | null | undefined,
): string | null {
  if (!token) return null;

  const trimmed = token.trim();
  if (!trimmed) return null;

  return trimmed.replace(/^Bearer\s+/i, "").trim();
}

async function persistTokenResponse(
  tokens: SpotifyTokenResponse,
  fallbackRefreshToken?: string | null,
): Promise<string | null> {
  const accessToken = normalizeSpotifyToken(tokens.access_token);
  if (!accessToken) return null;

  const expiresInMs = Math.max((tokens.expires_in ?? 3600) * 1000, 0);
  const refreshToken = tokens.refresh_token ?? fallbackRefreshToken;
  const rows: [string, string][] = [
    [TOKEN_KEY, accessToken],
    [TOKEN_AT_KEY, String(Date.now())],
    [TOKEN_EXPIRES_AT_KEY, String(Date.now() + expiresInMs)],
  ];

  if (refreshToken) rows.push([TOKEN_REFRESH_KEY, refreshToken]);

  try {
    await AsyncStorage.multiSet(rows);
  } catch {
    // Non-fatal: the token just won't be reusable later.
  }
  return accessToken;
}

export async function clearStoredSpotifyToken(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      TOKEN_KEY,
      TOKEN_AT_KEY,
      TOKEN_EXPIRES_AT_KEY,
      TOKEN_REFRESH_KEY,
    ]);
  } catch {
    // Non-fatal cleanup.
  }
}

// Returns a valid stored access token, refreshing it when possible.
export async function getStoredSpotifyToken(): Promise<string | null> {
  try {
    const [[, token], [, at], [, expiresAt], [, refreshToken]] =
      await AsyncStorage.multiGet([
        TOKEN_KEY,
        TOKEN_AT_KEY,
        TOKEN_EXPIRES_AT_KEY,
        TOKEN_REFRESH_KEY,
      ]);
    const normalizedToken = normalizeSpotifyToken(token);
    const expiry = Number(expiresAt);

    if (
      normalizedToken &&
      Number.isFinite(expiry) &&
      Date.now() < expiry - TOKEN_EXPIRY_BUFFER_MS
    ) {
      return normalizedToken;
    }

    const legacyIssuedAt = Number(at);
    if (
      normalizedToken &&
      !expiresAt &&
      Number.isFinite(legacyIssuedAt) &&
      Date.now() - legacyIssuedAt < TOKEN_MAX_AGE_MS
    ) {
      return normalizedToken;
    }

    if (refreshToken) {
      return refreshSpotifyAccessToken(refreshToken);
    }

    return null;
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
  const normalizedToken = normalizeSpotifyToken(token);

  if (!normalizedToken) {
    throw new Error(
      "No Spotify access token available. Please reconnect Spotify.",
    );
  }

  if (__DEV__) {
    console.log("[Spotify] Sync starting.", {
      hasToken: true,
      tokenLength: normalizedToken.length,
      tokenStart: normalizedToken.slice(0, 12),
    });
  }

  const data = await fetchFanData(normalizedToken);
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
  const [error, setError] = useState<string | null>(
    isSpotifyConfigured() ? null : "Spotify is not configured for this build.",
  );

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
        if (!isSpotifyConfigured()) {
          setError("Missing EXPO_PUBLIC_SPOTIFY_CLIENT_ID.");
          return;
        }
        setLoading(true);
        exchangeCodeForToken(code, request.codeVerifier)
          .then(async (tokens) => {
            if (__DEV__) {
              console.log("[Spotify] Token response received.", {
                hasAccessToken: !!tokens?.access_token,
                accessTokenLength: tokens?.access_token?.length,
                hasRefreshToken: !!tokens?.refresh_token,
                expiresIn: tokens?.expires_in,
                error: tokens?.error,
                errorDescription: tokens?.error_description,
              });
            }

            const token = tokens ? await persistTokenResponse(tokens) : null;
            if (token) {
              setError(null);
              setAccessToken(token);
              console.log("Spotify connected. Access token received.");
            } else {
              setError("Spotify did not return an access token.");
            }
          })
          .catch((e) => {
            const message = e?.message ?? "Token exchange failed.";
            console.error("Token exchange failed:", message);
            setError(message);
          })
          .finally(() => setLoading(false));
      }
    }

    if (response?.type === "error") {
      console.error("Spotify auth error:", response.error);
      setError(response.error?.message ?? "Spotify authorization failed.");
    }

    if (response?.type === "dismiss") {
      console.log("Spotify auth dismissed by user.");
    }
  }, [response, request]);

  // Step 2: Fetch + persist fan data once we have a token
  useEffect(() => {
    if (!accessToken) return;

    if (__DEV__) {
      console.log("[Spotify] About to sync fan data.", {
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken.length,
        accessTokenStart: accessToken.slice(0, 12),
      });
    }

    setLoading(true);
    syncFanSpotifyData(accessToken)
      .then((data) => {
        setError(null);
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
      .catch((e) => {
        const message = e?.message ?? "Failed to sync Spotify data.";
        console.error("Failed to sync fan data:", message);
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [accessToken]);

  return {
    accessToken,
    fanData,
    loading,
    error,
    isConfigured: isSpotifyConfigured(),
    redirectUri: REDIRECT_URI,
    request,
    promptAsync,
  };
}

// Token exchange

async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
): Promise<SpotifyTokenResponse | null> {
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

  const text = await res.text();

  let data: SpotifyTokenResponse;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("Spotify token parse error:", text);
    throw new Error("Spotify token exchange returned an invalid response.");
  }

  if (!res.ok || data.error) {
    console.error("Spotify token error:", data.error, data.error_description);
    throw new Error(
      data.error_description ?? data.error ?? "Spotify token exchange failed.",
    );
  }

  return data;
}

async function refreshSpotifyAccessToken(
  refreshToken: string,
): Promise<string | null> {
  if (!isSpotifyConfigured()) return null;

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });

  const res = await fetch(DISCOVERY.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const text = await res.text();

  let data: SpotifyTokenResponse;
  try {
    data = JSON.parse(text);
  } catch {
    await clearStoredSpotifyToken();
    console.error("Spotify refresh parse error:", text);
    return null;
  }

  if (!res.ok || data.error) {
    await clearStoredSpotifyToken();
    console.error("Spotify refresh error:", data.error, data.error_description);
    return null;
  }

  return persistTokenResponse(data, refreshToken);
}

// Fan data fetching

async function spotifyGet<T>(url: string, token: string): Promise<T> {
  const normalizedToken = normalizeSpotifyToken(token);

  if (!normalizedToken) {
    throw new Error(`No Spotify token provided before calling ${url}`);
  }

  if (__DEV__) {
    console.log("[Spotify GET]", {
      url,
      hasToken: true,
      tokenLength: normalizedToken.length,
      tokenStart: normalizedToken.slice(0, 12),
    });
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${normalizedToken}` },
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("[Spotify API failed]", {
      url,
      status: res.status,
      body: text,
    });

    throw new Error(`Spotify API error ${res.status} on ${url}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Spotify API returned invalid JSON on ${url}`);
  }
}

async function fetchFanData(token: string): Promise<FanSpotifyData> {
  const normalizedToken = normalizeSpotifyToken(token);

  if (!normalizedToken) {
    throw new Error(
      "No Spotify access token available before fetching fan data.",
    );
  }

  const profile = await spotifyGet<any>(ENDPOINTS.me, normalizedToken);
  console.log("[Spotify] Profile fetched:", profile.id);

  const topTracksRes = await spotifyGet<SpotifyApi.UsersTopTracksResponse>(
    `${ENDPOINTS.topTracks}?time_range=medium_term&limit=50`,
    normalizedToken,
  );
  console.log("[Spotify] Top tracks fetched:", topTracksRes.items?.length ?? 0);

  const topArtistsRes = await spotifyGet<SpotifyApi.UsersTopArtistsResponse>(
    `${ENDPOINTS.topArtists}?time_range=medium_term&limit=50`,
    normalizedToken,
  );
  console.log(
    "[Spotify] Top artists fetched:",
    topArtistsRes.items?.length ?? 0,
  );

  const recentlyPlayedRes =
    await spotifyGet<SpotifyApi.UsersRecentlyPlayedTracksResponse>(
      `${ENDPOINTS.recentlyPlayed}?limit=50`,
      normalizedToken,
    );
  console.log(
    "[Spotify] Recently played fetched:",
    recentlyPlayedRes.items?.length ?? 0,
  );

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
