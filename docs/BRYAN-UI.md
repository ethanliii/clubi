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

## Not done yet (next pass)
Map pins by tier with Bryan's bubble style · rank flow (3 buckets + binary search + quick questions) · profile/rankings/friends/friend/compare/plan/notifications screens still placeholders · `friend/[id]` → `user/[userId]` rename · light/dark toggle.

## Backend asks (optional fields only)
| # | Ask | For |
|---|---|---|
| E1 | `saveQuiz` accepts the full quiz answers (see `QuizAnswers` in `src/features/quiz.ts`) | Quiz |
| E3 | Describe-your-night: free text → filters + friend ids (Search uses `places.search` until then) | Search |
| E5 | `friendsAvg` on `NearbyItem` | Map badges |
| E6 | Bulk seed ratings from "Been here?" (answers kept on device for now) | Quiz |
| E11 | Apple + Google OAuth providers in `convex/auth.ts` | Welcome |
| — | Vibe filter on `discover.tonight` / `forGroup` (Vibe chips pass to Plan my night for now) | Search |
