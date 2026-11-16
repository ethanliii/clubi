# Bryan's UI pass: what changed and what the backend still needs

Branch `bryan-ui-input`, merged up to `main` first. Decisions come from the merge doc (Bryan + Ethan).

## Decisions applied
- **Tabs:** Home = friend feed (landing screen) · Map · + Rate · **Search** (tonight picks, was Home) · Profile. `(tabs)/feed.tsx` removed, `(tabs)/search.tsx` added.
- **Welcome:** labels stay "Create account" / "Sign in" (Revyl tests need updating), plus "Continue with Apple" / "Continue with Google" buttons (show "Coming soon" until OAuth exists).
- **Sign-up before the quiz:** username, password, display name, birthday (YYYY-MM-DD), home city. Profile fields go through `settings.update` right after sign-up (UI-SPEC §1 fallback).
- **Bryan's quiz kept:** song stars, this-or-that, 3 random scenarios, squad, weekly nights, budget, hot takes, interests (= backend card 6), filters, location/notifications, "Been here?". `src/features/quiz.ts → toBackendCards()` maps it onto the backend's 6 cards so `users.saveQuiz` works today.
- **Taste card:** meters from `tasteSummary` (backend), persona name local. Then **Find friends** (`friends.suggestions` + `friends.search` + `friends.request`) → "Let's go".
- **Venue route:** `venue/[kind]/[id]` wired to `places.get` + `saves.toggle`; "Rank this place" opens `/rate?kind=&id=`.
- **Root gating:** signed out → welcome · signed in and not onboarded → quiz · otherwise tabs (`users.me.onboarded`).
- No scores, orders or "why" lines are computed in the UI. Friend scores show side by side, never averaged.

## Pass 2 (decisions Q7, Q8, Q16, Q18, Q20)
- **Feed (Q18):** like (`posts.react`), save the place (`saves.toggle`, "want"), comments sheet (`posts.comments` / `addComment` / long-press to delete).
- **Rank flow (Q16):** pick spot → 🔥 Loved it / 😐 It was fine / 💀 Didn't like it → "Which was better?" binary search (≤4 rounds, "Too close to call") → tags, caption, Who sees it (Friends / Public / Only me) → Post (`rankings.rank`) → result → quick questions (`insights.questionsFor` / `submit`). Photo step not added yet.
- **Social (Q20):** `friends.tsx` (search, requests, suggestions with reason, friends, sent), `user/[userId]` (profile + friend button by status), `compare/[userId]`, my Profile tab from `profile.get`. Replaces `friend/[id]` and `compare.tsx`.
- **Q7:** "Been here?" stays; needs backend E6 to save. **Q8:** taste card = backend meters + local persona.

## Pass 3 (reference recordings: Beli feed + rank flow, Letterboxd, Instagram, TikTok)
- **Feed card (Beli):** "Name ranked Place" + colored score ring, up to 2 photos side by side (no placeholder when there are none), "Notes:", tags, "You gave it X", heart · comment · share on the left, ⊕ Rank it too + bookmark on the right, Today / Yesterday dividers.
- **Rank flow (Beli):** "Add to my list of …", "Would you go back?" as three colored circles, "Which do you prefer?" with OR, and Undo · Too tough · Skip (Skip compares against the next place instead).
- **Later, needs backend:** a "For You" full-screen mode (Instagram/TikTok) needs a public feed; "ranked with Nicole, Leanna…" needs tagged friends on a post; visit count needs a visits field. Letterboxd-style quick sheet (Been / Save / Going + share to stories) can be added to the venue page.

## Pass 4 (references: Beli My Lists, Google Maps place card, Instagram profile)
- **Map tab:** real map (react-native-maps; web shows a note), pins by `tier` (top = ringed score bubble, good = labeled bubble, other = dot, events dashed), the 7 "Filter: …" chips, search, ranked sheet list, OSM attribution, demo-location switch, recenter. Tap a pin → Google-Maps-style card: Directions · Rank this place · Save · Details, a swipeable strip of friends' photos (name · score · when), Know before you go (insights), quote cards.
- **My lists (`rankings.tsx`):** Been (`rankings.mine`) · Want to go / Going (`saves.list`), category chips, score rings, floating View map.
- **Profile (Instagram):** avatar + posts / friends / ranked counts, @username · city, bio, Edit profile / Share profile (or Add friend / Compare), taste meters, "memories" highlight circles (top place of each list + New), Photos grid / Ranked lists tabs.

## Not done yet
Map pins by tier with Bryan's bubble style · rankings / plan / notifications / settings / saved / trips / performer screens · photo upload in the rank flow · light/dark toggle · public accounts + Follow (backend ask below).

