# clubi team playbook: 3 people, 5 Capy captains

**Consumer Mobile Hackathon, YC SF, Sun Nov 15 2026. Submit by 6:00 PM PT (we aim for 5:45).**
Capy, Revyl and Convex are all required to win. Full product spec: `CLAUDE.md`. Tool setup: `guides/convex-capy-revyl.md`.

## What's in this folder

| File | Who | What it is |
| --- | --- | --- |
| `README.md` (this; goes in the repo as `docs/TEAM.md`) | everyone, read once | Roles, folder ownership, sync rules, timeline |
| `contract.md` (goes in the repo as `docs/CONTRACT.md`) | every captain | The shared API between backend and screens |
| `ethan.md` (goes in the repo as `docs/ETHAN.md`) | Ethan's 3 captains | **One self-contained brief**: product, rules, contract, data sources, the full algorithm with formulas and code, and the tasks for Captain 1 (Recs), Captain 2 (People), Captain 3 (Live data) |
| `bryan.md` | Bryan | Paste-ready prompts: design system, Map, Home, Venue, plus how to feed Capy images/videos |
| `albert.md` | Albert | Paste-ready prompts: feed, profile, friends, demo data, Revyl testing, submission (**a proposal**) |
| `../research/recommendation.md` | Ethan, pitch | The research behind the algorithm, with papers |

**Step 1 (Ethan, 2 min):** upload `ethan.md`, `README.md` and `contract.md` into the repo's `docs/` as `ETHAN.md`, `TEAM.md`, `CONTRACT.md` (GitHub → *Add file → Upload files*, commit to `main`). Then everyone starts their first prompt.

## Roles (one owner per file)

