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

  // Step 2: Fetch fan data once we have a token
  useEffect(() => {
    if (!accessToken) return;

    setLoading(true);
    fetchFanData(accessToken)
      .then(async (data) => {
        setFanData(data);
        console.log("Spotify data fetched successfully.");
        console.log(
          "  Profile:",
          data.profile?.display_name,
          "-",
          data.profile?.country,
        );
        console.log("  Top tracks:", data.topTracks.length);
        console.log("  Top artists:", data.topArtists.length);
        console.log("  Recently played:", data.recentlyPlayed.length);

        // Persist fan listening data to Supabase so the artist dashboard
        // and fan profile tab can read it later.
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
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
          }
        } catch (e: any) {
          console.error("Failed to persist Spotify data:", e?.message);
        }
      })
      .catch((e) => console.error("Failed to fetch fan data:", e))
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
