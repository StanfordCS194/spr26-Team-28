-- ============================================================================
-- Mixtape - demo seed data  (issue #29)
-- ============================================================================
-- Populates one primary demo ARTIST account ("Nova Sky"), three additional
-- demo artists for discovery/collaboration, plus ~20 consenting fans so that
-- the artist-facing screens render with real, varied data:
--
--   * app/(artist-tabs)/index.tsx  (dashboard / insights)
--       - counts consenting fans
--       - counts recent share events from fan_follows.consented_at
--       - tallies fan_follows.top_track as fan favorite songs
--       - counts fan cities from profiles(city,country)
--       - shows the artist's release-derived genre vector
--   * app/(artist-tabs)/fans.tsx   (world listener map)
--       - joins fan_follows -> profiles(city,country) for consenting fans and
--         geocodes city+country with the "country-state-city" npm package
--         (City.getCitiesOfCountry(...).find(c => c.name === cityName))
--       - surfaces the most common fan_follows.top_track per city
--
-- HOW TO RUN
--   Paste this whole file into the Supabase SQL editor and run it, OR:
--     supabase db execute --file database/seed.sql        (local)
--   Run database/../supabase/migrations/20260608045615_initial_schema.sql
--   (the schema) FIRST - this script assumes those tables/policies exist.
--
-- IDEMPOTENCY
--   The script keys everything off synthetic emails of the form
--   "<username>@mixtape.com" (the same scheme the app uses - see
--   app/(sign-in)/make-account.tsx). If the demo artist's auth user already
--   exists it exits early and changes nothing, so re-running is safe and will
--   not pile up duplicate fans. To re-seed from scratch, delete the demo users
--   first (see the cleanup snippet at the very bottom of this file).
--
-- REQUIRED EXTENSIONS
--   pgcrypto - provides gen_random_uuid(), crypt() and gen_salt('bf') used
--   below. On Supabase it is available; we create it defensively. (gen_salt
--   lives in the "extensions" schema on Supabase, hence the explicit creation.)
--
-- AUTH NOTE (important)
--   profiles.id is a FK to auth.users(id), so we MUST create the auth.users row
--   before the profile. Supabase's auth.users table has many columns but most
--   are nullable; the minimal set that yields a usable, log-in-able account is
--   inserted below (instance_id, id, aud, role, email, encrypted_password,
--   email_confirmed_at, created_at, updated_at, plus empty-JSON metadata and
--   change-token columns that the GoTrue server expects to be non-null '').
--   We set email_confirmed_at = now() so the accounts are usable even if email
--   confirmation is left ON, and we use the all-zero instance_id that Supabase
--   uses for a single project. Passwords are bcrypt hashes of 'password' so you
--   can actually sign in as any demo user with their full email address.
--
-- DATA-SHAPE NOTES (must match the consumers above)
--   top_tracks  item: { "id", "name", "artists":[{ "name" }], "album":{...} }
--   top_artists item: { "id", "name", "genres":[ ... ] }
--   recently_played item: { "track": { ... }, "played_at": "<iso8601>" }
--     -> only its .length is read, so the inner shape is illustrative.
--
-- CITY/COUNTRY NOTES (must match the "country-state-city" dataset EXACTLY)
--   The map does an exact-string City.name match, so the spelling here is not
--   negotiable. These nine pairs were verified against the installed package:
--     Los Angeles / United States      New York City / United States
--     London / United Kingdom          Toronto / Canada
--     Berlin / Germany                 Sydney / Australia
--     Tokyo / Japan                    Paris / France
--     Ciudad de Mexico / Mexico
--   NB: it is "New York City" (not "New York") and "Ciudad de Mexico" (not
--   "Mexico City") - the obvious spellings are NOT in the dataset and would
--   silently drop those pins.
--
-- WHAT THIS CREATES (when the artist did not previously exist)
--   auth.users        : 24  (4 artists + 20 fans)
--   profiles          : 24  (4 artists + 20 fans)
--   releases          : 13  (4 Nova Sky releases + 9 collaborator releases)
--   fan_follows       : 20  (one consented follow per fan -> artist)
--   fan_spotify_data  : 20  (one row per fan)
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  -- ---- tunables -------------------------------------------------------------
  artist_username constant text := 'novasky';
  artist_email    constant text := 'novasky@mixtape.com';
  artist_name     constant text := 'Nova Sky';
  demo_password   constant text := 'password';   -- bcrypt-hashed below
  zero_instance   constant uuid := '00000000-0000-0000-0000-000000000000';

  artist_id uuid;
  fan_id    uuid;
  fan_email text;

  -- ---- Nova Sky's own catalogue (referenced by fan top_tracks & top_track) --
  -- Stable ids let the dashboard tally these correctly across fans.
  nova_tracks jsonb := '[
    {"id":"nova-trk-001","name":"Neon Tide",     "artists":[{"name":"Nova Sky"}], "album":{"name":"Afterglow"}},
    {"id":"nova-trk-002","name":"Paper Planets",  "artists":[{"name":"Nova Sky"}], "album":{"name":"Afterglow"}},
    {"id":"nova-trk-003","name":"Slow Comet",     "artists":[{"name":"Nova Sky"}], "album":{"name":"Midnight Static"}},
    {"id":"nova-trk-004","name":"Velvet Static",  "artists":[{"name":"Nova Sky"}], "album":{"name":"Midnight Static"}},
    {"id":"nova-trk-005","name":"Hold the Line",  "artists":[{"name":"Nova Sky"}], "album":{"name":"Hold the Line"}}
  ]'::jsonb;

  -- ---- A pool of well-known tracks to mix in (so tallies look varied) -------
  -- Picked so popular ones recur across many fans and others are long-tail.
  other_tracks jsonb := '[
    {"id":"sp-trk-blinding",  "name":"Blinding Lights",        "artists":[{"name":"The Weeknd"}]},
    {"id":"sp-trk-asitwas",   "name":"As It Was",              "artists":[{"name":"Harry Styles"}]},
    {"id":"sp-trk-flowers",   "name":"Flowers",                "artists":[{"name":"Miley Cyrus"}]},
    {"id":"sp-trk-antihero",  "name":"Anti-Hero",              "artists":[{"name":"Taylor Swift"}]},
    {"id":"sp-trk-badguy",    "name":"bad guy",                "artists":[{"name":"Billie Eilish"}]},
    {"id":"sp-trk-levitating","name":"Levitating",             "artists":[{"name":"Dua Lipa"}]},
    {"id":"sp-trk-goodluck",  "name":"good 4 u",               "artists":[{"name":"Olivia Rodrigo"}]},
    {"id":"sp-trk-heatwaves", "name":"Heat Waves",             "artists":[{"name":"Glass Animals"}]},
    {"id":"sp-trk-sunflower", "name":"Sunflower",              "artists":[{"name":"Post Malone"},{"name":"Swae Lee"}]},
    {"id":"sp-trk-staygjs",   "name":"Stay",                   "artists":[{"name":"The Kid LAROI"},{"name":"Justin Bieber"}]},
    {"id":"sp-trk-vampire",   "name":"vampire",                "artists":[{"name":"Olivia Rodrigo"}]},
    {"id":"sp-trk-cruelsum",  "name":"Cruel Summer",           "artists":[{"name":"Taylor Swift"}]}
  ]'::jsonb;

  -- ---- A pool of well-known artists to mix in (top_artists tallies) ---------
  other_artists jsonb := '[
    {"id":"sp-art-weeknd",  "name":"The Weeknd",      "genres":["pop","r&b"]},
    {"id":"sp-art-taylor",  "name":"Taylor Swift",    "genres":["pop"]},
    {"id":"sp-art-billie",  "name":"Billie Eilish",   "genres":["pop","electropop"]},
    {"id":"sp-art-dualipa", "name":"Dua Lipa",        "genres":["dance pop","pop"]},
    {"id":"sp-art-glass",   "name":"Glass Animals",   "genres":["indietronica","indie pop"]},
    {"id":"sp-art-tame",    "name":"Tame Impala",     "genres":["neo-psychedelic","indie"]},
    {"id":"sp-art-arctic",  "name":"Arctic Monkeys",  "genres":["garage rock","indie rock"]},
    {"id":"sp-art-1975",    "name":"The 1975",        "genres":["pop rock","indie pop"]},
    {"id":"sp-art-olivia",  "name":"Olivia Rodrigo",  "genres":["pop","bedroom pop"]},
    {"id":"sp-art-harry",   "name":"Harry Styles",    "genres":["pop","pop rock"]}
  ]'::jsonb;

  -- The Nova Sky artist object, mixed into every fan's top_artists so the
  -- "Artists your fans listen to" list always features the artist themselves.
  nova_artist jsonb := '{"id":"nova-art-001","name":"Nova Sky","genres":["dream pop","indie pop","synth-pop"]}'::jsonb;

  -- Additional artist accounts give For You and Collaborate enough depth to
  -- show meaningful matches after a local reset.
  demo_artists jsonb := '[
    {
      "u":"lunavale",
      "email":"lunavale@mixtape.com",
      "n":"Luna Vale",
      "bio":"Indie-pop songwriter building hazy hooks and bright synth lines.",
      "genre":"indie pop, dream pop, pop",
      "city":"London",
      "co":"United Kingdom",
      "instagram":"lunavalemusic",
      "tiktok":"lunavalemusic",
      "website":"https://lunavale.example.com",
      "vector":{"indie-pop":1,"dream-pop":0.6,"pop":0.4,"synth-pop":0.3},
      "releases":[
        {"title":"Glass Moon","type":"single","date":"2024-02-02","tracks":1,"album":null,"genres":[1,2,3]},
        {"title":"Soft Signal","type":"ep","date":"2024-09-13","tracks":5,"album":"Soft Signal","genres":[2,3,4]},
        {"title":"Silver Weather","type":"single","date":"2025-01-24","tracks":1,"album":null,"genres":[2,3]}
      ]
    },
    {
      "u":"circuitbloom",
      "email":"circuitbloom@mixtape.com",
      "n":"Circuit Bloom",
      "bio":"Electronic duo pairing club drums with cinematic synth-pop.",
      "genre":"electronic, synth-pop, pop",
      "city":"Berlin",
      "co":"Germany",
      "instagram":"circuitbloom",
      "tiktok":"circuitbloom",
      "website":"https://circuitbloom.example.com",
      "vector":{"electronic":1,"synth-pop":0.8,"pop":0.35},
      "releases":[
        {"title":"Static Hearts","type":"single","date":"2023-11-10","tracks":1,"album":null,"genres":[4,5]},
        {"title":"Afterimage Club","type":"ep","date":"2024-06-21","tracks":4,"album":"Afterimage Club","genres":[1,4,5]},
        {"title":"Bright Machines","type":"album","date":"2025-03-07","tracks":9,"album":"Bright Machines","genres":[4,5]}
      ]
    },
    {
      "u":"harborglass",
      "email":"harborglass@mixtape.com",
      "n":"Harbor Glass",
      "bio":"Coastal folk-rock with warm vocals, live drums, and slow-burn choruses.",
      "genre":"folk, rock, indie pop",
      "city":"Toronto",
      "co":"Canada",
      "instagram":"harborglass",
      "tiktok":"harborglass",
      "website":"https://harborglass.example.com",
      "vector":{"folk":1,"rock":0.65,"indie-pop":0.25},
      "releases":[
        {"title":"North Pier","type":"single","date":"2024-01-19","tracks":1,"album":null,"genres":[6,7]},
        {"title":"Low Tide Room","type":"ep","date":"2024-10-04","tracks":4,"album":"Low Tide Room","genres":[2,6,7]},
        {"title":"House Lights","type":"single","date":"2025-04-18","tracks":1,"album":null,"genres":[6,7]}
      ]
    }
  ]'::jsonb;

  -- ---- The 20 demo fans -----------------------------------------------------
  -- Columns (per element):
  --   1 username   2 display name   3 city            4 country
  --   5 top_track  (free-text fav Nova Sky song, surfaced per-city on the map)
  --   6 "nova"   how many of nova_tracks (taken from the top) to put in this
  --              fan's top_tracks - keeps the artist's own songs dominant
  --   7 "oth"    how many tracks to add from the shared "other" pool, via a
  --              per-fan rotating window (so tallies form a gradient, not a tie)
  --   8 "art"    how many artists to add from the shared pool (also rotating)
  --   9 "plays"  length of recently_played to synthesise (drives "plays")
  --  10 "age"    days since this fan started sharing (drives growth/recency)
  --
  -- Cities are intentionally weighted (Los Angeles / New York City / London
  -- get the most fans) so the map has clear hot spots, and top_track choices
  -- cluster per city so each pin has an obvious "Top Song".
  fans jsonb := '[
    {"u":"fan_la_maya",    "n":"Maya Reyes",      "city":"Los Angeles",      "co":"United States",  "top":"Neon Tide",    "nova":4, "oth":5, "art":6, "plays":42, "age":1},
    {"u":"fan_la_diego",   "n":"Diego Santos",    "city":"Los Angeles",      "co":"United States",  "top":"Neon Tide",    "nova":3, "oth":4, "art":5, "plays":31, "age":2},
    {"u":"fan_la_priya",   "n":"Priya Anand",     "city":"Los Angeles",      "co":"United States",  "top":"Paper Planets","nova":5, "oth":3, "art":7, "plays":50, "age":5},
    {"u":"fan_la_jordan",  "n":"Jordan Blake",    "city":"Los Angeles",      "co":"United States",  "top":"Neon Tide",    "nova":2, "oth":6, "art":4, "plays":18, "age":9},
    {"u":"fan_nyc_sam",    "n":"Sam Carter",      "city":"New York City",    "co":"United States",  "top":"Slow Comet",   "nova":4, "oth":4, "art":6, "plays":37, "age":14},
    {"u":"fan_nyc_aisha",  "n":"Aisha Khan",      "city":"New York City",    "co":"United States",  "top":"Slow Comet",   "nova":3, "oth":5, "art":5, "plays":29, "age":22},
    {"u":"fan_nyc_leo",    "n":"Leo Marchetti",   "city":"New York City",    "co":"United States",  "top":"Neon Tide",    "nova":5, "oth":2, "art":8, "plays":46, "age":31},
    {"u":"fan_chi_tasha",  "n":"Tasha Brooks",    "city":"Chicago",          "co":"United States",  "top":"Velvet Static","nova":3, "oth":4, "art":5, "plays":24, "age":45},
    {"u":"fan_chi_omar",   "n":"Omar Haddad",     "city":"Chicago",          "co":"United States",  "top":"Velvet Static","nova":2, "oth":5, "art":4, "plays":15, "age":58},
    {"u":"fan_ldn_freya",  "n":"Freya Walsh",     "city":"London",           "co":"United Kingdom", "top":"Paper Planets","nova":4, "oth":4, "art":6, "plays":40, "age":74},
    {"u":"fan_ldn_callum", "n":"Callum Reid",     "city":"London",           "co":"United Kingdom", "top":"Paper Planets","nova":3, "oth":5, "art":5, "plays":33, "age":93},
    {"u":"fan_ldn_nadia",  "n":"Nadia Osei",      "city":"London",           "co":"United Kingdom", "top":"Hold the Line","nova":5, "oth":3, "art":7, "plays":48, "age":115},
    {"u":"fan_tor_ethan",  "n":"Ethan Tremblay",  "city":"Toronto",          "co":"Canada",         "top":"Slow Comet",   "nova":3, "oth":4, "art":5, "plays":27, "age":139},
    {"u":"fan_tor_sofia",  "n":"Sofia Nguyen",    "city":"Toronto",          "co":"Canada",         "top":"Slow Comet",   "nova":2, "oth":6, "art":4, "plays":21, "age":168},
    {"u":"fan_ber_lena",   "n":"Lena Fischer",    "city":"Berlin",           "co":"Germany",        "top":"Velvet Static","nova":4, "oth":3, "art":6, "plays":35, "age":196},
    {"u":"fan_ber_max",    "n":"Max Bauer",       "city":"Berlin",           "co":"Germany",        "top":"Velvet Static","nova":3, "oth":5, "art":5, "plays":26, "age":229},
    {"u":"fan_syd_chloe",  "n":"Chloe Harris",    "city":"Sydney",           "co":"Australia",      "top":"Hold the Line","nova":3, "oth":4, "art":5, "plays":23, "age":260},
    {"u":"fan_tyo_haruki", "n":"Haruki Tanaka",   "city":"Tokyo",            "co":"Japan",          "top":"Neon Tide",    "nova":4, "oth":3, "art":6, "plays":34, "age":295},
    {"u":"fan_par_camille","n":"Camille Laurent", "city":"Paris",            "co":"France",         "top":"Paper Planets","nova":3, "oth":4, "art":5, "plays":28, "age":332},
    {"u":"fan_mex_valeria","n":"Valeria Cruz",    "city":"Ciudad de Mexico", "co":"Mexico",         "top":"Hold the Line","nova":4, "oth":4, "art":6, "plays":30, "age":370}
  ]'::jsonb;

  demo_artist    jsonb;
  demo_artist_id uuid;
  demo_release   jsonb;
  fan            jsonb;
  top_tracks     jsonb;
  top_arts       jsonb;
  recent         jsonb;
  i              int;
  off            int := 0;   -- per-fan rotating offset into the "other" pools
  n_oth          int;        -- jsonb_array_length(other_tracks),  cached before loop
  n_art          int;        -- jsonb_array_length(other_artists), cached before loop