## Backend asks (optional fields only)
| # | Ask | For |
|---|---|---|
| E1 | `saveQuiz` accepts the full quiz answers (see `QuizAnswers` in `src/features/quiz.ts`) | Quiz |
| E3 | Describe-your-night: free text → filters + friend ids (Search uses `places.search` until then) | Search |
| E5 | `friendsAvg` on `NearbyItem` | Map badges |
| E6 | Bulk seed ratings from "Been here?" (answers kept on device for now) | Quiz |
| E11 | Apple + Google OAuth providers in `convex/auth.ts` | Welcome |
| E13 | Pinned favorites / highlights on a profile (photo ids + titles), followers count for public accounts | Profile |
| E12 | Public / private accounts: `isPublic` setting, `follows` (follow / unfollow, follower counts), `ProfileResult.user.isPublic`, `canSee` true for public | Q20 |
| — | Vibe filter on `discover.tonight` / `forGroup` (Vibe chips pass to Plan my night for now) | Search |

## Pass 5 (Hinge sign-up + "You're in")
- **Create account (`(onboarding)/create-account.tsx`), Hinge-style, one question per screen:** name → "An easier way to sign back in" (Google / Apple, No thanks) → username → password → birthday + "You're 19" confirm card → home city → Create account (`signUp`, then `settings.update`) → quiz. `sign-in.tsx` stays for signing back in.
- **"You're in" (`(onboarding)/youre-in.tsx`) replaces the taste card + Find friends:** persona line, Sync contacts (stub), People you may know / Similar taste (`friends.suggestions`, split by mutual friends, order kept), Picked for you tonight (`discover.tonight`), Let's go.
- **Needs backend:** phone / email verification codes (Hinge asks for both) need an SMS / email provider; contact sync needs `expo-contacts` + a hashed-number lookup.

## Pass 6 (Home spotlight)
- **Home:** "Last night" / "All friends" toggle. Last night = one big photo card per friend (their newest post, feed order), swipe or "Next friend →", dots, "See all friends' posts". All friends = the full feed.
- **Photo shape:** edge-to-edge 4:5 portrait, square corners (Instagram), one friend per screen width. Only the friend (avatar, name, time) sits on the photo.
- **Under the photo:** heart · comment · bookmark (with counts), score pill on the right with the post's `label` in tiny text under it, then the place name and the caption.
- **Quick actions on each spotlight card (Instagram-style):** double-tap the photo to like (`posts.react`), hold to save (`saves.toggle` "want"). Small action row under the photo: heart · comment (opens `CommentsSheet`) on the left, bookmark on the right. Tap the place name to open the venue.
- **Needs backend (E14):** "closest friend first" ordering (e.g. by interactions or taste match) and a "went out last night" window on `posts.feed`; the UI keeps the backend's order.

## Pass 7 (profile = photos first)
- **Profile (`ProfileView`):** taste meters and the highlight circles removed (taste stays on Compare). New **Favorites** row: up to 3 big photos from `onboarding.pins` (pin order); before anyone pins, their newest photo posts. Hold a photo in your own grid to pin / unpin (`onboarding.setPins`). New **Top spots**: the #1 of each list (backend order, max 3) with photo, name, score. Photos tab is first.
- **Needs deploy:** `onboarding.pins` / `setPins` are on this branch only, so Favorites works after the merge + deploy from `main`.

## Pass 8 (dark onboarding)
- Create account + taste quiz now use the app's dark palette (`src/theme/onboarding.ts`, `onboardingColors`), so the whole app is dark like the rest (app.json is dark-only). The cream Hinge palette is kept there as `ONBOARDING_LIGHT` for a future light theme. "You're in" already used the dark theme.

## Pass 9 (entry points for main's screens, branding)
- **`src/lib/links.ts` copied byte-for-byte from `main`** so the merge has nothing to resolve there. New buttons use its `paths` / `postPath`.
- **Buttons for main's screens (same labels as main):** Profile tab → gear "Settings", links Friends · Saved · Following · Trips · My rankings · Notifications; "Edit profile" → `/settings`; friend profile → "Invite <name> to a trip" (→ `/trips`); Search → Trips · Saved under Plan my night; feed card → "View post" (`/post/<id>`); profile grid photo → `/post/<id>`. These routes (`trips`, `trip/[tripId]`, `saved`, `settings`, `following`, `post/[postId]`, `performer/[performerId]`) come from `main` on merge.
- **Brand:** name "clubi", tagline "Go where your friends go.", `DESCRIPTION` in `src/constants/brand.ts` + `app.json` description. Google / Apple buttons smaller (16 px mark, 14 px label).

