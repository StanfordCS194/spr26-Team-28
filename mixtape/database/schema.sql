-- ============================================================================
-- Mixtape — Supabase schema + Row Level Security
-- ============================================================================
-- This file is the source of truth for the database the app expects. It is
-- idempotent: you can paste it into the Supabase SQL editor (or run it via the
-- Supabase CLI) on a fresh or existing project and re-run it safely.
--
-- It was reconstructed from how the app actually reads and writes data. Every
-- table/column/policy below maps to real queries — see database/README.md for
-- the file-by-file mapping and the reasoning behind each RLS policy.
--
-- IMPORTANT auth setting: accounts use synthetic `username@mixtape.com` emails
-- that can never receive a confirmation link, so email confirmation MUST be
-- disabled (Supabase Dashboard → Authentication → Providers → Email →
-- "Confirm email" = off). Otherwise sign-up returns no session and the very
-- first Spotify sync (utils/useSpotifyAuth.ts) silently drops the data.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
-- One row per user, keyed by the auth user id. Created client-side in
-- app/(sign-in)/select-account.tsx (insert id/name/username/role), then filled
-- in by select-location.tsx (city/country) and the artist profile editor
-- (bio/genre/socials). There is intentionally NO auth.users insert trigger —
-- the app creates this row itself and reads the display name from user
-- metadata, so a trigger would race/duplicate it.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  username   text unique,
  role       text check (role in ('fan', 'artist')),
  bio        text,
  genre      text,        -- comma-joined list, e.g. "indie, dream pop"
  city       text,
  country    text,
  instagram  text,
  tiktok     text,
  website    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- fan_follows
-- ----------------------------------------------------------------------------
-- A fan choosing to share their listening data with an artist.
--   * `consented_at` null  → not currently sharing (revoked in sharing.tsx by
--     setting it back to null; the row is kept, not deleted).
--   * `top_track`          → free-text favourite song from favorite-song.tsx,
--     surfaced per-city on the artist fan map.
--
-- Surrogate `id` PK because (tabs)/index.tsx selects and keys on it, PLUS a
-- UNIQUE(fan_id, artist_id) so re-consenting upserts the same row instead of
-- piling up duplicates that would inflate every fan count.
--
-- Do NOT rename the fan_id foreign key: fans.tsx embeds the fan's profile via
-- the default constraint name `fan_follows_fan_id_fkey`. Declaring the FK
-- inline (as below) gives it exactly that name.
create table if not exists public.fan_follows (
  id           uuid primary key default gen_random_uuid(),
  fan_id       uuid not null references public.profiles (id) on delete cascade,
  artist_id    uuid not null references public.profiles (id) on delete cascade,
  consented_at timestamptz,
  top_track    text,
  created_at   timestamptz not null default now(),
  unique (fan_id, artist_id)
);

create index if not exists fan_follows_artist_id_idx on public.fan_follows (artist_id);
create index if not exists fan_follows_fan_id_idx     on public.fan_follows (fan_id);