| | Ethan C1 – **Recs** | Ethan C2 – **People** | Ethan C3 – **Live data** | Bryan – **Look + map screen** | Albert – **Social + QA** (proposed) |
| --- | --- | --- | --- | --- | --- |
| Does | Contract, schema combiner, ML scoring + map ranking (`nearby`, `tonight`, venue detail, search), live learning, demo location | Sign up/in, taste quiz + reveal, rating system (rank backend + rank flow), notifications | OSM, Ticketmaster, Luma, Partiful imports, de-dupe, featurizer, refresh crons, data freeze | Theme + components, tab bar, Map (pins, chips, sheet), Home/Tonight, Venue page, Plan screen | Feed, profile, my rankings, friends, friend profile/compare, seed data, Revyl builds + checks, submission |
| Convex | `schema.ts`, `lib/contract.ts`, `lib/recs.ts`, `scoring.ts`, `discover.ts`, `places.ts`, `seedPlaces.ts`, `debug.ts` | `tables/people.ts`, `auth.ts`, `users.ts`, `rankings.ts`, `notifications.ts`, `notificationsCron.ts` | `tables/catalog.ts`, `imports/*`, `ingest.ts`, `crons.ts` | none | `tables/social.ts`, `posts.ts`, `friends.ts`, `profile.ts`, `seedSocial.ts` |
| App | `lib/demoLocation.ts`, `lib/useNearby.ts` | `app/(auth)/*`, `app/(onboarding)/*`, `app/(tabs)/rate.tsx`, `app/rate/*`, `app/notifications.tsx` | none | `theme/*`, `components/*`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/map.tsx`, `app/venue/*`, `app/plan.tsx`, `design/*` | `app/(tabs)/feed.tsx`, `app/(tabs)/profile.tsx`, `app/rankings.tsx`, `app/user/*`, `app/friends.tsx`, `app/compare/*`, `.revyl/*`, `submission/*` |

Shared files (`package.json`, `app.json`, `app/_layout.tsx`, `CLAUDE.md`, `hackathon.md`): anyone, tiny edits, pull first. On a `hackathon.md` conflict keep both entries.
Writing rows into another owner's table from your own function is fine (e.g. `rankings.rank` inserts a `posts` row); editing another owner's file is not.

## How everyone's captains stay in sync

This is what makes "Ethan changes the algorithm and the UI just follows" true.

1. **Contract first.** Ethan's Captain 1 task R1 creates `convex/lib/contract.ts`, splits the schema into per-owner table files, and ships stub versions of the discovery queries that return real seeded places. Merge it first (~12:20). Everyone builds against those real `api.*` functions, never fake JSON.
2. **Screens only render what the backend returns** (`score`, `matchPct`, `why`, `tier`, `rank`, `friends`) via `useQuery`. Convex queries are live, so when the scoring changes, every phone re-sorts and re-sizes pins by itself. No UI PR needed.
3. **The shape is frozen, the math is not.** Contract changes only add optional fields. Never rename or remove a field.
4. **The shared Convex deployment always runs `main`.** All threads deploy to the same Development deployment, and a deploy from a branch *replaces all functions*. So: `git pull --rebase origin main` right before `npx convex dev --once`; Bryan's threads never deploy; after merging anything that touched `convex/`, run in any thread: *"Check out the latest main, run npx convex dev --once, report errors, change nothing."*
5. **Small PRs, merge often** (every ~45 min). Titles: `[Ethan/C1]`, `[Ethan/C2]`, `[Ethan/C3]`, `[Bryan]`, `[Albert]`. Each person merges their own PRs after a quick look and the Revyl verdict. Start every thread from fresh `main`.
6. **Conflicts:** the later PR rebases. If the conflict is in someone else's file, keep their version and redo your change in your own file.
7. **Clear button labels** ("Sign up", "Rank this place", "Post", "Filter: Bars") so Revyl's steps can find them.

## Live preview (Expo Go + fast refresh)

```
git clone <repo> && cd <repo> && npm install
echo "EXPO_PUBLIC_CONVEX_URL=<shared Development deployment URL: Convex dashboard → Settings>" > .env.local
npx expo start        # scan the QR code with the iPhone camera → Expo Go
```
After a merge: `git pull` (fast refresh picks up app changes; backend changes arrive live through Convex). Preview a PR: `git fetch && git checkout <branch>`. Don't run plain `npx convex dev` (watch mode) against the shared deployment; it keeps pushing your local functions.
The submission build is the Revyl cloud iPhone (Albert runs it).

## Timeline (Pacific)

| Time | Ethan C1 Recs | Ethan C2 People | Ethan C3 Data | Bryan | Albert |
| --- | --- | --- | --- | --- | --- |
| 11:50–12:20 | **R1 foundation** (merge first) | P1 sign-up + quiz | D1 ingest + OSM | B0 design refs, B1 theme + components | read files, set up Expo Go |
| 12:20–1:15 | R2 hybrid-v2 score | P2 rating backend | D2 Ticketmaster | B2 Map | A1 feed + friends |
| 1:00 | | | | | **A-Revyl first cloud build** |
| 1:15–2:15 | R4 scale + debug | P3 rank flow screens | D3 Luma | B3 Venue + Home | A2 profile + friends screens |
| 2:15–3:15 | R3 live learning | P4 notifications | D4 Partiful | B4 polish | A3 seed data |
| 3:15–4:00 | R5 plan (stretch) | P5 wire learning | D5 crons + freeze | B5 plan (stretch) | A5 full Revyl run |
| **4:00** | | | **Data freeze** | | sign up 3 accounts, run seedSocial |
| **4:45** | **Code freeze**: only fixes for broken demo steps | | | | A5 again |
| 4:45–5:45 | Algorithm slide | | | Screenshots + recording | A6 submission |
| **5:45** | **Submit** | | | | |

Cut order if behind: Partiful, Luma, photos, "event tonight" notifications, group planning, friend profile. **Never cut the ranking flow or the friend feed.**

## Demo script (2 min, rehearse at 5:00)

1. Sign in as Ethan on a cloud iPhone (demo location). Map: pins by category, top 5 ringed, "8.7 for you · Loud, young crowd + pop music", tonight's pop-ups from Luma/Partiful.
2. Same bar, different score and why on Bryan's phone (different quiz).
3. Venue page: friends who went. "Rank this place" → Loved → 2 comparisons → "#2 of your bars · 8.9" → Post.
4. Bryan's phone: the post appears instantly in the feed, plus a notification.
5. Ethan's map re-sorts live (taste learned from the comparison). A local's 9.5 shows as "Locals like you rate it 9.2".
6. One slide: Bradley–Terry on pairwise comparisons, locals weighted, explainable scores, roadmap.
