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
- **Rank flow (Beli):** "Add to my list of …", "How was it?" as three colored circles, "Which do you prefer?" with OR, and Undo · Too tough · Skip (Skip compares against the next place instead).
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
