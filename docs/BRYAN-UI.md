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