begin
  -- ---- Idempotency guard ----------------------------------------------------
  -- If the demo artist already exists, assume the whole demo set is present and
  -- do nothing. This keeps re-runs safe and avoids duplicate fans.
  if exists (select 1 from auth.users where email = artist_email) then
    raise notice 'Demo data already present (artist % exists) - skipping seed.', artist_email;
    return;
  end if;

  -- ==========================================================================
  -- 1) ARTIST - auth.users row, then profile, then releases
  -- ==========================================================================
  artist_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new
  ) values (
    zero_instance, artist_id, 'authenticated', 'authenticated', artist_email,
    crypt(demo_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', artist_name, 'username', artist_username),
    now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    artist_id::text, artist_id,
    jsonb_build_object(
      'sub', artist_id::text,
      'email', artist_email,
      'email_verified', false,
      'phone_verified', false
    ),
    'email',
    now(), now(), now()
  );

  insert into public.profiles (
    id, name, username, role, bio, genre, city, country,
    instagram, tiktok, website, genre_vector
  ) values (
    artist_id, artist_name, artist_username, 'artist',
    'Dream-pop project from a bedroom in the hills. New record "Afterglow" out now.',
    'dream pop, indie pop, synth-pop',
    'Los Angeles', 'United States',
    'novaskymusic', 'novaskymusic', 'https://novasky.example.com',
    '{"dream-pop":0.75,"indie-pop":0.5,"synth-pop":1,"electronic":0.25}'::jsonb
  );

  -- ~4 releases spanning the catalogue (singles + an EP + an album).
  insert into public.releases (
    artist_id, title, release_type, release_date, track_count,
    album_title, genre_ids
  )
  values
    (artist_id, 'Hold the Line',   'single', date '2023-09-15', 1,  null,             array[3, 4]),
    (artist_id, 'Midnight Static', 'ep',     date '2024-03-22', 4,  'Midnight Static', array[3, 4, 5]),
    (artist_id, 'Neon Tide',       'single', date '2024-08-09', 1,  null,             array[2, 4]),
    (artist_id, 'Afterglow',       'album',  date '2025-02-14', 11, 'Afterglow',       array[2, 3, 4]);

  -- 1b) Additional artists for discovery and collaboration demos.
  for demo_artist in select * from jsonb_array_elements(demo_artists)
  loop
    demo_artist_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change, email_change_token_new
    ) values (
      zero_instance, demo_artist_id, 'authenticated', 'authenticated',
      demo_artist->>'email',
      crypt(demo_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', demo_artist->>'n', 'username', demo_artist->>'u'),
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      demo_artist_id::text, demo_artist_id,
      jsonb_build_object(
        'sub', demo_artist_id::text,
        'email', demo_artist->>'email',
        'email_verified', false,
        'phone_verified', false
      ),
      'email',
      now(), now(), now()
    );

    insert into public.profiles (
      id, name, username, role, bio, genre, city, country,
      instagram, tiktok, website, genre_vector
    ) values (
      demo_artist_id,
      demo_artist->>'n',
      demo_artist->>'u',
      'artist',
      demo_artist->>'bio',
      demo_artist->>'genre',
      demo_artist->>'city',
      demo_artist->>'co',
      demo_artist->>'instagram',
      demo_artist->>'tiktok',
      demo_artist->>'website',
      demo_artist->'vector'
    );

    for demo_release in select * from jsonb_array_elements(demo_artist->'releases')
    loop
      insert into public.releases (
        artist_id, title, release_type, release_date, track_count,
        album_title, genre_ids
      )
      values (
        demo_artist_id,
        demo_release->>'title',
        demo_release->>'type',
        (demo_release->>'date')::date,
        (demo_release->>'tracks')::int,
        nullif(demo_release->>'album', ''),
        array(
          select genre_id.value::int
          from jsonb_array_elements_text(demo_release->'genres') as genre_id(value)
        )
      );
    end loop;
  end loop;

  -- ==========================================================================
  -- 2) FANS - for each: auth.users -> profile -> fan_follows -> spotify data
  -- ==========================================================================
  n_oth := jsonb_array_length(other_tracks);
  n_art := jsonb_array_length(other_artists);

  for fan in select * from jsonb_array_elements(fans)
  loop
    fan_id := gen_random_uuid();
    fan_email := (fan->>'u') || '@mixtape.com';
    off    := off + 1;   -- advance the rotating window for each fan

    -- --- auth.users -------------------------------------------------------
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change, email_change_token_new
    ) values (
      zero_instance, fan_id, 'authenticated', 'authenticated',
      fan_email,
      crypt(demo_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', fan->>'n', 'username', fan->>'u'),
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      fan_id::text, fan_id,
      jsonb_build_object(
        'sub', fan_id::text,
        'email', fan_email,
        'email_verified', false,
        'phone_verified', false
      ),
      'email',
      now(), now(), now()
    );

    -- --- profile ----------------------------------------------------------
    insert into public.profiles (id, name, username, role, city, country)
    values (
      fan_id, fan->>'n', fan->>'u', 'fan', fan->>'city', fan->>'co'
    );

    -- --- fan_follows (CONSENTED - consented_at must be non-null) -----------
    -- top_track is the free-text favourite surfaced per-city on the map.
    insert into public.fan_follows (fan_id, artist_id, consented_at, top_track)
    values (
      fan_id,
      artist_id,
      now() - make_interval(days => (fan->>'age')::int),
      fan->>'top'
    );

    -- --- fan_spotify_data -------------------------------------------------
    -- Synthetic per-fan Spotify-like snapshot. Fan screens show each fan their
    -- own top tracks/artists from this row; artist screens should avoid using
    -- it for direct product claims while Spotify sync is not reliable.
    --
    -- top_tracks = the first `nova` Nova Sky tracks (so the artist's own songs
    -- always dominate the tally) PLUS `oth` tracks drawn from the shared pool
    -- through a per-fan ROTATING window. Rotating (rather than always taking
    -- the first few) spreads the "other" picks around so the aggregated counts
    -- form a realistic gradient instead of every popular track hitting 20/20
    -- (which would flatten the dashboard's sparkline).
    top_tracks := (
      select coalesce(jsonb_agg(elem order by sort_key), '[]'::jsonb)
      from (
        -- Nova Sky tracks first (sort_key 0..nova-1)
        select t.elem, (t.ord - 1) as sort_key
        from jsonb_array_elements(nova_tracks) with ordinality t(elem, ord)
        where t.ord <= (fan->>'nova')::int
        union all
        -- then a wrapping window of `oth` items from the shared pool
        select other_tracks->(((off + k) % n_oth)) as elem,
               1000 + k                            as sort_key
        from generate_series(0, (fan->>'oth')::int - 1) as k
      ) s
    );

    -- top_artists = Nova Sky themselves + a wrapping window of `art` artists
    -- from the shared pool (same rotation idea as above).
    top_arts := nova_artist || (
      select coalesce(jsonb_agg(other_artists->(((off + k) % n_art)) order by k), '[]'::jsonb)
      from generate_series(0, (fan->>'art')::int - 1) as k
    );

    -- recently_played: synthesise `plays` rows. Only the array length is read
    -- by the dashboard, so the inner objects are plausible but illustrative.
    recent := '[]'::jsonb;
    for i in 1..(fan->>'plays')::int loop
      recent := recent || jsonb_build_object(
        'track', nova_tracks->((i - 1) % jsonb_array_length(nova_tracks)),
        'played_at', to_char(now() - (i || ' hours')::interval,
                             'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      );
    end loop;

    insert into public.fan_spotify_data (
      fan_id, profile, top_tracks, top_artists, recently_played, fetched_at
    ) values (
      fan_id,
      jsonb_build_object(
        'id', fan->>'u',
        'display_name', fan->>'n',
        'email', (fan->>'u') || '@spotify.example.com',
        'country', fan->>'co'
      ),
      top_tracks,
      top_arts,
      recent,
      now()
    );
  end loop;

  raise notice 'Seed complete: artist % + % collaborator artists + % fans inserted.',
    artist_email, jsonb_array_length(demo_artists), jsonb_array_length(fans);
end $$;


-- ============================================================================
-- CLEANUP (optional) - delete the demo data so you can re-seed from scratch.
-- Deleting the auth.users rows cascades to profiles, fan_follows,
-- fan_spotify_data and releases via ON DELETE CASCADE. Uncomment to use.
-- ============================================================================
-- delete from auth.users
-- where email in (
--   'novasky@mixtape.com',
--   'lunavale@mixtape.com',
--   'circuitbloom@mixtape.com',
--   'harborglass@mixtape.com'
-- )
--    or email like 'fan_%@mixtape.com';
