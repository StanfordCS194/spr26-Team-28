# Database

Supabase (Postgres) is the backend. [`schema.sql`](./schema.sql) is the source
of truth for tables and Row Level Security (RLS); [`db.tsx`](./db.tsx) is the
client. This doc explains what each table is for, how the app uses it, and the
security model — closing out issue #26.

## Applying the schema

The schema is idempotent — safe to run repeatedly.

- **Dashboard:** Supabase → SQL Editor → paste `schema.sql` → Run.
- **CLI:** `supabase db execute --file mixtape/database/schema.sql`

### Required auth setting

Accounts are created with **synthetic `username@mixtape.com` emails**
(`make-account.tsx` derives the email from the username). Those addresses can't
receive a confirmation link, so:

> **Authentication → Providers → Email → "Confirm email" must be OFF.**

If it's on, `signUp` returns no session, and the first Spotify sync in
`utils/useSpotifyAuth.ts` calls `getUser()`, gets `null`, and **silently drops
the listening data**. (Tracked in issue #32 — real emails — which would let us
turn confirmation back on.)

## Tables

| Table | Grain | Written by | Read by |
|-------|-------|-----------|---------|
| `profiles` | one per user | `select-account` (create), `select-location` + `(artist-tabs)/profile` (edit) | everywhere; artist browse, fan map |
| `fan_follows` | one per (fan, artist) | `share-consent` (upsert), `sharing` (revoke) | fan sharing list, artist fan list/map/activity |
| `fan_spotify_data` | one per fan | `useSpotifyAuth` (upsert on `fan_id`) | fan profile (`you`), artist insights |
| `releases` | one per release | `(artist-tabs)/releases` | artist releases tab |

### Column notes

- **`profiles.role`** is `'fan' | 'artist'`; it also drives routing in
  `utils/navigateByRole.tsx`. `genre` is a comma-joined string.
- **`fan_follows`** has a surrogate `id` **and** `UNIQUE (fan_id, artist_id)`.
  The `id` is consumed by `(tabs)/index.tsx`; the unique constraint is what the
  consent upsert targets so re-consenting updates one row instead of creating
  duplicates. **`consented_at = null` means "not sharing"** — revoke nulls it,
  it does not delete the row.
- **`fan_spotify_data`** stores the Spotify payloads verbatim as `jsonb`
  (`top_tracks`, `top_artists`, `recently_played`). `profile` includes the
  fan's Spotify email; nothing reads it back into the UI today.

### Foreign-key naming gotcha

`fan_follows` has **two** FKs to `profiles` (`fan_id` and `artist_id`), so
PostgREST embeds must disambiguate:

- `fans.tsx` uses the constraint name: `profiles!fan_follows_fan_id_fkey(...)`
- `sharing.tsx` uses the column hint: `profiles:artist_id(...)`

`schema.sql` declares both FKs inline, which yields the default names
(`fan_follows_fan_id_fkey`, `fan_follows_artist_id_fkey`) those queries rely on.
**Don't rename them.**

## RLS model

RLS is enabled on every table. Highlights:

- **`profiles`** — any signed-in user can read all profiles (fans browse
  artists; the fan map embeds consenting fans' city/country). Writes are
  owner-only. This does expose every profile's name/city/country to all
  authenticated users; `schema.sql` documents a stricter alternative if needed.
- **`fan_follows`** — readable by either side (`fan_id = auth.uid() OR
  artist_id = auth.uid()`); only the fan can create/update their rows.
- **`fan_spotify_data`** — the load-bearing one. A fan owns their row; an
  **artist can read a fan's row only if that fan has a consented `fan_follows`
  row pointing at them.** This is what makes the `.in("fan_id", fanIds)`
  aggregation in the artist dashboards return data without leaking every fan's
  history. Get this wrong and the dashboard is silently empty (too strict) or a
  privacy hole (too loose).
- **`releases`** — public read for signed-in users; owner-only writes.

## Known follow-ups (this lane)

- Artist insights aggregate each fan's **global** top tracks/artists, not the
  tracks/plays for *that* artist — which is narrower than what `share-consent`
  promises. Fixing it needs a Spotify artist id on `profiles` to match against.
- Several dashboard metrics ("plays", sparkline, "est. total listens") are
  proxies/placeholders rather than real aggregates.
- No Spotify refresh-token persistence yet, so "re-sync" is a full re-auth.
