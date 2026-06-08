# Mixtape — Manual QA Walkthrough

An all-encompassing, mission-and-objective verification script covering **every screen of the Mixtape platform** — app launch, the full Auth/onboarding stack, the complete Fan experience (4 tabs + public artist profile), the complete Artist experience (5 tabs), and cross-cutting behavior (session persistence, deep links, error states).
Follow it top to bottom. Each objective lists exactly what to tap and what you should see. You do not need to read any code.

Supports issues **#24** (verify auth), **#25** (verify fan view), **#27** (verify artist view), and serves as the platform-wide regression checklist.

A complete screen map is in **Appendix A** at the bottom — use it to confirm nothing is left untested.

---

## 1. Preconditions / Setup

### 1.1 Environment variables
The app reads three public env vars from `mixtape/.env`. Confirm all three are set (values must be non-empty):

| Variable | Used for |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` | Spotify OAuth client ID (for the fan "connect Spotify" step) |

If any are missing the app will fail to talk to Supabase, or the Spotify step will error out.

### 1.2 Supabase schema applied
Apply `mixtape/supabase/migrations/20260608045615_initial_schema.sql` to your Supabase project (Supabase SQL editor or CLI). It is idempotent and safe to re-run. It creates four tables — `profiles`, `fan_follows`, `fan_spotify_data`, `releases` — plus Row Level Security policies. The artist dashboard only sees fan data because of the RLS policy on `fan_spotify_data`, so the schema must be applied for insights to work.

### 1.3 Email confirmation MUST be off
**Critical.** Accounts are created with synthetic `username@mixtape.com` emails that can never receive a confirmation link. In the Supabase Dashboard go to **Authentication → Providers → Email** and set **"Confirm email" = OFF**.

If this is left on, sign-up returns no session, the first Spotify sync silently drops its data, and you will not be able to complete onboarding.

### 1.4 Demo data
There is **no seed script**. You create demo data by hand during this walkthrough:
- The **Auth** section has you create one artist account and one fan account.
- For the Fan and Artist sections to show meaningful data, you want **at least one artist** to exist before a fan onboards (so the fan has someone to follow), and **at least one fan sharing** before you check the artist dashboard.
- Recommended order: run **Auth** first (creates both accounts), then **Fan** (fan connects Spotify + shares with the artist), then **Artist** (sign back in as the artist to see the fan's data).
- Tip: pick memorable usernames, e.g. artist `lunadrift`, fan `ayushfan`, password `mixtape123` (meets the 8-char + number rule).

### 1.5 Spotify account
The fan "connect Spotify" step runs a real Spotify OAuth login. Have Spotify credentials ready, and make sure the Spotify app's redirect URI allows the Expo dev redirect (watch the Metro console — `useSpotifyAuth` logs the `Redirect URI` on launch; that exact URI must be registered in your Spotify developer app). The signed-in Spotify account needs some listening history for top tracks/artists to appear.

### 1.6 How to run
```
cd mixtape
npx expo start
```
Then open the app on a device/simulator (press `i` for iOS, `a` for Android, or scan the QR code with Expo Go). The first screen is the **Mixtape landing page** with **Sign up** and **Sign in** buttons.

> Note on tab labels: the **fan** tab bar reads HOME / FOR YOU / SHARING / YOU. The **artist** tab bar reads INSIGHTS / FANS / COLLAB / RELEASES / PROFILE and uses a dark theme. You can always tell which experience you're in by the theme (fan = light, artist = dark).

---

## 2. Auth

**Mission:** Verify that a new user can create a fan or artist account, sign in and out, recover from a wrong password, request a reset link, and that each role lands in the correct part of the app.

### Objective A1 — Sign up as an artist
**Steps**
1. From the landing screen tap **Sign up**.
2. On **Create an Account**, enter a Name (e.g. `Luna Drift`), a Username (e.g. `lunadrift`), a Password (e.g. `mixtape123`), and the same value in Confirm Password.
3. Tap **Create account**.
4. On **How will you use Mixtape?** tap the **Artist** card (it shows a "SELECTED" badge), then tap **Continue as Artist**.

**Expected result**
- As you type the password, two checks appear and turn green: "At least 8 characters" and "Contains a number". The Create account button is disabled until both pass and the passwords match.
- After tapping Create account you land on the role picker.
- After Continue as Artist you go **straight to the artist dashboard** — the dark-themed `(artist-tabs)` view, INSIGHTS tab, greeting "Hey, Luna." Artists skip the location / Spotify / follow steps entirely.

### Objective A2 — Sign up as a fan
**Steps**
1. If you're currently signed in as the artist, sign out first (see A7).
2. Landing screen → **Sign up**.
3. Enter Name (e.g. `Ayush`), Username (e.g. `ayushfan`), Password `mixtape123`, confirm it.
4. Tap **Create account**.
5. On the role picker, leave **Fan** selected (it's the default) and tap **Continue as Fan**.

**Expected result**
- After Continue as Fan you go to **Where are you based?** (the location step), **not** to the tabs. This is the start of the fan onboarding chain (continue it in the Fan section, objective F1).

### Objective A3 — Password mismatch / weak password are blocked
**Steps**
1. Start a sign up. Type a password shorter than 8 chars or with no number.
2. Type a different value in Confirm Password.

**Expected result**
- The "At least 8 characters" / "Contains a number" checks stay grey while unmet.
- "Passwords do not match." appears in red under Confirm Password.
- The **Create account** button stays dimmed/disabled; you cannot submit.

### Objective A4 — Sign in
**Steps**
1. From the landing screen tap **Sign in**.
2. Enter the artist username `lunadrift` (username only, no `@mixtape.com`) and password `mixtape123`.
3. Tap **Sign in**.

**Expected result**
- You are routed by role: the artist lands in the dark **(artist-tabs)** INSIGHTS dashboard.
- Repeat with the fan `ayushfan` and you land in the light **(tabs)** view.
- (Username is case-insensitive and trimmed; the app appends `@mixtape.com` for you.)

### Objective A5 — Wrong password shows a friendly error
**Steps**
1. Landing → **Sign in**.
2. Enter a valid username but a wrong password.
3. Tap **Sign in**.

**Expected result**
- An alert titled **"Sign in failed"** with the message **"Wrong username or password. Please try again."**
- You stay on the sign-in screen; no navigation happens.

### Objective A6 — Forgot password
**Steps**
1. Landing → **Sign in** → tap **Forgot password?**.
2. Enter a username and tap **Send reset link**.

**Expected result**
- The screen switches to a **"Check your email"** confirmation with a mail icon and a **Back to sign in** button.
- Note: because accounts use synthetic `@mixtape.com` emails, no real email is delivered. This objective only verifies the request flow and confirmation UI, not inbox delivery.

### Objective A7 — Sign out
**Steps**
- **As a fan:** go to the **YOU** tab → scroll to **ACCOUNT** → tap **Sign out**.
- **As an artist:** go to the **PROFILE** tab → scroll to **ACCOUNT** → tap **Sign out**.

**Expected result**
- The button shows "Signing out..." then you are returned to the **sign-in** screen. Re-opening a tab is no longer possible without signing in again.

---

## 3. Fan

**Mission:** Verify a fan can finish onboarding, connect Spotify and see their own listening data, discover artists, open an artist's public profile, share with one (with the consent screen), and later revoke sharing.

> Start signed in as the fan you created in A2, mid-onboarding on the **Where are you based?** screen. If you already finished onboarding, you can re-run the connect/share steps from inside the tabs (noted below).

### Objective F1 — Finish fan onboarding (location)
**Steps**
1. On **Where are you based?** tap the **COUNTRY** field, type to search (e.g. `United States`), and pick a country from the dropdown.
2. Tap the **CITY** field (now enabled) and pick a city (e.g. `Los Angeles`).
3. Tap **Continue**.

**Expected result**
- The City field is disabled until a country is chosen ("Select a country first").
- Continue is disabled until both country and city are set.
- After Continue you advance to **Connect your music**.
- (There is a **SKIP** link top-right that jumps straight to the tabs; for full verification do not skip.)

### Objective F2 — Connect Spotify
**Steps**
1. On **Connect your music**, tap **Connect** on the Spotify card.
2. In the bottom sheet that appears, tap **Continue to Spotify**.
3. Complete the Spotify login/authorize in the browser that opens.
4. Back in the app, tap **Continue**.

**Expected result**
- After authorizing, the Spotify card flips to **CONNECTED** (green) and the bottom sheet closes.
- The main **Continue** button becomes enabled (it is disabled until Spotify is connected).
- In the Metro/terminal console you should see logs like "Spotify connected. Access token received." and "Spotify data saved to Supabase." — this is the only place fan listening data is fetched and stored (`fan_spotify_data`).
- Continue advances you to **Who do you want to share with?** (the follow-artist step).
- The **Apple Music** card shows **COMING SOON** and is not tappable.

### Objective F3 — Share with an artist during onboarding (consent + favorite song)
**Steps**
1. On **Who do you want to share with?**, find your artist (`Luna Drift`) in the list — or type in the search box.
2. Tap the artist row (or its **Pick** button).
3. On **What's your favorite song by Luna?**, type a song title (e.g. `Moonlit`) and tap **Continue** (or tap **SKIP** to leave it blank).
4. On the consent screen review what's shared, then tap **Share with Luna**.

**Expected result**
- The artist list is populated from real artist profiles in Supabase, so your artist must exist (created in A1).
- The consent screen ("Luna will see, only from you:") lists shared items with check marks (listening, per-track plays, timing, other artists, your city) and one **un-checked** item: "Other artists you share with on Mixtape".
- After tapping Share you land on the fan tabs. The follow is written to `fan_follows` with your favorite song stored as `top_track`.
- The favorite song you typed is what later appears as the city's "Top Song" on the artist's fan map.

### Objective F4 — See your top tracks and artists on the You tab
**Steps**
1. Tap the **YOU** tab.

**Expected result**
- Header card shows your name, `@username`, and city/country.
- Stat row shows **SHARING WITH** (count of artists you share with — should be ≥ 1 after F3), **TOP TRACKS**, and **TOP ARTISTS**.
- **YOUR TOP TRACKS** and **YOUR TOP ARTISTS** sections list up to 5 each, pulled from the Spotify data synced in F2.
- A **SPOTIFY** section shows "Connected" with a "Last synced" date and a **Re-sync listening data** row.
- If you skipped Spotify, instead you see a "No listening data yet" card prompting you to connect.

### Objective F5 — Browse artists (For You)
**Steps**
1. Tap the **FOR YOU** tab.
2. Optionally type in the search box (matches name, username, or genre).

**Expected result**
- A scrollable list of artist cards (name, `@username`, bio, genre tags, location).
- Artists you already share with show a green **Sharing** badge and are sorted to the bottom; artists you don't yet share with show a pink **Share** badge and are listed first.
- Tapping an artist you do **not** yet share with opens the share-consent flow for them. Tapping one you already share with does nothing.

### Objective F6 — Share with another artist from inside the app
**Steps**
1. Go to the **SHARING** tab and tap **Share with another artist** (bottom button), **or** in **FOR YOU** tap an un-shared artist card.
2. Complete the consent flow and tap **Share with …**.

**Expected result**
- You return to the tabs and the new artist now appears in your Sharing list and as a green "Sharing" card in For You.
- (To exercise this you generally need a second artist account; create one via A1 if you only made one.)

### Objective F7 — View a public artist profile
**Steps**
1. Open an artist's public profile page. This screen lives at route `(tabs)/artist/[id]`; the in-app way to reach it is a deep link (see the Cross-cutting section, X3) or any navigation that pushes `/(tabs)/artist/<artistId>`. If your build does not yet link to it from a list, exercise it via the deep link.
2. On the profile, review the bio and social links; tap a social link row.
3. Tap **Share with <first name>** at the bottom (if you are not already sharing).

**Expected result**
- A centered profile card: avatar with initials, artist name, `@username`, genre tags, location, and a "**N fans** sharing" badge (consenting followers only).
- **ABOUT** (bio) and **FIND THEM ON** (Instagram / TikTok / Website) sections appear only if those fields are set; tapping a link opens it in the browser.
- If you already share with this artist, the bottom CTA is replaced by a green **Sharing** badge and there is no Share button.
- If you are not sharing, tapping **Share with …** opens the same consent flow as F3/F6.
- An invalid/unknown id shows "Artist not found."

### Objective F8 — Revoke sharing (Sharing tab)
**Steps**
1. Tap the **SHARING** tab.
2. On an artist card tap **Stop sharing**.
3. In the confirmation alert tap **Stop sharing** again (destructive).

**Expected result**
- The heading reads "Active with N artists." and each card shows "Sharing since <date>", an "Active" status dot, and a "WHAT THEY SEE" summary.
- After confirming, the card disappears from the list. (Under the hood the row's `consented_at` is set to null — the row is kept, not deleted, so re-sharing later reuses it.)
- That artist's dashboard will no longer count you or see your data.

---

## 4. Artist

**Mission:** Verify an artist can finish onboarding, view the aggregated insights dashboard, see the fan listener map, add a release, and edit their profile.

> Sign in as the artist (`lunadrift`). For the dashboard and map to show data, complete the Fan section first so at least one fan is sharing with this artist **and** has synced Spotify data.

### Objective R1 — Finish artist onboarding
**Steps**
1. This was effectively done in **A1**: choosing **Artist** on the role picker creates the profile and drops you directly into the artist dashboard. There is no location/Spotify/follow flow for artists.

**Expected result**
- You are in the dark-themed **(artist-tabs)** view on the **INSIGHTS** tab, greeting "Hey, <first name>."
- The bottom tab bar shows INSIGHTS / FANS / COLLAB / RELEASES / PROFILE.

### Objective R2 — View the insights dashboard
**Steps**
1. Tap the **INSIGHTS** tab (the default landing tab).

**Expected result**
- A privacy banner: "Insights from **N fans** who explicitly chose to share with you. Aggregated only…" where **N** is your consenting-fan count.
- A **plays card** showing a total plays number (sum of consenting fans' recently-played counts) with a sparkline, plus a "N sources" badge when there are plays.
- A stat row: **CONSENTING FANS**, **UNIQUE TRACKS**, **RELATED ARTISTS** (each shows `--` when there's no data).
- **Top tracks from fans** and **Artists your fans listen to** lists (up to 5 each), each row showing how many fans (`N fans`).
- If no fan has shared/synced yet, you instead see a "Waiting for fan data" empty state.
- Verify the counts move: after a fan shares + syncs (Fan section) the CONSENTING FANS count and lists should reflect it; after that fan revokes (F8) the count should drop on next load.

### Objective R3 — View the fan listener map
**Steps**
1. Tap the **FANS** tab.
2. When the map loads, tap a glowing city dot.
3. Tap **VIEW YOUR TOP CITIES** at the bottom to expand the ranked list.

**Expected result**
- A dark world map (Leaflet in a WebView) with pulsing dots at the cities of your consenting fans. The header badge shows a total listener count.
- Tapping a dot opens a card with the city/country, "Listeners This Month", "Est. Total Listens", and a **Top Song** (the most common favorite song fans entered for that city in F3).
- The bottom panel expands to a ranked list of cities with bars.
- If no consenting fan has a city set, the map shows "No location data yet".

### Objective R4 — Add a release
**Steps**
1. Tap the **RELEASES** tab.
2. Tap **Add** (top-right) — or **Add your first release** in the empty state.
3. Enter a Title (e.g. `Midnight EP`), pick a Type chip (**Single / EP / Album**), and tap **Save**.

**Expected result**
- The form appears with Title and Type fields. Save is disabled until a title is entered.
- After saving, the new release appears at the top of the list with a type badge and a date ("Unreleased" if no date), and a track count line ("1 track") for singles.
- Reload the tab — the release persists (written to the `releases` table).

### Objective R5 — Edit profile
**Steps**
1. Tap the **PROFILE** tab.
2. Tap **Edit** (top-right).
3. Change the Name, add a Bio, select one or more Genre chips, fill City/Country, and add Instagram / TikTok / Website handles.
4. Tap **Save**.

**Expected result**
- In edit mode the Name becomes an inline input and Genres / Location / Social Links sections appear with fields.
- After Save you return to view mode and your changes are shown: bio text, genre tags, location row, and tappable social link rows (each opens the URL in a browser).
- The **CONNECTED ACCOUNTS** section shows Spotify with your account email, and **ACCOUNT** shows Email / Username / Role.
- Reload — changes persist (written to `profiles`). Because fans read the same `profiles` row, your updated bio/genre/location now show on the For You artist card and the public artist profile.

### Objective R6 — View collaboration recommendations (COLLAB)
**Steps**
1. Tap the **COLLAB** tab.
2. If recommendation cards appear, tap a **Message · soon** button.

**Expected result**
- Header "Artists to work with" with the subtitle about aggregated-only fan data.
- A ranked list of other artist cards, each with reason chips: "N shared fans" (fans who consent to both you and that artist) and/or genre-match chips (genres your fans listen to that the candidate also makes).
- Tapping "Message · soon" shows a **"Coming soon"** alert (direct messaging is a stretch goal, intentionally stubbed — not a bug).
- Empty states are expected early on: with no consenting fans you'll see "Once fans share their listening with you, we'll suggest artists…"; with fans but no overlap/genre match you'll see "No matches yet". To actually populate this you need **multiple artists and at least one fan who shares with two of them** — set that up by having your fan account (Fan section) share with a second artist, and give the candidate artists genres that match the fan's Spotify top-artist genres.

---

## 5. Known gaps

Things the current code does **not** do yet. These are expected behavior for now, so don't file them as new bugs from this walkthrough:

- **Artist insights aggregate each fan's GLOBAL top tracks/artists**, not just tracks by that artist. "Top tracks from fans" and "Artists your fans listen to" tally every fan's full Spotify top-50, so an artist will see songs and artists unrelated to themselves. The per-artist filtering isn't implemented.
- **Sharing does not fetch Spotify data.** The consent step (`share-consent`) only writes the follow row; it does not pull listening data (there's an explicit TODO). A fan's data only reaches Supabase via the **Connect Spotify** OAuth flow (F2). So if a fan shares but never connected Spotify, the artist's CONSENTING FANS count increases but the tracks/plays stay empty.
- **Re-sync re-runs the full Spotify OAuth.** On the YOU tab, "Re-sync listening data" just reopens the `connect-music` screen and makes you authorize Spotify again from scratch — there's no silent refresh-token re-sync.
- **Apple Music is "coming soon".** The Apple Music card on Connect your music is disabled; only Spotify works.
- **Map listener numbers are partly synthetic.** A city's "Listeners This Month" is the count of consenting fans in that city; "Est. Total Listens" is just that count × 7 — it is not real play data.
- **The fan HOME tab is not a fan home.** The first fan tab (HOME) currently renders an artist-style insights dashboard (activity feed, "Top tracks from fans", etc.) rather than fan-oriented content. The genuine fan experience lives in the **FOR YOU**, **SHARING**, and **YOU** tabs — verify fan workflows there, not on HOME.
- **COLLAB messaging is stubbed.** The COLLAB tab and its recommendation engine work (objective R6), but the "Message · soon" button only shows a "Coming soon" alert — direct artist-to-artist messaging is a deliberate stretch-goal stub, not a broken button.
- **Onboarding steps are skippable.** Location, Spotify, follow-artist, and favorite-song all have SKIP / "Not now" links that jump to the tabs. A fan can reach the app with no location and no Spotify connected; the relevant screens then show empty states.

---

## 6. Cross-cutting (whole-platform behavior)

**Mission:** Verify behavior that isn't owned by a single tab — app launch, session persistence, deep links, and global loading/error states.

### Objective X1 — Cold launch & landing
**Steps**
1. Fully close the app, then launch it while **signed out**.

**Expected result**
- A native **splash screen** shows while custom fonts load (the root layout holds the splash until fonts are ready, then hides it).
- You land on the **Mixtape landing screen** (logo, "mixtape", tagline, **Sign up** / **Sign in**). A brief centered spinner (the Loading component) may flash while the session is resolved.

### Objective X2 — Session persistence across restart
**Steps**
1. Sign in (as either role) and reach the tabs.
2. Fully quit the app (swipe it away), then reopen it.

**Expected result**
- The Supabase session is restored from storage; you are **not** forced back to the landing screen on next navigation. (Sessions persist via AsyncStorage and auto-refresh while the app is foregrounded.)
- After signing out, quitting, and reopening, you should land on the landing screen — the session is cleared.
- Edge case: if a stored session is stale/invalid, the app silently signs you out locally rather than crashing.

### Objective X3 — Deep link to a public artist profile
**Steps**
1. While signed in as a fan, trigger a deep link to `/(tabs)/artist/<artistId>` (use a known artist's profile id). With Expo you can open the URL via the dev tools, a typed URL on web, or an in-app navigation if your build links to it.

**Expected result**
- The public artist profile (objective F7) opens with that artist's data. This is the screen intended to be reachable by deep link; it is hidden from the fan tab bar (`href: null`) on purpose.

### Objective X4 — Role isolation
**Steps**
1. Signed in as a **fan**, confirm the tab bar is light-themed (HOME / FOR YOU / SHARING / YOU) and you cannot see artist-only tabs.
2. Signed in as an **artist**, confirm the tab bar is dark-themed (INSIGHTS / FANS / COLLAB / RELEASES / PROFILE) and there is no fan sharing UI.

**Expected result**
- The two experiences never overlap. Role is read from `profiles.role` at sign-in and routes you to the correct tab group; there is no in-app role switch.

### Objective X5 — Global loading & error states
**Steps**
1. Throttle or briefly disable the network, then open data-driven screens (You, For You, Sharing, Insights, Fans, Collab).

**Expected result**
- Each screen shows a sensible loading state first ("Loading…", spinners, or skeleton text) and then either data or a clear empty/error state ("No artists found.", "Waiting for fan data", "Couldn't load recommendations" with a Try again button, "⚠ <error>" on the map). No screen should crash or hang on a blank page.

---

## Appendix A — Complete screen map

Every routable screen in the app and the objective(s) that cover it. Use this to confirm full coverage.

| Route / file | Screen | Covered by |
| --- | --- | --- |
| `app/index.tsx` + `components/login.tsx` | Landing (signed-out) | X1 |
| `components/loading.tsx` | Loading spinner (transitional) | X1, X5 |
| `(sign-in)/make-account.tsx` | Create account | A1, A2, A3 |
| `(sign-in)/select-account.tsx` | Choose role (Fan/Artist) | A1, A2 |
| `(sign-in)/sign-in.tsx` | Sign in | A4, A5 |
| `(sign-in)/forgot-password.tsx` | Forgot password | A6 |
| `(sign-in)/select-location.tsx` | Fan onboarding — location | F1 |
| `(sign-in)/connect-music.tsx` | Fan onboarding — connect Spotify | F2 |
| `(sign-in)/follow-artist.tsx` | Fan onboarding — pick artist | F3 |
| `(sign-in)/favorite-song.tsx` | Fan onboarding — favorite song | F3 |
| `(sign-in)/share-consent.tsx` | Share consent screen | F3, F6, F7 |
| `(tabs)/index.tsx` | Fan HOME (currently an insights-style dashboard — see Known gaps) | F4 entry; note in Known gaps |
| `(tabs)/for-you.tsx` | Fan FOR YOU — discover artists | F5 |
| `(tabs)/sharing.tsx` | Fan SHARING — manage/revoke | F6, F8 |
| `(tabs)/you.tsx` | Fan YOU — profile, top tracks/artists, Spotify, sign out | F4, A7 |
| `(tabs)/artist/[id].tsx` | Public artist profile (deep-linked) | F7, X3 |
| `(artist-tabs)/index.tsx` | Artist INSIGHTS dashboard | R1, R2 |
| `(artist-tabs)/fans.tsx` | Artist FANS — listener map | R3 |
| `(artist-tabs)/collaborate.tsx` | Artist COLLAB — recommendations | R6 |
| `(artist-tabs)/releases.tsx` | Artist RELEASES | R4 |
| `(artist-tabs)/profile.tsx` | Artist PROFILE — edit, socials, sign out | R5, A7 |

Supporting (non-screen) modules exercised indirectly: `utils/navigateByRole` (role routing — A4, X4), `utils/useSession` (session persistence — X2), `utils/useSpotifyAuth` (Spotify OAuth + data sync — F2), `utils/fanInsights` (shared aggregation behind R2 and R6), `database/db` (Supabase client).
