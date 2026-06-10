-- Artists should only read active fan share rows.
--
-- Fans still need to read their own rows, including revoked rows, so the fan
-- side of the policy remains unchanged. The artist side is limited to rows
-- with active consent.

drop policy if exists "Fans and artists can read their follows" on public.fan_follows;
create policy "Fans and artists can read their follows"
  on public.fan_follows for select
  to authenticated
  using (
    fan_id = auth.uid()
    or (
      artist_id = auth.uid()
      and consented_at is not null
    )
  );
