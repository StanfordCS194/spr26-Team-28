# Mixtape

Mixtape is a mobile app that lets music **fans** privately share their real
listening data with the indie **artists** they love, and gives artists
**aggregated, consent-based insights** about who is listening — without ever
exposing any individual fan's data they did not opt in to.

The product has two distinct experiences in one app:

- **Fan view** — connect Spotify, see what your listening says about your taste,
  and choose which artists you share that data with (and revoke any time).
- **Artist view** — see aggregated insights from fans who have consented to
  share, where your listeners are, and manage your releases and public profile.

Built with **Expo / React Native** (TypeScript) and **Supabase** (auth +
Postgres), with **Spotify** as the listening-data source.

---

## Table of contents

- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
  - [1. Install dependencies](#1-install-dependencies)
  - [2. Configure environment variables](#2-configure-environment-variables)
  - [3. Spotify redirect URI](#3-spotify-redirect-uri)
  - [4. Run the app](#4-run-the-app)
- [Project structure](#project-structure)
- [Fan workflow](#fan-workflow)
- [Artist workflow](#artist-workflow)
- [Database schema](#database-schema)
- [Integrations](#integrations)
- [Troubleshooting](#troubleshooting)

---

## Tech stack

| Area | Technology |
| --- | --- |
| App framework | [Expo](https://expo.dev) `~54` + [React Native](https://reactnative.dev) `0.81` |
| Language | TypeScript |
| Navigation | [Expo Router](https://docs.expo.dev/router/introduction/) (file-based) |
| Auth & database | [Supabase](https://supabase.com) (Postgres + Auth) |
| Listening data | [Spotify Web API](https://developer.spotify.com/documentation/web-api) via `expo-auth-session` (Authorization Code + PKCE) |
| Local storage | `@react-native-async-storage/async-storage` (persists the Supabase session) |

---

## Prerequisites

- **Node.js 18+** and **npm**
- **Expo** — no global install needed; the project uses the local `expo` CLI via
  `npx`. (Optionally install [Expo Go](https://expo.dev/go) on a physical device.)
- For the iOS Simulator: **Xcode** (macOS only)
- A **Supabase** project (URL + publishable/anon key)
- A **Spotify Developer** application (client ID + a registered redirect URI)

---

## Setup

All commands below are run from the `mixtape/` directory.

### 1. Install dependencies

```bash
cd mixtape
npm install
```

### 2. Configure environment variables

The app reads configuration from `EXPO_PUBLIC_*` environment variables (Expo
inlines these at build time). Copy the example file and fill in your own values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL (e.g. `https://xxxx.supabase.co`). |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Your Supabase publishable (anon) key. |
| `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` | ✅ | Client ID from your Spotify Developer app. |
| `EXPO_PUBLIC_SPOTIFY_REDIRECT_URI` | optional | Pin the exact redirect URI registered in the Spotify dashboard. If unset, the app derives a stable URI from the app scheme — see below. |

> **Note:** `EXPO_PUBLIC_*` variables are embedded in the client bundle and are
> **not secret**. The Supabase publishable/anon key is safe to ship; protect your
> data with Row Level Security (RLS) policies in Supabase, not by hiding the key.

### 3. Spotify redirect URI

Spotify requires the OAuth redirect URI to **exactly match** one of the URIs
registered in your app's [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

This app uses a **stable** redirect URI so it doesn't break between machines or
runs (see `utils/useSpotifyAuth.ts`). On startup, in development, it logs the
exact URI it will use:

```
[Spotify] Redirect URI (register this in the dashboard): mixtape://spotify-auth-callback
```

Add that value to **Redirect URIs** in your Spotify app settings. To use a
different URI (for example a deployed HTTPS callback), set
`EXPO_PUBLIC_SPOTIFY_REDIRECT_URI` to it and register that instead.

> Custom-scheme redirects (`mixtape://…`) require a **development build** or a
> production build. In Expo Go the scheme is owned by Expo Go, so for reliable
> Spotify auth use a dev build (`npx expo run:ios`) or pin a registered URI.

### 4. Run the app

```bash
npm start          # start the Expo dev server (press i for iOS, a for Android)
npm run ios        # build & open in the iOS Simulator (macOS + Xcode)
npm run android    # build & open in an Android emulator
```

- **Expo Go:** scan the QR code from `npm start`. Good for quick UI iteration;
  note the Spotify-auth caveat above.
- **iOS Simulator:** `npm run ios` (requires Xcode). Press `i` in the dev server
  to open the simulator on demand.

---

## Project structure

```
mixtape/
├── app/                      # Expo Router routes (file-based navigation)
│   ├── _layout.tsx           # Root layout: fonts, splash screen, status bar
│   ├── index.tsx             # Auth gate: routes to login or the correct tabs
│   ├── (sign-in)/            # Onboarding & auth flow (shared by fans & artists)
│   ├── (tabs)/               # FAN view tab navigator
│   │   └── artist/[id].tsx   #   Public artist profile (opened from the fan view)
│   └── (artist-tabs)/        # ARTIST view tab navigator
├── components/               # Shared presentational components (login, loading)
├── utils/                    # Hooks & helpers (session, Spotify auth, routing)
├── database/db.tsx           # Supabase client setup
├── assets/                   # Fonts, images, and the theme (assets/theme.tsx)
└── app.json                  # Expo app config (scheme: "mixtape")
```

Expo Router maps files in `app/` to routes. **Route groups** — folders wrapped in
parentheses like `(tabs)` — organize files without adding a path segment, which
is how the fan and artist tab navigators are kept separate.

---

## Fan workflow

1. **Landing / Sign up** (`components/login.tsx`)
2. **Create account** (`(sign-in)/make-account.tsx`) — name, username, password
3. **Choose role → Fan** (`(sign-in)/select-account.tsx`)
4. **Select location** (`(sign-in)/select-location.tsx`) — country & city
5. **Connect music** (`(sign-in)/connect-music.tsx`) — connect Spotify (Apple
   Music is shown as *Coming soon*); can be skipped
6. **Follow an artist** (`(sign-in)/follow-artist.tsx`) → **pick a favorite song**
   (`(sign-in)/favorite-song.tsx`) → **share consent** (`(sign-in)/share-consent.tsx`)
7. Land in the **Fan tabs** (`(tabs)/`):
   - **HOME** (`index.tsx`) — your listening summary & activity
   - **FOR YOU** (`for-you.tsx`) — discover artists to share with
   - **SHARING** (`sharing.tsx`) — see and **revoke** who you share with
   - **YOU** (`you.tsx`) — your profile and Spotify listening data

## Artist workflow

1. Steps 1–2 above, then **Choose role → Artist** (`(sign-in)/select-account.tsx`)
   takes the artist straight to the dashboard (no Spotify/follow steps).
2. **Artist tabs** (`(artist-tabs)/`):
   - **INSIGHTS** (`index.tsx`) — aggregated insights from consenting fans
   - **FANS** (`fans.tsx`) — where your listeners are (city-level map)
   - **RELEASES** (`releases.tsx`) — list and create releases
   - **PROFILE** (`profile.tsx`) — edit bio, genres, location, and social links;
     this is also the public-facing profile fans see

Role-based routing after sign-in is handled by `utils/navigateByRole.tsx`, which
reads `profiles.role` and sends fans to `(tabs)` and artists to `(artist-tabs)`.

---

## Database schema

The app uses these Supabase (Postgres) tables. Column lists reflect what the app
reads/writes today; a canonical SQL schema file is tracked separately (see issue
#26) and should be referenced here once it lands.

### `profiles`
Core user record for both fans and artists (keyed by the Supabase auth user id).

| Column | Notes |
| --- | --- |
| `id` | PK, equals the auth user id |
| `name`, `username` | Display name and handle |
| `role` | `"fan"` or `"artist"` |
| `bio`, `genre` | Artist bio and comma-separated genres |
| `country`, `city` | Location |
| `instagram`, `tiktok`, `website` | Social links (artist profile) |

### `fan_follows`
The fan→artist sharing relationship, including consent.

| Column | Notes |
| --- | --- |
| `id` | PK |
| `fan_id` → `profiles.id` | The fan |
| `artist_id` → `profiles.id` | The artist |
| `consented_at` | Timestamp when consent was given; `null` means consent revoked |
| `top_track` | The fan's favorite track for this artist (optional) |

### `fan_spotify_data`
A cached snapshot of each fan's Spotify listening data.

| Column | Notes |
| --- | --- |
| `fan_id` → `profiles.id` | PK / owner |
| `profile` | JSON: Spotify profile (id, display name, country, email) |
| `top_tracks`, `top_artists` | JSON arrays from the Spotify "top" endpoints |
| `recently_played` | JSON array of recent play history |
| `fetched_at` | Last sync timestamp |

### `releases`
Artist discography.

| Column | Notes |
| --- | --- |
| `id` | PK |
| `artist_id` → `profiles.id` | The artist |
| `title` | Release title |
| `release_type` | `"single" \| "ep" \| "album"` |
| `release_date` | Date (nullable) |
| `track_count` | Number of tracks |

> **Privacy model:** the artist view only ever reads **aggregated** data from
> fans whose `fan_follows.consented_at` is set. Individual fans who have not
> opted in are never exposed.

---

## Integrations

| Integration | Status | Notes |
| --- | --- | --- |
| **Spotify** | ✅ Supported | OAuth (Authorization Code + PKCE); reads profile, top tracks, top artists, recently played. See [Spotify redirect URI](#3-spotify-redirect-uri). |
| **Apple Music** | 🚧 Coming soon | Requires an Apple Music subscription/API entitlement; shown as *Coming soon* in onboarding. |
| **Supabase** | ✅ Supported | Auth + Postgres. |

---

## Troubleshooting

- **Spotify "INVALID_CLIENT: Invalid redirect URI"** — the redirect URI the app
  sends doesn't match one registered in the Spotify dashboard. Copy the
  `[Spotify] Redirect URI` line the app logs on startup and register it exactly,
  or pin `EXPO_PUBLIC_SPOTIFY_REDIRECT_URI`. See
  [Spotify redirect URI](#3-spotify-redirect-uri).
- **App can't reach Supabase / blank data** — confirm `EXPO_PUBLIC_SUPABASE_URL`
  and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set in `.env` and restart the
  dev server (env changes require a restart).
- **Fonts/splash never load** — clear the Metro cache: `npx expo start -c`.
