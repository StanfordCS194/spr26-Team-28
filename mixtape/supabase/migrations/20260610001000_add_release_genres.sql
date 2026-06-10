-- Add release genre metadata used by the artist releases and collaboration
-- screens.
--
-- This keeps the feature additive for existing Supabase projects:
--   * genres is a lookup table for the release genre picker
--   * releases.genre_ids stores selected genre ids for each release
--   * profiles.genre_vector stores a normalized slug -> weight map recomputed
--     from an artist's releases

create table if not exists public.genres (
  id   integer primary key,
  name text not null unique,
  slug text not null unique
);

insert into public.genres (id, name, slug)
values
  (1, 'Pop', 'pop'),
  (2, 'Indie Pop', 'indie-pop'),
  (3, 'Dream Pop', 'dream-pop'),
  (4, 'Synth Pop', 'synth-pop'),
  (5, 'Electronic', 'electronic'),
  (6, 'Rock', 'rock'),
  (7, 'Folk', 'folk'),
  (8, 'Hip-Hop', 'hip-hop'),
  (9, 'R&B', 'r-and-b')
on conflict (id) do update
set name = excluded.name,
    slug = excluded.slug;

alter table public.profiles
  add column if not exists genre_vector jsonb;

alter table public.releases
  add column if not exists album_title text,
  add column if not exists genre_ids integer[] not null default '{}'::integer[];

alter table public.releases
  alter column release_type set default 'single';

create index if not exists releases_genre_ids_gin_idx
  on public.releases using gin (genre_ids);

alter table public.genres enable row level security;

drop policy if exists "Genres are readable by authenticated users" on public.genres;
create policy "Genres are readable by authenticated users"
  on public.genres for select
  to authenticated
  using (true);