## Pass 10 (Add a spot + Near me)
- **Add tab (was Rate):** tab label "Add", heading "Add a spot". Tap a row to rank it (same flow). Bookmark button on each row saves it to Want to go (`saves.toggle` type "want"). The "Would you go back?" step also has "Haven't been yet? Save for later". Search box keeps the accessibility label "Where did you go?" for Revyl; **Revyl tests that tap the "Rate" tab need the new label "Add".**
- **Map → Near me:** pill before the filter chips. Shows events within 1.5 km from `discover.nearby({ filter: "events", radiusMeters: 1500 })`, in the backend's order (fit + distance + timing, `mapRank`), with a header "Events near you". Tapping any other filter turns it off.

- **Rank question:** "Would you go back?" (was "How was it?"), answers below.
- **Bucket labels, no emojis:** "Absolutely" (`loved`) · "Depends" (`fine`) · "Nope" (`didnt`), plain colored circles. Same in `(tabs)/rate.tsx`, main's `features/rate/steps.tsx` and the quiz's "Been here?". Backend bucket values unchanged. **Revyl tests and UI-SPEC §6 still say "Loved it / It was fine / Didn't like it" and need the new labels.**

## Pass 11 (full search, references: Spotify search + Beli search)
- Search tab box now opens `features/search/SearchMode.tsx`: search box + **Cancel**, **Places / People** tabs (Beli's Restaurants / Members), "Current location" row, pills **Near me** (opens Map with Near me on, `?nearMe=1`) · **Want to go** (`/saved`) · **Plan my night**, then **Recent searches** (this device only, `src/lib/recentSearches.ts`, SecureStore, 8 max) or live results.
- Rows (Spotify): 48 px thumbnail, name, "Place · Bar · 0.4 mi" / "@username · 2 mutual", ⊕ add to Want to go → green ✓, ✕ remove from recents. People rows use `FriendButton`. Results from `places.search` / `friends.search`, backend order.
- Search box keeps the accessibility label "Describe your night". The free-text "describe your night" parser is still backend ask E3.

## Pass 12 (merge of Ethan's `ui-overhaul`: Ethan's code, Bryan's look)
Branch `merge-ui-overhaul` = `main` + `origin/ui-overhaul`. Rule agreed by Bryan and Ethan: keep all of Ethan's code, and wherever the display differs, Bryan's wins.
- **From Ethan (kept):** all backend changes (Google Places photos in Convex storage, `imageUrl` on feed targets / trips / compare / rank rows, both sides' functions), his screens (Trips, Trip, Plan, Saved, Settings, Following, artist page, Post, Notifications), new shared pieces (`Photo`, `ItemCard`, `Sheet`, `Toast`, `ListRow`, `TextField`…), `features/rate/RateFlow` + `steps` (with Bryan's "Would you go back?" Absolutely / Depends / Nope), map internals (`MapCanvas`, `MapSheet`), additive theme tokens (`palette`, `type`, `layout`, `elevation`, `scrim`, `motion`).
- **Bryan's kept over Ethan's restyle:** every tab (Home spotlight, Map, Add, Search, Profile), onboarding (welcome, create-account, quiz, You're in; Ethan's taste-card and `(tabs)/feed` removed again), friends, user, compare, rankings, venue page, sign-in, root `_layout` (Bryan's gating + `OnboardingProvider`), `lib/links.ts`, overlord menu, and Bryan's components (`Bits`, `ProfileView`, `Spotlight`, `SearchMode`, `VenueCard`, map surface/peek…).
- **Shared foundation merged by hand:** `Text`, `Button`, `ScoreBadge`, `VenuePhoto` keep Bryan's look and also accept Ethan's new options (`headline`, `bodyLg`, `soft`; `secondary` / `quiet` / `destructive`, `size`, `loading`, `icon`; score `variant` / `style`; `VenuePhoto` shows the real photo when `uri` is set, Bryan's glow placeholder otherwise).
- Two lint-only suppressions in Ethan's `MapCanvas.web.tsx` / `MapSheet.tsx` (React Compiler false positives that also fail on his branch).
- **Not taken (Bryan's display wins):** Ethan's restyled venue page (`features/venue/VenuePage`: I'm going, Get tickets, performers, More like this) and his precise-pin native map. Worth folding into Bryan's venue page / map later.

## Pass 13 (light / dark mode)
- `src/theme/mode.ts`: the choice is read synchronously at startup (SecureStore `getItem`, localStorage on web), default dark. Switching saves it and reloads the app (`DevSettings.reload()`; a production build will need `expo-updates` `reloadAsync`), because every StyleSheet is built once at startup.
- `tokens.ts`: `colors` / `palette` = light or dark set (light values = the prototype's light mode). `onboardingColors` = cream Hinge look in light, dark palette in dark. Status bar, both native maps and `app.json` (`userInterfaceStyle: automatic`) follow.
- Buttons: sun/moon `ThemeToggle` next to the gear on the Profile tab, and Settings → Appearance (Dark / Light).

## Pass 14 (stand-in photos)
- `src/constants/placeholderPhotos.ts`: free Unsplash photos per category (nightlife, live, food, culture, outdoors, popup), picked per place with a stable seed. Used by `VenueCard`'s `Photo`, `VenuePhoto` (hue-only callers with a category hue), map pins, Spotlight, profile. Real `imageUrl` (Google Places, backend) always wins; the glow placeholder sits underneath if a stand-in fails to load. Quiz covers stay glow-only.

## Pass 15 (map polish, photo upload, theme button everywhere)
- **Map list:** drag the handle down to hide it (only the handle, a "N places" line and the OSM credit stay), drag up or tap to bring it back; tapping a pin opens it again. Legend: Friends (pink ring) · Public (grey, people icon) · For you (score color).
- **Zoom:** + / − buttons (animated `animateToRegion`), rotate/pitch off, and pins stop re-rendering ~1.5 s after they change (`tracksViewChanges` off) so pan/zoom stay smooth.
- **Pins by zoom:** zoomed out only the top 3–5 (backend `rank`) are photo pins; zoom in and more become photos (8 → 14 → 24 → all). The rest are small score-colored dots you can tap.
- **Who rated it:** friends rated it → their faces + the top friend's score (pink ring) on the pin, list row and place card; nobody I know → **public score** (grey pill with a people icon, "Public 7.6 · 23 ratings"); no ratings → the "for you" prediction.
- **Backend (small, additive, for Ethan to review):** `NearbyItem.publicScore?` in `contract.ts` and set in `convex/lib/discovery.ts` (average of everyone else's rankings in the crowd sample, one decimal; totals only).
- **Add a photo** in the rank flow (Details step): pick from the library (`lib/photos.pickPhoto`), uploaded on Post via `posts.generateUploadUrl`, sent as `rankings.rank({ photoStorageId })`.
- **Light / dark button** (sun/moon) now also on Home, Search, Map and Welcome (top right), not only Profile / Settings.

## Pass 16 (second ui-overhaul merge: Ethan's newest backend, Bryan's screens)
- From `ui-overhaul` (up to `ef119d3`): all `convex/` changes (Google **area import** with a $100 spend ceiling and caller-set radius, catalog/discover/rankings updates), tests, his new **group map** (`/group-map`, `features/groupmap`), and his own screens/components.
- Kept Bryan's: every tab, onboarding, profile, friends, compare, rankings, venue, sign-in, settings, root layout, theme (dark default; his `isDark` / `toggleThemeMode` names now map onto Bryan's `mode.ts`, same storage key), links, map surface/peek, foundation components.
- Not taken: his `(tabs)/recs` "For you" tab (Bryan's Search covers it; `paths.recs` → `/search`), his removed `home/Hero` / `Shortcuts`.
- Three lint suppressions in his `feed/Comments.tsx` (React Compiler rules; same code as on his branch).

## Backend added on this branch (for Ethan to review, then deploy from `main`)
Nothing here edits another session's files except the two shared one-liners the rules allow (schema import, `api.d.ts` entries) and one new type at the end of `contract.ts`.

| File | What |
|---|---|
| `convex/tables/ui.ts` (new) | `quizExtras`, `accountPrivacy`, `follows`, `profilePins` tables |
| `convex/follows.ts` (new) | `setPublic`, `follow` (public accounts only), `unfollow`, `status` → `FollowStatus`, `followers` |
| `convex/onboarding.ts` (new) | `saveExtendedQuiz` / `myExtendedQuiz` (E1), `seedRatings` (E6, "Been here?" → private `rankings.rank` at the bottom of each bucket), `setPins` / `pins` (E13) |
| `convex/schema.ts` | `...uiTables` |
| `convex/_generated/api.d.ts` | `follows`, `onboarding`, `tables/ui` entries (regenerated anyway on the next `npx convex dev` from main) |
| `convex/lib/contract.ts` | `FollowStatus` (new type, additive) |
| `tests/ui.follows.test.mjs` (new) | 5 tests: follows, privacy, quiz extras, pins |

**INTEGRATION (People):** `profile.get` should return `canSee: true` for public accounts; `users.deleteUserRows` should also delete this user's rows in `follows`, `accountPrivacy`, `quizExtras`, `profilePins`.
**INTEGRATION (Brain):** `quizExtras.answers` (song stars, scenarios, hot takes, nights) is there to refine the taste prior when you want it.
**Still open:** E3 describe-your-night (needs an LLM key), E5 `friendsAvg` on `NearbyItem` (Brain's `discover.ts`), E11 Apple/Google OAuth (needs provider keys).
