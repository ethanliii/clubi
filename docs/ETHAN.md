# clubi: Ethan's backend brief for 3 Capy captains

> **For the Capy captain reading this:** this file is your full context. Read all of it once. Then find **your captain number** (the person who pasted this will tell you: Captain 1, 2 or 3) in section 9 and do the **one task** they name. Stay inside your folders (section 3). When a task says "wait for X", check `main` for it first.

**Start-up for Ethan (2 minutes):**
1. Put three files in the repo's `docs/` folder in one go: this file as `docs/ETHAN.md`, the team `README.md` as `docs/TEAM.md`, and `contract.md` as `docs/CONTRACT.md` (GitHub → repo → *Add file → Upload files* → type `docs/` → commit to `main`). Bryan's and Albert's captains read `docs/TEAM.md` and `docs/CONTRACT.md`. (If uploading isn't possible, paste this file whole into each first message.)
2. Open **three Capy threads** at once and paste these kickoffs, one per thread:
   - `Read docs/ETHAN.md completely. You are Captain 1 (Recs: ML scoring + map algorithm). Do task R1 now.`
   - `Read docs/ETHAN.md completely. You are Captain 2 (People: sign-up, ratings, notifications). Do task P1 now. Open your PR only after R1 is merged; rebase on main first.`
   - `Read docs/ETHAN.md completely. You are Captain 3 (Live data: OSM, Ticketmaster, Luma, Partiful). Do task D1 now. Open your PR only after R1 is merged; rebase on main first.`
3. Merge **R1 first** (target: 12:20), tell Bryan and Albert, then merge P1 and D1.
4. For each next task, start a new thread in that captain's project with: `Read docs/ETHAN.md. You are Captain N. Do task X.` (If your Capy captain can run several tasks itself, say "Do tasks P2–P4 in order, one PR each, wait for me to merge each before starting the next".)
5. After merging anything that touched `convex/`, run the **redeploy** prompt (section 4).

---

## 1. The event and the rules

- **Consumer Mobile Hackathon, YC San Francisco, Sunday Nov 15 2026. Submit by 6:00 PM PT; we aim for 5:45.** Code freeze 4:45. Data freeze 4:00.
- **Capy, Revyl and Convex are all required to win.** Capy writes the code (one task per thread, opens a PR, a human merges). Convex is the backend; Capy deploys with `CONVEX_DEPLOY_KEY` (a Capy project env var, Development deployment). Revyl builds the iOS app as a standalone simulator build (JS bundle embedded, `EXPO_PUBLIC_CONVEX_URL` set at build time), installs it on a cloud iPhone, and checks PRs ("proof of changes").
- Expo Go (`npx expo start`) is for live preview on our own phones. The submission runs on the Revyl cloud iPhone.
- The Convex hackathon skill is in `.agents/skills/convex-hackathon-skill/`. Every thread ends with: update the build log with `$convex-hackathon-skill`.
- Repo is public: no API keys in code. Server keys go in Convex env vars (`npx convex env set NAME value`).

## 2. The product

