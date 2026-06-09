-- Harden release write rules after the public release surface was added.
--
-- Fans can read public artist releases, but only artist profiles should be
-- able to create, update, or delete their own release rows.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.releases'::regclass
      and conname = 'releases_track_count_nonnegative'
  ) then
    alter table public.releases
      add constraint releases_track_count_nonnegative
      check (track_count >= 0)
      not valid;
  end if;
end $$;

drop policy if exists "Releases are readable by authenticated users" on public.releases;
create policy "Releases are readable by authenticated users"
  on public.releases for select
  to authenticated
  using (true);

drop policy if exists "Artists insert their own releases" on public.releases;
create policy "Artists insert their own releases"
  on public.releases for insert
  to authenticated
  with check (
    artist_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'artist'
    )
  );

drop policy if exists "Artists update their own releases" on public.releases;
create policy "Artists update their own releases"
  on public.releases for update
  to authenticated
  using (
    artist_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'artist'
    )
  )
  with check (
    artist_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'artist'
    )
  );

drop policy if exists "Artists delete their own releases" on public.releases;
create policy "Artists delete their own releases"
  on public.releases for delete
  to authenticated
  using (
    artist_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'artist'
    )
  );