-- ----------------------------------------------------------------------------
-- fan_spotify_data
-- ----------------------------------------------------------------------------
-- One row per fan, upserted on fan_id by utils/useSpotifyAuth.ts after a
-- Spotify sync. The JSON blobs are stored verbatim from the Spotify Web API
-- (top 50 each, recently-played up to 50). `profile` holds the fan's Spotify
-- profile incl. email — keep it server-side; nothing reads it back into the UI.
create table if not exists public.fan_spotify_data (
  fan_id          uuid primary key references public.profiles (id) on delete cascade,
  profile         jsonb,
  top_tracks      jsonb not null default '[]'::jsonb,
  top_artists     jsonb not null default '[]'::jsonb,
  recently_played jsonb not null default '[]'::jsonb,
  fetched_at      timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- releases
-- ----------------------------------------------------------------------------
-- An artist's discography, managed in app/(artist-tabs)/releases.tsx. That
-- screen already tolerates this table being absent (it swallows 42P01); this
-- definition makes it real.
create table if not exists public.releases (
  id           uuid primary key default gen_random_uuid(),
  artist_id    uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  release_type text not null check (release_type in ('single', 'ep', 'album')),
  release_date date,
  track_count  integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists releases_artist_id_idx on public.releases (artist_id);


-- ----------------------------------------------------------------------------
-- updated_at maintenance (profiles)
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles         enable row level security;
alter table public.fan_follows      enable row level security;
alter table public.fan_spotify_data enable row level security;
alter table public.releases         enable row level security;


-- ---- profiles ---------------------------------------------------------------
-- Readable by any signed-in user: fans browse artist profiles (for-you,
-- follow-artist, artist/[id]) and the artist fan map embeds consenting fans'
-- city/country. Writes are restricted to the row owner.
--
-- Privacy note: this exposes every profile's name/username/city/country to all
-- authenticated users. That is the minimum the current screens need. To tighten
-- it later, replace `using (true)` with: own row OR role='artist' OR a fan who
-- has a consented fan_follows row with the caller.
drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


-- ---- fan_follows ------------------------------------------------------------
-- Visible to both sides of the relationship: the fan (their sharing list) and
-- the artist (their fan list / activity feed). A fan may only create and modify
-- their own follow rows; revoking is an UPDATE that nulls consented_at.
drop policy if exists "Fans and artists can read their follows" on public.fan_follows;
create policy "Fans and artists can read their follows"
  on public.fan_follows for select
  to authenticated
  using (fan_id = auth.uid() or artist_id = auth.uid());

drop policy if exists "Fans can create their own follow" on public.fan_follows;
create policy "Fans can create their own follow"
  on public.fan_follows for insert
  to authenticated
  with check (fan_id = auth.uid());

drop policy if exists "Fans can update their own follow" on public.fan_follows;
create policy "Fans can update their own follow"
  on public.fan_follows for update
  to authenticated
  using (fan_id = auth.uid())
  with check (fan_id = auth.uid());


-- ---- fan_spotify_data -------------------------------------------------------
-- THE policy the whole insights loop hinges on.
--
-- A fan owns their row (read + write). An artist may READ a fan's row only if
-- that fan has an active (consented_at not null) fan_follows row pointing at
-- the artist. This is what lets artist-tabs/index.tsx and (tabs)/index.tsx do
-- `.in("fan_id", fanIds)` and get data back — without it the dashboard is
-- silently empty; with a naive "owner only" policy it would also be empty;
-- with a wide-open policy every fan's listening history would leak.
--
-- No SECURITY DEFINER wrapper is needed: the EXISTS subquery only matches rows
-- where artist_id = auth.uid(), which the fan_follows SELECT policy above
-- already exposes to that artist, so the subquery can see them under RLS.
drop policy if exists "Fans read their own spotify data" on public.fan_spotify_data;
drop policy if exists "Artists read consenting fans spotify data" on public.fan_spotify_data;
create policy "Read own or consenting-fan spotify data"
  on public.fan_spotify_data for select
  to authenticated
  using (
    fan_id = auth.uid()
    or exists (
      select 1
      from public.fan_follows f
      where f.fan_id = fan_spotify_data.fan_id
        and f.artist_id = auth.uid()
        and f.consented_at is not null
    )
  );

drop policy if exists "Fans insert their own spotify data" on public.fan_spotify_data;
create policy "Fans insert their own spotify data"
  on public.fan_spotify_data for insert
  to authenticated
  with check (fan_id = auth.uid());

drop policy if exists "Fans update their own spotify data" on public.fan_spotify_data;
create policy "Fans update their own spotify data"
  on public.fan_spotify_data for update
  to authenticated
  using (fan_id = auth.uid())
  with check (fan_id = auth.uid());


-- ---- releases ---------------------------------------------------------------
-- Public discography: readable by any signed-in user; only the owning artist
-- can write.
drop policy if exists "Releases are readable by authenticated users" on public.releases;
create policy "Releases are readable by authenticated users"
  on public.releases for select
  to authenticated
  using (true);

drop policy if exists "Artists insert their own releases" on public.releases;
create policy "Artists insert their own releases"
  on public.releases for insert
  to authenticated
  with check (artist_id = auth.uid());

drop policy if exists "Artists update their own releases" on public.releases;
create policy "Artists update their own releases"
  on public.releases for update
  to authenticated
  using (artist_id = auth.uid())
  with check (artist_id = auth.uid());

drop policy if exists "Artists delete their own releases" on public.releases;
create policy "Artists delete their own releases"
  on public.releases for delete
  to authenticated
  using (artist_id = auth.uid());
