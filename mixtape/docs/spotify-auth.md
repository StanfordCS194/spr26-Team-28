# Spotify Auth: Redirect URI Setup

Spotify requires the OAuth redirect URI to **exactly** match an entry registered
in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
(your app → **Settings** → **Redirect URIs**). A mismatch fails with
`INVALID_CLIENT: Invalid redirect URI`.

The redirect URI is built in
[`utils/useSpotifyAuth.ts`](../utils/useSpotifyAuth.ts) and printed to the
console on startup (`Redirect URI: ...`). Copy whatever it prints in your
environment and add it in the dashboard.

## Redirect URIs to register

### (a) Standalone / dev build (recommended — stable)

Add this exact value:

```
mixtape://spotify-auth-callback
```

This is derived from the custom `scheme` (`"mixtape"`) declared in
[`app.json`](../app.json) plus the fixed `spotify-auth-callback` path. It is
deterministic across runs, networks, and devices, so it only needs to be
registered once.

### (b) Expo Go (development)

Expo Go ignores the custom scheme and returns a URI based on the local dev
server, of the form:

```
exp://<your-machine-ip>:<port>/--/spotify-auth-callback
```

For example: `exp://192.168.1.5:8081/--/spotify-auth-callback`

The IP/port change per machine and network, so this URI is **not** stable. Run
the app, copy the exact `Redirect URI:` value from the console, and add that to
the dashboard. You must re-register it whenever your dev-server address changes.

> Prefer a dev build over Expo Go so you can rely on the single stable
> `mixtape://spotify-auth-callback` URI.

### Override (optional)

To pin an explicit URI (e.g. a deployed HTTPS callback), set the
`EXPO_PUBLIC_SPOTIFY_REDIRECT_URI` env var. When set, it takes precedence over
the values above, and that exact value must be registered in the dashboard.

## Where CLIENT_ID and scopes live

Both are in [`utils/useSpotifyAuth.ts`](../utils/useSpotifyAuth.ts): the client
ID comes from the `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` env var (`CLIENT_ID`), and the
requested OAuth scopes are the `SCOPES` array.
