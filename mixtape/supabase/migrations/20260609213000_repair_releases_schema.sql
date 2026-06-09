-- Repair legacy releases schemas that used non-UUID ids.
--
-- Older/manual Supabase projects may already have public.releases with an
-- integer artist_id. The app writes auth.users UUIDs into artist_id, so that
-- legacy shape fails with string-to-int or uuid-to-int errors. If the table is
-- incompatible, keep it as a timestamped backup and recreate the additive
-- releases table with the schema the app expects.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  has_bad_releases boolean := false;
  backup_name text;
begin
  if to_regclass('public.releases') is null then
    return;
  end if;

  select
    not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'releases'
        and column_name = 'id'
        and udt_name = 'uuid'
    )
    or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'releases'
        and column_name = 'artist_id'
        and udt_name = 'uuid'
    )
    or exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'releases'
        and column_name = 'track_count'
        and data_type <> 'integer'
    )
  into has_bad_releases;

  if has_bad_releases then
    backup_name := 'releases_legacy_backup_' ||
      to_char(clock_timestamp(), 'YYYYMMDDHH24MISS');
    execute format('alter table public.releases rename to %I', backup_name);
  end if;
end $$;

create table if not exists public.releases (
  id           uuid primary key default gen_random_uuid(),
  artist_id    uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  release_type text not null check (release_type in ('single', 'ep', 'album')),
  release_date date,
  track_count  integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.releases
  add column if not exists release_date date,
  add column if not exists track_count integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'releases'
      and indexdef like '%(artist_id)%'
  ) then
    create index releases_artist_id_current_idx
      on public.releases (artist_id);
  end if;
end $$;

alter table public.releases enable row level security;

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