**clubi** shows you what's worth doing near you right now, ranked for *your* taste, using rankings from people like you, especially locals. Google results and "best bars in X" listicles are generic; a local's tip is what actually fits. Users rank places they go to (Beli-style: loved / fine / didn't, then "better or worse than X?"), and every ranking updates both the user's taste profile and the place's profile. There's a map with tailored places and live events, a friend feed, and group planning that combines tastes. For tourists (who benefit from locals' rankings) and locals (who discover events). Covers bars, clubs, restaurants, museums, parks, concerts, pop-ups. Demo city: San Francisco, around the event venue.

**Must work in the submitted build, on real data:**
1. Sign up / sign in (username + password, Convex Auth), 6-card taste quiz, location primer. Demo-location switch ON by default (cloud phones have no GPS).
2. **Map** centered on the demo location: pins from OpenStreetMap + Ticketmaster + Luma + Partiful + hand-added pop-ups; category colors; top 5 matches ringed; filter chips; bottom-sheet list.
3. **Place/event card:** predicted score (1–10) + one-line "why" + friends who went with their scores.
4. **Rank a place:** loved / fine / didn't → 2–4 comparisons → tags → optional photo + caption → Post → "#2 of your bars · 8.9".
5. **Friend feed:** a friend's new post shows within a second, no refresh (Convex reactivity).
6. **Profile:** ranked lists per category.
7. **Notifications** (in-app): friend posted, friend ranked a place you also ranked, an event tonight matches your taste.

**Never cut the ranking flow or the friend feed.** If behind, cut in this order: Partiful, Luma, photos, notifications' "event tonight" type, group planning.

**Privacy rules (build today):** under-21 users (from birthday) never see nightlife; never show anyone's live location; posts are friends-only by default. Sponsored content never changes a score.

**Design:** Bryan's prototype (dark, pink accent `#ff4f9a`, rounded cards, big tap targets). Clear text labels on key buttons ("Sign up", "Rank this place", "Post") so Revyl's plain-English steps can find them.

## 3. Who owns what (one owner per file)

The team: **Ethan** runs three Capy captains (below). **Bryan** owns the look and the Map/Home/Venue screens. **Albert** owns the social side (feed, profile, friends), demo data, Revyl testing and the submission.

| Owner | Convex files | App files |
| --- | --- | --- |
| **Captain 1 – Recs** (ML scoring + map algorithm) | `convex/schema.ts` (only combines table files), `convex/lib/contract.ts`, `convex/lib/recs.ts`, `convex/scoring.ts`, `convex/discover.ts`, `convex/places.ts`, `convex/seedPlaces.ts`, `convex/debug.ts` | `lib/demoLocation.ts`, `lib/useNearby.ts`, `docs/CONTRACT.md` |
| **Captain 2 – People** (sign-up, ratings, notifications) | `convex/tables/people.ts` (users fields, quizAnswers, rankings, comparisons, notifications), `convex/auth.ts`, `convex/users.ts`, `convex/rankings.ts`, `convex/notifications.ts`, `convex/notificationsCron.ts` | `app/(auth)/*`, `app/(onboarding)/*`, `app/(tabs)/rate.tsx`, `app/rate/*`, `app/notifications.tsx` |
| **Captain 3 – Live data** (scraping + imports) | `convex/tables/catalog.ts` (places, events, appConfig), `convex/imports/*`, `convex/ingest.ts`, `convex/crons.ts` | none |
| **Bryan** | none | `theme/*`, `components/*`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/map.tsx`, `app/venue/*`, `app/plan.tsx`, `design/*` |
| **Albert** | `convex/tables/social.ts` (posts, friendships, reactions), `convex/posts.ts`, `convex/friends.ts`, `convex/profile.ts`, `convex/seedSocial.ts` | `app/(tabs)/feed.tsx`, `app/(tabs)/profile.tsx`, `app/rankings.tsx`, `app/user/*`, `app/friends.tsx`, `app/compare/*`, `.revyl/*` |

- Writing rows to another owner's table from your function is fine (e.g. `rankings.rank` inserts a `posts` row). Editing another owner's *file* is not: ask Ethan, who tells that captain.
- Shared files (`package.json`, `app.json`, `app/_layout.tsx`, `CLAUDE.md`, `hackathon.md`): tiny edits only, pull first; on a `hackathon.md` conflict keep both entries.
- All screens use Bryan's `components/index.ts` and `theme/tokens.ts` (merged ~12:15). Until then, build the backend half first.

## 4. How the captains stay in sync

1. **Contract first.** R1 creates `convex/lib/contract.ts` and stub versions of every Captain 1 function with real seeded places. Bryan and Albert build against real `api.*` functions from ~12:20.
2. **The UI only renders what the backend returns** (`score`, `matchPct`, `why`, `tier`, `rank`, `friends`) via `useQuery`. No screen computes ranking. Convex queries are live, so when Captain 1 changes the math, every phone re-sorts by itself.
3. **The shape is frozen, the math is not.** Contract changes may only *add optional fields*. Never rename or remove a field.
4. **The shared Convex deployment runs `main`.** Every Capy thread deploys to the same Development deployment, and a deploy from a branch *replaces all functions* with that branch's copy. So: `git pull --rebase origin main` right before `npx convex dev --once`; Bryan never deploys; after merging any PR that touched `convex/`, run:
   ```
   Check out the latest main, run npx convex dev --once so the shared Convex deployment matches main, and report any errors. Don't change any files.
   ```
5. **Every task ends with:** `git pull --rebase origin main`, `npx convex dev --once` (if `convex/` changed), `npx tsc --noEmit`, fix every error, commit `convex/_generated`, small PR titled `[Ethan/C1] …`, `[Ethan/C2] …` or `[Ethan/C3] …`, update the build log with `$convex-hackathon-skill`.
6. Functions get the user with `getAuthUserId(ctx)` from `@convex-dev/auth/server`; throw if null (public discovery queries may treat null as a neutral taste).
7. Ask before adding big dependencies or changing the stack. Prefer simple, working code; we submit at 6 PM.

## 5. Stack

Expo (TypeScript, Expo Router) at the repo root; Convex (DB, functions, file storage, crons, live queries); Convex Auth Password provider with `expo-secure-store`; `react-native-maps` (Apple Maps); `expo-location` foreground only; `@convex-dev/geospatial` optional (fallback: bounding box); `@gorhom/bottom-sheet`; Convex file storage for photos; Revyl via Capy.

## 6. The contract (types + every function)

`convex/lib/contract.ts` (owner Captain 1):

```ts
import { Id } from "../_generated/dataModel";

export type Category = "nightlife" | "food" | "culture" | "outdoors" | "live" | "popup";
export type Filter = "tonight" | "bars" | "food" | "events" | "popups" | "outdoors" | "all";
export type Tier = "top" | "good" | "other";   // top = top 5 (big ringed pin), good = labeled pin, other = dot
export type Bucket = "loved" | "fine" | "didnt";
export type Source = "seed" | "osm" | "ticketmaster" | "luma" | "partiful" | "manual";

export type FriendScore = { userId: Id<"users">; displayName: string; avatarUrl?: string; score: number; isLocal?: boolean };

export type NearbyItem = {
  kind: "place" | "event";
  id: Id<"places"> | Id<"events">;
  name: string;
  category: Category;
  subcategory?: string;
  lat: number; lng: number;
  distanceMeters: number;
  score: number;        // predicted 1–10, one decimal
  matchPct: number;     // 0–100
  why: string;          // never empty
  tier: Tier;
  rank: number;         // 1 = best
  imageUrl?: string;
  blurb?: string;
  priceLevel?: 1 | 2 | 3 | 4;
  openNow?: boolean;
  startsAt?: number;    // events, ms epoch
  source?: Source;
  sourceUrl?: string;   // "View on Luma / Partiful / Ticketmaster"
  friends: FriendScore[];   // up to 3
};

export type NearbyResult = { items: NearbyItem[]; center: { lat: number; lng: number }; algo: string; generatedAt: number; attribution?: string };

export type VenueDetail = NearbyItem & {
  address?: string; hours?: string; tags: string[];
  breakdown?: { label: string; value: number }[];
  friendRankings: (FriendScore & { caption?: string; when: number; photoUrl?: string })[];
  ticketUrl?: string;
  myRanking?: { score: number; position: number; outOf: number; bucket: Bucket };
};

export type RankResult = { rankingId: Id<"rankings">; score: number; position: number; outOf: number; label: string };

export type FeedItem = {
  postId: Id<"posts">;
  author: { userId: Id<"users">; displayName: string; avatarUrl?: string };
  target: { kind: "place" | "event"; id: Id<"places"> | Id<"events">; name: string; category: Category };
  score: number; position: number; label: string;
  caption?: string; photoUrls: string[]; tags: string[]; createdAt: number;
  myScoreForIt?: number;
};

export type NotificationItem = {
  id: Id<"notifications">;
  type: "friend_posted" | "friend_ranked_same" | "event_tonight" | "friend_request";
  title: string; body: string;
  link?: string;        // expo-router path, e.g. "/venue/place/<id>"
  read: boolean; createdAt: number;
  actor?: { userId: Id<"users">; displayName: string; avatarUrl?: string };
};
```

| Function | Kind | Args → Returns | Owner |
| --- | --- | --- | --- |
| `api.discover.nearby` | query | `{lat, lng, radiusMeters?=2500, filter?="all", limit?=60}` → `NearbyResult` | C1 |
| `api.discover.tonight` | query | `{lat, lng}` → `{topPicks, friendsGoing, events}: NearbyItem[]` | C1 |
| `api.discover.plan` | query (stretch) | `{lat, lng, memberIds, vibe}` → 3 stops with each member's score | C1 |
| `api.places.get` | query | `{kind, id}` → `VenueDetail \| null` | C1 |
| `api.places.search` | query | `{text, lat, lng}` → `NearbyItem[]` (≤10) | C1 |
| `lib/useNearby.ts` | hook | `useNearby(filter)` → `NearbyResult \| undefined` | C1 |
| `lib/demoLocation.ts` | hook | `useDemoLocation()` → `{lat, lng, isDemo, setDemo}` | C1 |
| `api.users.me` | query | `{}` → `{userId, username, displayName, avatarUrl?, homeCity?, onboarded, tasteSummary: {label, pct}[]} \| null` | C2 |
| `api.users.saveQuiz` | mutation | `{answers: number[][]}` → `{tasteSummary}` | C2 |
| `api.rankings.listInBucket` | query | `{category, bucket}` → `{id, kind, name, score, position}[]` | C2 |
| `api.rankings.rank` | mutation | `{kind, id, bucket, position, comparisons: {winnerId, loserId}[], tags, caption?, photoStorageId?}` → `RankResult` (also creates the post + notifications) | C2 |
| `api.notifications.list` | query | `{}` → `NotificationItem[]` (newest 50) | C2 |
| `api.notifications.unreadCount` | query | `{}` → `number` | C2 |
| `api.notifications.markAllRead` | mutation | `{}` → `null` | C2 |
| `notify(ctx, {userId, type, title, body, link?, actorId?})` | plain helper exported from `convex/notifications.ts` | for other owners' mutations | C2 |
| `api.posts.friendsFeed` | query | `{}` → `FeedItem[]` | Albert |
| `api.posts.generateUploadUrl` | mutation | `{}` → `string` | Albert |
| `api.friends.list` / `request({username})` / `respond({requestId, accept})` | query / mutations | | Albert |
| `api.profile.get` | query | `{userId?}` → `{user, lists: {category, items}[], counts}` | Albert |

## 7. Data

**Tables** (all extra fields optional so nothing breaks):
- `catalog.ts` (C3): `places` {name, category, subcategory, lat, lng, address, hours, tags, source, sourceId, sourceUrl, imageUrl, blurb, priceLevel, venueVector (13 numbers), elo (0), nComparisons (0), city}; `events` {title, start, end, placeId?, lat, lng, category, price, imageUrl, ticketUrl, sourceUrl, source, sourceId, venueVector, elo, nComparisons, blurb}; `appConfig` {key, value} (holds `ingestFrozen`). Indexes: by source+sourceId, by category, by lat (for the bounding box), events by start.
- `people.ts` (C2): users = Convex Auth users + {username (unique index), displayName, birthday, homeCity, privacy, avatar, tasteVector (13), tastePrior (13)}; `quizAnswers` {userId, answers}; `rankings` {userId, placeId|eventId, category, bucket, position, score, tags, visitedAt, wasLocal, dayOfWeek, hour, groupSize}; `comparisons` {userId, winnerId, loserId, category, createdAt, dayOfWeek, hour}; `notifications` {userId, type, title, body, link, read, createdAt, actorId}. Indexes: users by username, rankings by user+category, by place, by event, notifications by user+createdAt.
- `social.ts` (Albert): `posts` {userId, rankingId, targetKind, targetId, photos, caption, visibility, createdAt}; `friendships` {userA, userB, status}; `reactions`.

**Sources** (C3 imports them into Convex; the phone never calls these):

| Source | What | How | Notes |
| --- | --- | --- | --- |
| OpenStreetMap Overpass | Bars, pubs, clubs, restaurants, cafes, museums, galleries, theaters, parks | Overpass QL, SF box lat 37.70–37.83, lng −122.52 to −122.35; `amenity` = bar, pub, nightclub, biergarten, restaurant, cafe, theatre, cinema, arts_centre; `tourism` = museum, gallery, attraction; `leisure` = park; `out center tags;` | Show "© OpenStreetMap contributors" (openstreetmap.org/copyright). Keep OSM rows marked `source: "osm"` (ODbL). |
| Ticketmaster Discovery | Concerts, sports, theater | `TICKETMASTER_KEY` env var; `geoPoint` + `radius` (not deprecated `latlong`); next 7 days | 5,000 calls/day. "Get tickets" → event URL. |
| Luma | Pop-ups, meetups, art/community events | The unofficial JSON endpoint luma.com/sf uses (find it by loading luma.com/sf and reading its network calls; don't guess) | Keep in-person events with coordinates. |
| Partiful | Public parties | No API. Public event pages; parse their OpenGraph / embedded JSON. If Explore can't be fetched politely, Ethan pastes a list of public Partiful URLs into `appConfig.partifulUrls` and we parse those. | Respect robots.txt, ≤1 request/s, cache, store `sourceUrl`, public events only, no personal data of guests. Before a real launch, ask Partiful/Luma for permission. |
| Hand-added | 5–10 verified pop-ups near the venue | `seedPlaces` (C1) | |

**Cleaning:** one category list (nightlife, food, culture, outdoors, live, popup); drop unnamed places and past events; de-dupe same name within ~50 m (and same title + start within 1 h for events); upsert by `source` + `sourceId`. **Data freeze at 4:00 PM:** set `appConfig.ingestFrozen = true`, crons stop; no live outside calls during the demo.

**Features** (13, values 0–1, same order everywhere): `energy, loudness, crowdAge, price, dancing, liveMusic, pop, hiphop, electronic, indie, culture, outdoors, food`. Users get `tasteVector` from the quiz; places/events get `venueVector` from tags/text (C3's featurizer) or by hand for the ~30 seeded places near the venue.

## 8. The algorithm (ML scoring + map ranking)

From our research notes (`research/recommendation.md`; papers listed in 8.8). Our core signal is **pairwise comparisons inside a category** ("bar A beat bar B for me"), plus the quiz and place features. The right model family is **Bradley–Terry / logistic pairwise preference** (the math behind Elo, BPR and RLHF reward models). Everything is one utility score for user $u$, place $i$, context $c$:

$$
x_{uic} = \underbrace{\mathbf t_u^\top \mathbf f_i}_{\text{taste} \times \text{features}} + \underbrace{b_i}_{\text{place quality}} + \underbrace{\mathbf p_u^\top \mathbf q_i}_{\text{latent CF (after hackathon)}} + \underbrace{\mathbf w^\top \phi(c, i)}_{\text{context: time, distance}}
$$

and every comparison "$i$ beat $j$ for $u$" is a Bradley–Terry observation $P(i \succ_u j) = \sigma(x_{ui} - x_{uj})$, $\sigma(z) = 1/(1+e^{-z})$.

**Today we learn $\mathbf t_u$ and $b_i$ online, inside mutations, with no training job.** Feature $\texttt{crowdAge}$ = 1 means a young crowd.

### 8.1 Taste vector starts from the quiz, then learns from each comparison

Start: $\mathbf t_u \leftarrow$ quiz answers (values in $[0,1]$), saved as `tasteVector`. Also save `tastePrior` $=\mathbf t_u^{(0)}$.

When the user says place $w$ beat place $\ell$ (same category), take one logistic gradient step on the BT log-likelihood using **features only**:

$$
\Delta = \mathbf f_w - \mathbf f_\ell, \qquad
g = 1 - \sigma\!\big(\kappa\, \mathbf t_u^\top \Delta\big), \qquad
\mathbf t_u \leftarrow \operatorname{clip}_{[0,1]}\!\Big(\mathbf t_u + \eta\, g\, \Delta - \eta\lambda\,(\mathbf t_u - \mathbf t_u^{(0)})\Big)
$$

with $\eta \approx 0.05$, $\kappa \approx 5$ (sharpens $\sigma$ since features are in $[0,1]$), $\lambda \approx 0.1$ (pulls gently back to the quiz so one odd comparison can't wreck the profile). $g$ is large when the model was surprised, small when it already agreed. This is one SGD step of logistic regression, the same update RankNet and BPR use.

### 8.2 Place quality: Elo on comparisons (global, per category)

Every comparison also tells us something about the places, regardless of who made it. Keep `elo` (start 0) and `nComparisons` on `places`:

$$
p = \sigma(b_w - b_\ell), \qquad
K = \frac{K_0}{\sqrt{1 + n_i}}, \qquad
b_w \leftarrow b_w + K(1 - p), \quad b_\ell \leftarrow b_\ell - K(1 - p)
$$

with $K_0 \approx 0.5$. The shrinking $K$ is a cheap stand-in for Glicko's uncertainty: new places move fast, well-rated places settle. Use $b_i$ in the score with weight $\gamma \approx 0.3$ so a place everyone loves rises a bit for everyone.

### 8.3 Crowd score: "people like you, especially locals"

For place $i$, look at everyone $v$ who ranked it (their 1–10 Beli score $r_{vi}$):

$$
w_{uv} = \max\!\big(0, \cos(\mathbf t_u, \mathbf t_v)\big)\,\big(1 + \alpha\,\mathbb 1[v \text{ local}]\big)\,\big(1 + \beta_f\,\mathbb 1[v \text{ friend}]\big)
$$

$$
c_{ui} = \frac{\sum_v w_{uv}\, r_{vi} + m\,\bar r}{\sum_v w_{uv} + m}
$$

$\alpha \approx 1$ (a local counts double), $\beta_f \approx 0.5$, $m \approx 2$ pseudo-votes at the global mean $\bar r \approx 6$. The $m$ term is a Bayesian average: one stranger's 10/10 can't dominate. "Local" = `ranking.wasLocal`, or `user.homeCity == place city`. A visitor ($u$ not local) can use a larger $\alpha$ (say 2) than a local does; that is the LCARS / out-of-town finding in one parameter.

### 8.4 Final predicted score (1–10) and map ordering

$$
\text{cos}_{ui} = \frac{\mathbf t_u^\top \mathbf f_i}{\lVert \mathbf t_u \rVert\,\lVert \mathbf f_i \rVert}, \qquad
s^{\text{content}}_{ui} = 1 + 4.5\,(1 + \text{cos}_{ui}) \quad\text{(the spec's demo score)}
$$

$$
n_i^{\text{eff}} = \sum_v w_{uv}, \qquad
\lambda_i = \frac{n_i^{\text{eff}}}{n_i^{\text{eff}} + 3}
$$

$$
\hat r_{ui} = \operatorname{clip}_{[1,10]}\Big( (1 - \lambda_i)\, s^{\text{content}}_{ui} + \lambda_i\, c_{ui} + \gamma\, b_i \Big)
$$

So with no rankings it is the spec's cosine score; as similar people (and locals) rank a place, their opinion takes over. If **the user ranked it themselves**, show their own Beli score instead.

Map list ordering (not shown to the user, only used to sort and size pins):

$$
\text{rank}_{ui} = \hat r_{ui} \;-\; \delta\,\log\!\Big(1 + \frac{d_{ui}}{d_0}\Big) \;+\; \tau\,\text{timeMatch}_{i}(c)
$$

$d_{ui}$ = haversine distance in metres, $d_0 \approx 400$ m, $\delta \approx 1$. Log decay follows the power-law falloff in Ye et al. (2011): 400 m vs 800 m matters, 4 km vs 4.4 km doesn't. $\text{timeMatch} \in [0,1]$: 1 if open now and the category fits the hour (bars after 8 pm, cafés in the morning), $\tau \approx 0.5$. Hide closed places and past events entirely.

Diversity (optional, 10 lines): when picking the ringed "top 5" pins, greedily skip a candidate whose cosine to an already-picked place's $\mathbf f$ is above 0.95 (a light MMR).

### 8.5 The "why" line (never show a score without it)

The score is additive, so we can read the reason straight off it (Zhang & Chen's feature-level explanation):

1. If $\lambda_i > 0.5$ and at least one local or friend rated it: **"Locals like you rate it 8.9"** or **"Albert gave it 9.1"** (Herlocker et al.: social explanations persuade most).
2. Otherwise, the two features with the largest $t_{u,k} \cdot f_{i,k}$: **"Loud, young crowd + pop music, like you said you like."**
3. Add a short context tag if $\tau$ term fired: **"Open till 2 am."**

### 8.6 TypeScript sketch

```ts
// convex/lib/recs.ts  (pure functions, no Convex imports, easy to unit test)
export const FEATURES = ["energy","loudness","crowdAge","price","dancing","liveMusic",
  "pop","hiphop","electronic","indie","culture","outdoors","food"] as const;

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const dot = (a: number[], b: number[]) => a.reduce((s, x, k) => s + x * b[k], 0);
const norm = (a: number[]) => Math.sqrt(dot(a, a)) || 1e-9;
export const cosine = (a: number[], b: number[]) => dot(a, b) / (norm(a) * norm(b));
const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** 8.1: one BT/logistic step on the user's taste after "winner beat loser". */
export function updateTaste(t: number[], prior: number[], fW: number[], fL: number[],
  eta = 0.05, kappa = 5, lambda = 0.1): number[] {
  const delta = fW.map((x, k) => x - fL[k]);
  const g = 1 - sigmoid(kappa * dot(t, delta));
  return t.map((x, k) => clip(x + eta * g * delta[k] - eta * lambda * (x - prior[k]), 0, 1));
}

/** 8.2: Elo step on place quality. Returns new [bW, bL]. */
export function updateElo(bW: number, bL: number, nW: number, nL: number, K0 = 0.5) {
  const p = sigmoid(bW - bL);
  return [bW + (K0 / Math.sqrt(1 + nW)) * (1 - p), bL - (K0 / Math.sqrt(1 + nL)) * (1 - p)];
}

/** 8.3 + 8.4: predicted 1–10 score and the inputs for the why line. */
export function predict(tU: number[], fI: number[], eloI: number,
  raters: { taste: number[]; score: number; local: boolean; friend: boolean; name: string }[],
  userIsLocal: boolean) {
  const alpha = userIsLocal ? 1 : 2, betaF = 0.5, m = 2, rBar = 6, gamma = 0.3;
  let num = m * rBar, den = m, wSum = 0;
  let best: { name: string; score: number; w: number } | null = null;
  for (const v of raters) {
    const w = Math.max(0, cosine(tU, v.taste)) * (1 + alpha * +v.local) * (1 + betaF * +v.friend);
    num += w * v.score; den += w; wSum += w;
    if (!best || w > best.w) best = { name: v.name, score: v.score, w };
  }
  const crowd = num / den;
  const content = 1 + 4.5 * (1 + cosine(tU, fI));
  const lam = wSum / (wSum + 3);
  const score = clip((1 - lam) * content + lam * crowd + gamma * eloI, 1, 10);
  const contrib = tU.map((x, k) => ({ k: FEATURES[k], v: x * fI[k] })).sort((a, b) => b.v - a.v);
  return { score, lam, crowd, topFeatures: [contrib[0].k, contrib[1].k], topRater: best };
}

/** 8.4: map ordering. distanceM from haversine. */
export const mapRank = (score: number, distanceM: number, timeMatch: number) =>
  score - Math.log(1 + distanceM / 400) + 0.5 * timeMatch;
```

Wiring:
- `rank` mutation (Captain 2, via Captain 1's `applyComparison`): for each comparison it already saves, call `updateTaste` and patch the user's `tasteVector`; call `updateElo` and patch both places' `elo` and `nComparisons`. These schema fields are added in R1 (section 7).
- `nearby` query: geo-filter candidates (≤ ~200), load rankings for those place ids, call `predict` per place, sort by `mapRank`. Convex reactivity means the map re-sorts by itself the moment a friend posts a ranking, which is a great live demo moment.


### 8.7 After the hackathon (don't build today; it's for the pitch and the roadmap)

- **Bradley–Terry matrix factorization**, nightly Convex cron (BPR, Rendle et al. 2009, on explicit pairs), with the quiz as a prior and friends pulled together (SocialMF):
$$\mathcal L = -\!\!\sum_{(u,\, i \succ j)} \!\!\log \sigma(x_{ui} - x_{uj}) + \lambda_p \sum_u \lVert \mathbf p_u \rVert^2 + \lambda_q \sum_i \lVert \mathbf q_i \rVert^2 + \lambda_t \sum_u \lVert \mathbf t_u - \mathbf t_u^{(0)} \rVert^2 + \lambda_s\!\!\! \sum_{(u,v)\in \text{friends}} \!\!\!\lVert \mathbf p_u - \mathbf p_v \rVert^2$$
- Context-aware BT (day, hour, group size) using the `dayOfWeek`/`hour` we save today; learned local-vs-visitor weighting; Thompson-sampling exploration slot for new pop-ups; smarter comparison picking ($\arg\min_j |P(i \succ_u j) - \tfrac12|$); evaluation by held-out pairwise accuracy and NDCG@10.
- Long term: two-tower retrieval, LightGCN on the user–place–friend graph, sequential "what next tonight".
- Groups: $S_G(i) = (1-\beta)\frac{1}{|G|}\sum_{u\in G}\hat r_{ui} + \beta \min_{u\in G}\hat r_{ui}$, $\beta \approx 0.5$, and drop $i$ if any $\hat r_{ui} < 4$.

### 8.8 Papers behind it

Bradley & Terry 1952 (paired comparisons); Elo 1978; Glickman 1999 (Glicko); Herbrich et al. 2006 (TrueSkill); Rendle et al. 2009 (BPR); Koren, Bell & Volinsky 2009 (matrix factorization); Burges et al. 2005 (RankNet); Jamieson & Nowak 2011 (active ranking: why binary insertion needs $O(\log n)$ questions); Ye et al. 2011 (power-law distance decay for POIs); Yuan et al. 2013 (time-aware POI); Yin et al. 2013 (LCARS) and Ference et al. 2013 (recommendations for out-of-town users, locals weighted); Ma et al. 2009 and Jamali & Ester 2010 (social trust / SocialMF); Herlocker et al. 2000 (explanations); Masthoff 2011 (group recommendation); Chapelle & Li 2011 (Thompson sampling); Christiano et al. 2017 (BT on human preferences). Full table with links: `research/recommendation.md`.

**Pitch lines:** "Every ranking is a pairwise comparison, the same Bradley–Terry math behind chess Elo and how modern AI learns human preferences." "Your taste learns from every comparison, live, and the map re-sorts in under a second." "Visitors see places weighted by locals with similar taste." "Every score comes with a reason, because the model is additive."

## 9. The three captains and their tasks

Each task = one PR. Do them in order. Before opening a PR, rebase on `main`.

### Captain 1 – Recs: ML scoring + map algorithm

You own the brain: the contract, the scoring model in section 8, and the queries the Map, Home and Venue screens read. Your first task unblocks everyone, so keep R1 small and fast.

**R1. Foundation (merge first, target 12:20)**
1. If `docs/CONTRACT.md` is missing, save this file's section 6 there. Create `convex/lib/contract.ts` with exactly the types in section 6.
2. Split the schema: `convex/schema.ts` only spreads `...authTables` plus the tables exported from `convex/tables/catalog.ts`, `convex/tables/people.ts` and `convex/tables/social.ts`. Move every existing table, field and index into the right file per section 7 (keep them all; add the new optional fields and indexes from section 7, including `notifications` and `appConfig`).
3. `convex/lib/recs.ts`: the pure functions from section 8.6 (`FEATURES`, `cosine`, `updateTaste`, `updateElo`, `predict`, `mapRank`) plus `contentScore(t, f) = 1 + 4.5*(1 + cosine(t, f))`, `topFeatures(t, f)`, `whyFromFeatures(features)` → a short phrase like "Loud, young crowd + pop music", `matchPct(score) = round((score-1)/9*100)`, and `quizToVector(answers)` mapping the 6 quiz answers (P1's list) to the 13 features with a sensible table. `convex/scoring.ts` re-exports them for other Convex files. All weights are named constants at the top.
4. `convex/seedPlaces.ts`: internal mutation inserting ~30 real, well-known places within ~1.5 km of the event venue (10 nightlife, 8 food, 5 culture, 3 outdoors, plus 4–6 clearly labeled demo pop-ups), each with lat/lng, category, subcategory, blurb, priceLevel and a hand-set `venueVector`. Idempotent (upsert by `source: "seed"` + `sourceId`). Run it.
5. `convex/discover.ts`: `nearby` and `tonight` per the contract. v1: bounding box, haversine distance, `score = contentScore(my tasteVector or a neutral 0.5 vector, venueVector)`, `why = whyFromFeatures(topFeatures(...))`, order by `mapRank(score, distance, 0)`, `rank` 1..n, `tier` top for ranks 1–5, good for 6–25, other after, `friends: []`, `algo: "cosine-v1"`, attribution "© OpenStreetMap contributors".
6. `convex/places.ts`: `get` (VenueDetail; `breakdown` = top 4 feature contributions scaled 0–10; `friendRankings: []`) and `search` (case-insensitive name match, ≤10, scored like `nearby`).
7. `lib/demoLocation.ts`: `useDemoLocation()`; demo ON by default, pinned to `DEMO_COORDS` = the event venue (one constant; Ethan gives the coordinates). Off → `expo-location` foreground permission. `lib/useNearby.ts`: `useNearby(filter)` wrapping `useQuery(api.discover.nearby, …)`.
No screens.

**R2. Real score "hybrid-v2"** (after R1). Implement section 8.3–8.5 in `nearby`, `tonight`, `places.get`, `places.search`: candidates ≤ ~200 from the geo box, skip past events and closed places; load each candidate's rankings (by place/event index) with the rater's `tasteVector`, local flag (`ranking.wasLocal` or `homeCity == "San Francisco"`) and whether they're my accepted friend; `predict()`; if I ranked it, show my own score; order by `mapRank` with `timeMatch` (open now and fits the hour, or an event starting within 6 h); top-5 diversity (skip a candidate whose `venueVector` cosine > 0.95 with one already picked); the why line rules in 8.5; `friends` = up to 3 accepted friends who ranked it; `friendRankings` with caption/photo from their post; `myRanking`; drop nightlife for under-21 viewers. `algo: "hybrid-v2"`. Add 3 tests for the pure functions if there's a test runner.

**R3. Live learning "hybrid-v3"** (after P2 is merged). In `convex/scoring.ts` export `applyComparison(ctx, userId, winner, loser)` (loads `tasteVector`, `tastePrior`, both items' `venueVector`, `elo`, `nComparisons`; applies `updateTaste` and `updateElo`; patches them; same category only) and `applyBucket(ctx, userId, item, bucket)` (loved moves $\mathbf t_u$ 10% toward $\mathbf f_i$, didnt 5% away, clipped). Then reply with the exact import + one-line calls for Captain 2 to add inside `rankings.rank` (P5). `algo: "hybrid-v3"`.

**R4. Map at scale + debug panel.** If `@convex-dev/geospatial` installs cleanly, index places/events and use `nearest()` with max distance + category filter; otherwise keep the bounding box with a lat index. Add `convex/debug.ts` query `explain({kind, id, lat, lng})` returning every term of the score (content, crowd, $\lambda_i$, elo, distance penalty, timeMatch) so we can show the math live in the demo.

**R5 (stretch, after 3:30). Plan my night.** `discover.plan({lat, lng, memberIds, vibe})` → 3 stops (early / mid / late) by the group score in 8.7, each with every member's score and a why. Optional contract field; Bryan builds the screen.

### Captain 2 – People: sign-up, the rating system, notifications

You own everything a user does with their account: signing up, the taste quiz, ranking places, and notifications. Your rankings are the training data for Captain 1's model, so save every field.

**P1. Sign-up, quiz, taste card** (start now, open the PR after R1 merges)
1. Make sign up (username, password, display name, birthday, home city) and sign in with Convex Auth work end to end. After sign-in: onboarding if `users.me.onboarded` is false, else the tabs.
2. `convex/users.ts`: `me` (contract shape; `onboarded` = `tasteVector` set) and `saveQuiz({answers})`: save `quizAnswers`, set both `tasteVector` and `tastePrior` to `quizToVector(answers)` (from `convex/scoring.ts`), return `tasteSummary` (4 meters, e.g. Chill 70%, Music-first 85%, Night owl 60%, Budget-minded 55%).
3. Stubs with exact contract shapes: `rankings.listInBucket` → `[]`, `rankings.rank` → throws "not yet", `notifications.list` → `[]`, `unreadCount` → 0, `markAllRead`.
4. Screens in `app/(onboarding)/`: Location primer (demo location is on; foreground permission only), Quiz (6 cards): "What music gets you out?" (House, Hip-hop, Pop, Techno, Latin, Live bands; multi), "Your ideal crowd?" (Intimate, Lively, Packed, Don't care), "Budget for a night out?" (Under $20, $20–50, $50–100, $100+), "When does your night peak?" (Before 10, 10 to 12, After midnight, Sunrise), "Loud or can you hear yourself?" (Quiet, Some buzz, Loud, Deafening), "Besides nightlife you're into…" (Food, Museums & art, Outdoors, Live shows; multi). Then the "Taste card reveal" with the meters and a "Let's go" button to the Map. Match Bryan's prototype (`design/prototype/index.html`) with Bryan's components.

**P2. Rating backend (Beli-style)**
- `listInBucket({category, bucket})`: my rankings in that category + bucket, best first.
- `rank({kind, id, bucket, position, comparisons, tags, caption?, photoStorageId?})`: `position` is where the client's binary search put it (1 = best in the bucket). Insert, shift the others, recompute every score in that bucket: with $k$ items in bucket $[a, b]$ (loved $[6.7, 10]$, fine $[3.4, 6.7]$, didnt $[0, 3.3]$), position $j$ gets
$$\text{score}_j = b - \left(j - \tfrac12\right)\frac{b - a}{k}$$
  Save every comparison (`winnerId, loserId, category, createdAt, dayOfWeek, hour`) and the ranking (`wasLocal` = my homeCity is San Francisco, `visitedAt`, `dayOfWeek`, `hour`). Re-ranking something replaces the old ranking. Insert a `posts` row (friends visibility). Return `RankResult` with label "#2 of your bars · 8.9", where # is the overall position in that category across buckets. Leave a marked spot for Captain 1's `applyComparison` / `applyBucket` calls.

**P3. Rank flow screens** (the center "+" tab, `app/(tabs)/rate.tsx` + `app/rate/*`), like the prototype's "Rate flow":
1. Pick a spot: skip if opened with `?kind&id` (from the Venue page's "Rank this place"); else search (`api.places.search` near `useDemoLocation()`) + "Or pick another".
2. "How was it?": "Loved it" / "It was fine" / "Didn't like it".
3. "Which was better?": binary search against `listInBucket`, VS cards, about $\lceil \log_2 n \rceil$ rounds (max 4), "1 of 3" progress; skip if the bucket is empty.
4. Tags: tap-only chips by category (bars/clubs: crowd age, music, energy, price; restaurants: cuisine, price, noise, good for; shows: sound, crowd vibe, venue, worth it; museums/outdoors: crowded?, time needed, good for) + vibe tags.
5. "Add a photo?" (only if `posts.generateUploadUrl` exists) + caption → "Post" → `rankings.rank`.
6. Result: "<name> is now #2 of your bars · 8.9" with the list and the new row highlighted; "Done" → Feed.

**P4. Notifications (in-app, live)**
- `convex/notifications.ts`: `list`, `unreadCount`, `markAllRead`, and the exported helper `notify(ctx, {...})`.
- Create them: in `rankings.rank`, notify each accepted friend ("Bryan ranked Zeitgeist #1 · 9.4", link to the venue), and anyone who also ranked the same place ("…and you gave it 7.1"). Export `notify` so Albert's friend requests can use it. A cron (in your own file `convex/notificationsCron.ts`, registered by asking Captain 3 to add one line to `convex/crons.ts`) every 30 min: for each user, if an event starting in the next 6 h scores ≥ 8.5 for them (`predict`), notify once ("Tonight: X · 8.8 for you").
- `app/notifications.tsx` like the prototype's "Notifications" screen; mark all read on open. Bryan adds the bell + badge (`unreadCount`) on Home.
- Real push notifications are cut today (they need a dev build + APNs; the Revyl simulator and Expo Go can't show them reliably). In-app + live is the demo.

**P5. Wire live learning** (after R3): add Captain 1's import and calls inside `rankings.rank` (one `applyComparison` per saved comparison, one `applyBucket`). Verify on the shared deployment: ranking a loud pop bar over a quiet wine bar raises loud places in `nearby` for that user.

### Captain 3 – Live data: OSM, Ticketmaster, Luma, Partiful

You own the catalog: every place and event on the map, cleaned, de-duplicated and featurized so Captain 1's model can score it.

**D1. Ingest core + OpenStreetMap** (start now, open the PR after R1 merges)
- `convex/ingest.ts`: internal mutation `upsertBatch(kind, rows)` (≤200 rows/call; upsert by `source` + `sourceId`; de-dupe same name within 50 m, or same title + start within 1 h for events, keeping the richer row), and a pure `featurize({category, subcategory, tags, title, description, price})` → 13-number `venueVector` by keyword rules (nightclub/techno/DJ → energy, dancing, electronic, loudness; dive bar/pub → loudness, low price; cocktail/wine bar → price, low loudness; jazz/live/band → liveMusic; hip-hop/rap → hiphop; pop/top 40 → pop; indie/rock → indie; museum/gallery/art → culture; park/hike/outdoor → outdoors; restaurant/food/cuisine → food; "21+"/college/student → crowdAge; `$$$` → price). Defaults 0.3; clip to $[0,1]$.
- `convex/imports/osm.ts`: action `importOsm` for the SF box and tags in section 7 (`out center tags;`), map to our categories, drop unnamed, featurize, `upsertBatch`. Report counts per category.

**D2. Ticketmaster**: action `importTicketmaster` with `geoPoint` + `radius` around the venue, next 7 days, keep `ticketUrl`, `imageUrl`, price, venue lat/lng; drop past events; category `live`; featurize from classification (genre/subgenre). Key from `process.env.TICKETMASTER_KEY` (if it's missing, tell Ethan to set it with `npx convex env set`).

**D3. Luma**: action `importLuma`: find the JSON endpoint luma.com/sf uses for its discover list (load the page, read its network calls / embedded data; don't guess URLs), page through SF events for the next 7 days, keep in-person events with coordinates, `sourceUrl` = the lu.ma event link, category `popup` (or `live` for concerts), featurize from title + description.

**D4. Partiful**: action `importPartiful`: public events only. First try the public Explore / discover listing for San Francisco; if it isn't reachable politely (robots.txt, login, or blocked), read a list of public event URLs from `appConfig.partifulUrls` (Ethan pastes them) and parse each page's OpenGraph tags / embedded JSON (title, start, address, image). Geocode the address only if it's in the page; skip events without a location. ≤1 request/s, cache by URL, never store guest lists or personal data. Category `popup`.

**D5. Live refresh + freeze**: `convex/crons.ts`: every 30 min run Luma and Partiful, every 2 h Ticketmaster, each first checking `appConfig.ingestFrozen` and exiting if true. A mutation `setIngestFrozen(bool)`. Add Captain 2's notification cron line when asked. At 4:00 PM Ethan runs `setIngestFrozen(true)`. Report row counts per source and category.

## 10. Timeline (Pacific)

| Time | Captain 1 – Recs | Captain 2 – People | Captain 3 – Live data |
| --- | --- | --- | --- |
| 11:50–12:20 | **R1 foundation** (merge first) | P1 (PR after R1) | D1 (PR after R1) |
| 12:20–1:15 | R2 hybrid-v2 | P1 finish → P2 rating backend | D1 finish → D2 Ticketmaster |
| 1:00 | | Albert runs the first Revyl cloud-iPhone build | |
| 1:15–2:15 | R4 scale + debug | P3 rank flow screens | D3 Luma |
| 2:15–3:15 | R3 live learning (after P2) | P4 notifications | D4 Partiful |
| 3:15–4:00 | R5 plan (stretch) / fixes | P5 wire live learning | D5 crons + freeze |
| **4:00** | | | **Data freeze** (`setIngestFrozen(true)`) |
| 4:00–4:45 | Integrate, fix | Integrate, fix | Fix data issues seen on the map |
| **4:45** | **Code freeze**: only fixes for broken demo steps | | |
| 4:45–5:45 | Algorithm slide (section 8.8 pitch lines + `debug.explain`) | | |

## 11. Demo (2 min)

1. Sign in as Ethan on a cloud iPhone (demo location). Map: pins by category, top 5 ringed, "8.7 for you · Loud, young crowd + pop music", tonight's Luma/Partiful pop-ups on the map.
2. Same bar shows a different score and why for Bryan (different quiz).
3. Venue page: friends who went, with scores. "Rank this place" → Loved → 2 comparisons → "#2 of your bars · 8.9" → Post.
4. Bryan's phone: the post appears in the feed instantly, plus a notification.
5. Ethan's map re-sorts live: louder places moved up (taste learned from the comparison). Albert (local) rated a hidden bar 9.5, so for visitors it reads "Locals like you rate it 9.2".
6. One slide: Bradley–Terry on pairwise comparisons, locals weighted, explainable scores, and the after-hackathon model.
