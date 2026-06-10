-- Repair hosted projects whose releases table predates release_type.
--
-- The Releases tab now saves singles, EPs, and albums and expects these
-- columns to exist. Some older Supabase projects already had public.releases,
-- so create-table migrations were skipped and release_type never got added.
-- Keep this migration additive and safe to rerun.

create table if not exists public.releases (
  id           uuid primary key default gen_random_uuid(),
  artist_id    uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  release_type text not null default 'single',
  release_date date,
  track_count  integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.releases
  add column if not exists release_type text not null default 'single',
  add column if not exists album_title text,
  add column if not exists genre_ids integer[] not null default '{}'::integer[];

alter table public.releases
  alter column release_type set default 'single';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.releases'::regclass
      and conname = 'releases_release_type_check'
  ) then
    alter table public.releases
      add constraint releases_release_type_check
      check (release_type in ('single', 'ep', 'album'));
  end if;
end $$;

create index if not exists releases_genre_ids_gin_idx
  on public.releases using gin (genre_ids);
