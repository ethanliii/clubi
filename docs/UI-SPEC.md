# clubi UI spec: what every screen does

For Bryan and his coding agent. This file says **what each screen shows, every button with its exact label, which backend function it calls, and what happens next.** How it looks (colors, type, spacing, motion) is yours.

Read with:
- [`docs/CONTRACT.md`](CONTRACT.md): the list of backend functions, with ✅ live / 🆕 being built.
- [`convex/lib/contract.ts`](../convex/lib/contract.ts): the exact TypeScript types (`NearbyItem`, `VenueDetail`, `FeedItem`, …). Import types from there.

**Status marks:** ✅ the function is live on `main`, wire it today. 🆕 it is being built this afternoon; the name and shape are final, so you can write the screen now, but calling it before it lands throws. Build order is at the bottom.

---

## 5 rules

1. **Render only what the backend returns.** Never compute a score, a rank, an order, a match %, a pin size or a "why" line in the UI. Lists arrive already sorted.
2. **`undefined` means loading.** `useQuery` returns `undefined` first. Show a skeleton, not an error and not "nothing here".
3. **Errors are sentences.** Mutations throw `Error` with a short readable message. Catch it and show `error.message` in a toast.
4. **Keep the exact button labels in this file.** The automated phone tests (Revyl) find buttons by their text: "Sign up", "Rank this place", "Post", "Filter: Bars".
5. **Everything is live.** Convex queries update by themselves. No pull-to-refresh, no refetch, no local copies of server data.

Also: never show anyone's live location. Posts are friends-only unless the user picks otherwise. Under-21 users never see nightlife; the backend already filters it, the UI does nothing.

---

## Navigation map

```
Signed out
  (onboarding)/welcome ── "Get started" ─▶ sign-in (Sign up mode)
                       └─ "I have an account" ─▶ sign-in (Sign in mode)
Signed in, users.me.onboarded == false
  (onboarding)/quiz ─▶ (onboarding)/taste-card ── "Let's go" ─▶ tabs
Signed in, onboarded
  Tabs
  ├─ Home  (tabs)/index ──▶ venue · notifications (bell) · plan · trips
  ├─ Map   (tabs)/map ────▶ venue (pin or list row)
  ├─ +     (tabs)/rate ───▶ rate flow ─▶ result ─▶ quick questions ─▶ Feed
  ├─ Feed  (tabs)/feed ───▶ user · venue · post (comments)
  └─ Profile (tabs)/profile ─▶ rankings · friends · saved · following · trips · settings
  Stack screens (open from anywhere)
  venue/<kind>/<id> ─▶ rate flow · user · performer · venue ("More like this")
  user/<userId> ─▶ compare · venue
  friends ─▶ user
  trip/<tripId> ─▶ venue · plan
  performer/<performerId> ─▶ venue
  notifications ─▶ whatever the notification's `link` says
```

## Route changes needed (from PR #6)

| Today | Change to | Why |
| --- | --- | --- |
| `src/app/venue/[id].tsx` | `src/app/venue/[kind]/[id].tsx` | Places and events are different tables. Every call needs both `kind` (`place` or `event`) and `id`. Notification links are `/venue/<kind>/<id>`. |
| `src/app/friend/[id].tsx` | `src/app/user/[userId].tsx` | Links from the backend are `/user/<userId>`. |
| `src/app/compare.tsx` | `src/app/compare/[userId].tsx` | Compare needs to know who. |
| `src/app/moments.tsx` | delete | Left over from the first demo. |
| new | `src/app/post/[postId].tsx` | One post with its comments. Link: `/post/<postId>`. |
| new | `src/app/trips.tsx`, `src/app/trip/[tripId].tsx` | Trips and groups. Link: `/trip/<tripId>`. |
| new | `src/app/performer/[performerId].tsx`, `src/app/following.tsx` | Artists. Link: `/performer/<performerId>`. |
| new | `src/app/settings.tsx`, `src/app/saved.tsx` | |
| new | `src/app/rate/*` | The steps of the rank flow (or keep them as steps inside `(tabs)/rate.tsx`). |

`/friends` stays as it is. Ids are plain strings; pass them through untouched.

## Copy-paste snippets

```tsx
// Read (live). undefined = loading.
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";          // adjust the ../ depth
import type { NearbyItem } from "../../convex/lib/contract";

const venue = useQuery(api.places.get, { kind, id });        // VenueDetail | null | undefined
if (venue === undefined) return <Skeleton />;
if (venue === null) return <NotFound />;

// Wait for something before asking: pass "skip".
const { lat, lng, ready } = useDemoLocation();
const tonight = useQuery(api.discover.tonight, ready ? { lat, lng } : "skip");
```

```tsx
// Write, with a toast on failure.
const toggleSave = useMutation(api.saves.toggle);
const onSave = async () => {
  try {
    await toggleSave({ kind, id, type: "want" });
  } catch (error) {
    toast(error instanceof Error ? error.message : "Something went wrong");
  }
};
```

```tsx
// Endless list.
const { results, status, loadMore } = usePaginatedQuery(api.posts.feed, {}, { initialNumItems: 15 });
// status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"
<FlatList data={results} onEndReached={() => status === "CanLoadMore" && loadMore(15)} />
```

```tsx
// Photo upload (same steps for a post photo and for an avatar).
const generateUploadUrl = useMutation(api.posts.generateUploadUrl);
async function uploadPhoto(asset: { uri: string; mimeType?: string }) {
  const url = await generateUploadUrl();
  const blob = await (await fetch(asset.uri)).blob();
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": asset.mimeType ?? "image/jpeg" }, body: blob });
  const { storageId } = await response.json();
  return storageId;      // pass to rankings.rank as photoStorageId, or to posts.attachPhoto
}
```

Location: every "near me" call takes `lat` and `lng` from `useDemoLocation()` in `src/lib/demoLocation.ts`. Call nothing until `ready` is true.

## 1. Welcome, Sign up, Sign in

**Routes:** `(onboarding)/welcome.tsx`, `sign-in.tsx` · **Purpose:** get an account and get in. · **Status:** ✅

```
┌ Welcome ───────────────┐   ┌ Sign up ────────────────┐
│ (video)                │   │ Username      [       ] │
│ clubi                  │   │ Password      [       ] │
│                        │   │ Display name  [       ] │
│ [ Get started ]        │   │ Birthday      [YYYY-MM-DD]
│ [ I have an account ]  │   │ Home city     [       ] │
└────────────────────────┘   │ (error line)            │
                             │ [ Sign up ]             │
                             │ Have an account? Sign in│
                             └─────────────────────────┘
```

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| "Get started" | Opens `sign-in` in Sign up mode | none | |
| "I have an account" | Opens `sign-in` in Sign in mode | none | |
| "Sign up" | Creates the account | `useSignUpWithUsernamePassword(api.auth)` → `signUp({username, password, displayName, birthday, homeCity})` | On `result.status === "error"` show `result.userError.error`. Otherwise you are signed in. |
| "Sign in" | Signs in (only username + password shown) | `useSignInWithUsernamePassword(api.auth)` → `signIn({username, password})` | Same error handling. |
| "Have an account? Sign in" / "New here? Sign up" | Switches mode | none | |

- `birthday` must be `YYYY-MM-DD` or left out. Display name, birthday and home city are optional. Home city matters: it marks the user as a local there.
- If the sign-up hook's types reject the three extra fields, sign up with username + password, then call `api.settings.update({displayName, birthday, homeCity})` 🆕.
- **After sign-in:** read `api.users.me`. `null` → still signed out. `onboarded === false` → `/quiz`. Otherwise → tabs. `useConvexAuth()` gives `isLoading` and `isAuthenticated`.
- **States:** disable both buttons while `pending`. Errors show under the fields.

## 2. Taste quiz and taste card

**Routes:** `(onboarding)/quiz.tsx`, `(onboarding)/taste-card.tsx` · **Purpose:** six taps that set the starting taste. · **Status:** ✅

Six cards, in this order. The answer for each card is the list of picked option **indexes** (0-based).

| # | Question | Options (index order) | Pick |
| --- | --- | --- | --- |
| 1 | "What music gets you out?" | House, Hip-hop, Pop, Techno, Latin, Live bands | many |
| 2 | "Your ideal crowd?" | Intimate, Lively, Packed, Don't care | one |
| 3 | "Budget for a night out?" | Under $20, $20–50, $50–100, $100+ | one |
| 4 | "When does your night peak?" | Before 10, 10 to 12, After midnight, Sunrise | one |
| 5 | "Loud or can you hear yourself?" | Quiet, Some buzz, Loud, Deafening | one |
| 6 | "Besides nightlife you're into…" | Food, Museums & art, Outdoors, Live shows | many |

```
┌ Quiz  3 of 6 ──────────┐   ┌ Your taste ─────────────┐
│ Budget for a night out?│   │ Late-Night Socialite    │
│ ( Under $20 )          │   │ Chill          ▓▓▓░ 70% │
│ ( $20–50 )  ◀ picked   │   │ Music-first    ▓▓▓▓ 85% │
│ ( $50–100 )            │   │ Night owl      ▓▓░░ 60% │
│ ( $100+ )              │   │ Budget-minded  ▓▓░░ 55% │
│ [ Back ]      [ Next ] │   │ [ Let's go ]            │
└────────────────────────┘   └─────────────────────────┘
```

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| option chip | Picks or unpicks | none | |
| "Next" | Next card. Disabled until at least one pick. | none | |
| "Back" | Previous card | none | |
| "See my taste" (on card 6) | Saves | `api.users.saveQuiz({answers})`, e.g. `answers: [[0,3],[2],[1],[2],[2],[0,3]]` | Returns `{tasteSummary: {label, pct}[]}` (4 meters). Go to the taste card. |
| "Let's go" | Enters the app | none | Go to the Feed tab. |

- Show the meters from `tasteSummary`.
- **States:** "See my taste" shows a spinner while saving. On error, toast and stay on card 6.

## 3. Home / Tonight

**Route:** `(tabs)/index.tsx` · **Purpose:** what is worth doing tonight, at a glance. · **Status:** ✅ for the three rows and the bell; "Coming up for you" is 🆕.

```
┌ Tonight ──────────── 🔔3 ┐
│ Top picks for you         │
│ [card][card][card] ▶      │
│ Friends went here         │
│ [card][card] ▶            │
│ Events tonight            │
│ [card][card] ▶            │
│ Coming up for you         │
│ [card][card] ▶            │
│ [ Plan my night ] [ Trips ]│
└───────────────────────────┘
```

**Reads**
- `api.discover.tonight({lat, lng})` ✅ → `{topPicks, friendsGoing, events}`, each `NearbyItem[]`, already ordered.
- `api.notifications.unreadCount({})` ✅ → number for the bell badge. Hide the badge at 0. It caps at 99; show "99+".
- `api.discover.upcoming({lat, lng})` 🆕 → `NearbyItem[]`, events in the next 14 days. An artist the user rated highly pushes an event up, and its `why` says so.

**A card shows:** `name`, `score` with `why` right under it, `matchPct`, distance from `distanceMeters`, `friends` avatars with their scores, and for events `startsAt` and `performers?`.

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| card | Opens the venue | none | `/venue/<kind>/<id>` |
| bell, label "Notifications" | Opens notifications | none | `/notifications` |
| "Plan my night" | Opens the planner | none | `/plan` |
| "Trips" | Opens trips | none | `/trips` |

**States:** loading → skeleton rows. A row with an empty list is hidden. All rows empty → "Nothing nearby yet. Try the map." with a "Open map" button.

## 4. Map

**Route:** `(tabs)/map.tsx` · **Purpose:** the main screen: pins around the user, ranked for them. · **Status:** ✅

```
┌───────────────────────────────┐
│ [ Search places and events  ] │
│ (Tonight)(Bars)(Food)(Events)…│
│        ◉8.7   ·    ·          │
│   ·        ◎ Zeitgeist 8.1    │
│      ◉9.1        ·       (me) │
│ © OpenStreetMap contributors  │
├─ sheet ───────────────────────┤
│ 1  Trick Dog   9.1  94%  350 m│
│    Loud, young crowd + pop    │
│ 2  El Rio      8.7  …         │
└───────────────────────────────┘
```

**Reads:** `useNearby(filter)` from `src/lib/useNearby.ts` ✅ → `NearbyResult | undefined`: `items` (already ranked, `rank` 1 = best), `center`, `attribution`. The hook also asks the backend to import places the first time anyone looks at a new area; new pins appear by themselves about 20 seconds later.

**Pins** (decide the look; the rule for which is which comes from the backend):
- `tier === "top"`: the top 5. Big ringed pin with the `score`.
- `tier === "good"`: labeled pin, `name` + `score`.
- `tier === "other"`: a dot.
- Color or icon by `category`. Events (`kind === "event"`) should read differently from places.

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| "Filter: Tonight", "Filter: Bars", "Filter: Food", "Filter: Events", "Filter: Pop-ups", "Filter: Outdoors", "Filter: All" | One chip is active. The visible text can be short ("Bars"), but set `accessibilityLabel` to the full label. | `useNearby` with `tonight`, `bars`, `food`, `events`, `popups`, `outdoors`, `all` | Pins and list update by themselves. |
| search box, placeholder "Search places and events" | Shows results under the box as the user types (2+ letters, wait 300 ms) | `api.places.search({text, lat, lng})` ✅ → `NearbyItem[]` (≤10) | Tap a result → venue page. |
| pin | Selects it: the sheet shows that one card on top | none | Tap the card → `/venue/<kind>/<id>` |
| list row | Opens the venue | none | `/venue/<kind>/<id>` |
| "Demo location" switch | On = pretend to be at the demo spot | `setDemo(on)` from `useDemoLocation()` | Map recenters on the new `lat`, `lng`. `isDemo` tells you the current state. |
| "Recenter" | Moves the camera back to `center` | none | |

- A list row shows: `rank`, `name`, `score`, `why`, `matchPct`, distance, `friends` avatars, "Open now" when `openNow`, the start time when `startsAt` is set.
- **Show `attribution` on the map at all times** ("© OpenStreetMap contributors"). It is a licence requirement.
- Show the user's own position only. Never anyone else's.
- **States:** loading → map with a skeleton sheet. `items` empty → "Nothing here yet. We're loading places for this area." Search with no results → "No matches".

## 5. Venue / event page

**Route:** `venue/[kind]/[id].tsx` · **Purpose:** everything about one place or event, and the way into ranking it. · **Status:** ✅ core; insights, performers, save, going, similar are 🆕.

```
┌ ← ───────────────── Save ♡ ┐
│ (photo)                     │
│ Zeitgeist · Bar · $$ · Open │
│ 8.7 for you   94% match     │
│ Loud, young crowd + pop     │
│ Energy ▓▓▓▓ Music ▓▓▓ …     │
│ Friends: Albert 9.1 · "…"   │
│ Packed after 11 · Mostly 20s│
│ Best for: Dancing, Groups   │
│ Playing: DJ Nova [ Follow ] │
│ [ Rank this place ]         │
│ [ I'm going ] [ Get tickets ]│
│ More like this ▶            │
└─────────────────────────────┘
```

**Reads**
- `api.places.get({kind, id})` ✅ → `VenueDetail | null`. Show `name`, `subcategory ?? category`, `priceLevel`, `openNow` or `startsAt`, `imageUrl`, `blurb`, `score`, `matchPct`, `why`, `breakdown[]` (label + 0–10 bar), `address`, `hours`, `tags`, `friendRankings[]` (name, score, caption, `when`, photo, a "Local" mark when `isLocal`), `myRanking` (if set: "You ranked it #`position` of `outOf` · `score`").
- `api.insights.venue({kind, id})` 🆕 → `VenueInsights`: show `highlights[]` and `bestFor[]` as chips. When `confidence === "low"` add "Based on a few visits". Optional: one bar per `distributions[]` entry (`text`, then each option's `label` and `pct`).
- `api.performers.forEvent({eventId: id})` 🆕, events only → `PerformerCard[]`.
- `api.discover.similar({kind, id, lat, lng})` 🆕 → `NearbyItem[]`.

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| "Rank this place" (events: "Rank this event"; when `myRanking` is set: "Rank again") | Starts the rank flow at step 2 | none | `/rate?kind=<kind>&id=<id>` |
| "Save" / "Saved" | Toggles want-to-go | `api.saves.toggle({kind, id, type: "want"})` 🆕 | Label follows `saved`. |
| "I'm going" / "Going" (events only) | Toggles going | `api.saves.toggle({kind, id, type: "going"})` 🆕 | Label follows `going`. Friends see it under "Friends went here / going". |
| "Get tickets" (when `ticketUrl`) | Opens the link in the browser | none | |
| "View on Luma" / "View on Partiful" / "View on Ticketmaster" / "View on Eventbrite" (when `sourceUrl`, by `source`) | Opens the link | none | |
| "Follow" / "Following" on a performer | Toggles follow | `api.performers.follow({performerId, follow})` 🆕 | The user gets a notification when that performer has a new event nearby. |
| performer name | Opens the performer | none | `/performer/<performerId>` |
| friend row | Opens that friend | none | `/user/<userId>` |
| "More like this" card | Opens that venue | none | |
| "Directions" | Opens the maps app at `lat`, `lng` | none | |

**States:** loading → skeleton. `null` → "This place is no longer listed" with "Back". No `friendRankings` → "None of your friends have ranked this yet. Be the first."

## 6. Rank flow (the "+" tab)

**Routes:** `(tabs)/rate.tsx` plus `rate/*` · **Purpose:** rank a place in under 20 seconds, then answer a few quick questions. This is the heart of the app. · **Status:** ✅ through the result screen; the photo step and quick questions are 🆕.

```
1 Pick a spot      2 How was it?        3 Which was better?   1 of 3
[ Search…      ]   Zeitgeist            ┌────────┐   ┌────────┐
 Trick Dog         [ Loved it ]         │Zeitgeist│ VS │ El Rio │
 El Rio            [ It was fine ]      └────────┘   └────────┘
 Or pick another   [ Didn't like it ]        [ Too close to call ]

4 Tags + photo + caption        5 Result                 6 Quick questions  2 of 4
(Great music)(Packed)(Pricey)   Zeitgeist is now         How busy was it?
[ Add a photo ]                 #2 of your bars · 8.9    ( Empty )( Just right )( Packed )
[ Caption…        ]             1 Trick Dog 9.4          [ Skip ]            [ Next ]
Who sees it: (Friends)(Public)  2 Zeitgeist 8.9 ◀ new
[ Post ]                        [ Continue ]
```

### Step 1. Pick a spot
Skip this step when the screen opens with `?kind=&id=` (from "Rank this place").

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| search box, placeholder "Where did you go?" | Results as the user types | `api.places.search({text, lat, lng})` ✅ | |
| suggestions under the box before typing | Nearby places | first rows of `useNearby("all")` ✅ | |
| a row | Picks it | none | Step 2. Keep its `kind`, `id`, `name`, `category`. |

### Step 2. How was it?
Three buttons: "Loved it" → `bucket: "loved"`, "It was fine" → `"fine"`, "Didn't like it" → `"didnt"`. Tap → step 3.

### Step 3. Which was better?
Finds where the new item sits among what the user already ranked in that bucket. Read `api.rankings.listInBucket({category, bucket})` ✅ → `{id, kind, name, score, position}[]`, best first. `category` is the picked item's `category`.

```
list = listInBucket({category, bucket}), without the new item itself (matters when re-ranking)
lo = 0; hi = list.length; comparisons = []; rounds = 0
while lo < hi and rounds < 4:
    mid = floor((lo + hi) / 2)
    show "Which was better?"   new item  VS  list[mid]
    if the user taps the new item:  comparisons.push({winnerId: newId, loserId: list[mid].id});  hi = mid
    else:                           comparisons.push({winnerId: list[mid].id, loserId: newId});  lo = mid + 1
    rounds += 1
position = floor((lo + hi) / 2) + 1        // 1 = best in this bucket
```

- Empty bucket: skip this step. `position = 1`, `comparisons = []`.
- Show progress "1 of 3". The number of rounds is `min(4, ceil(log2(list.length + 1)))`.
- "Too close to call" ends the loop early and uses the `position` formula as is. It adds no comparison.
- Every comparison must be between the new item and one from that list. The backend rejects anything else.

### Step 4. Tags, photo, caption

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| tag chips (tap only, no typing) | Toggles a tag. Suggested: "Great music", "Packed", "Chill", "Pricey", "Cheap drinks", "Good for groups", "Date spot", "Long line", "Great food", "Worth it", "Touristy", "Hidden gem". | none | `tags: string[]`; may be empty. |
| "Add a photo" | Opens the photo picker, uploads, shows a thumbnail with "Remove" | upload snippet above with `api.posts.generateUploadUrl` 🆕 | Keep the `storageId`. Hide this button until the function is live. |
| caption box, placeholder "Add a note (optional)" | Up to 280 characters | none | |
| "Who sees it": "Friends" / "Public" / "Only me" | Picks `friends` / `public` / `private`. Start on `settings.get().defaultVisibility` 🆕, else "Friends". | none | |
| "Post" | Saves the ranking and makes the post | `api.rankings.rank({kind, id, bucket, position, comparisons, tags, caption?, photoStorageId?, visibility?})` ✅ | Returns `RankResult` → step 5. |

**Careful:** `visibility` and `groupSize` are 🆕 arguments. Until they land, leave them out; the backend rejects arguments it does not know. Same for `photoStorageId` if you have not uploaded anything.

### Step 5. Result
Show "`<name>` is now `<label>`", for example "Zeitgeist is now #2 of your bars · 8.9". `label` comes from `RankResult`. Under it, the user's list for that category from `api.rankings.listInBucket` (or `api.rankings.mine({category})` 🆕) with the new row highlighted. Button "Continue" → step 6. If step 6 is not available yet, "Done" → Feed.

### Step 6. Quick questions 🆕
These answers are the venue data the whole app runs on, so make them effortless: one question per card, big tap targets, no typing.

- Read `api.insights.questionsFor({kind, id})` → `InsightQuestion[]` (3–4): `{id, text, multi, options: {id, label}[]}`.
- One card per question with "2 of 4" progress. `multi === false`: tapping an option moves to the next card by itself. `multi === true`: options toggle, and "Next" moves on.

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| option | Picks it | none | |
| "Skip" | Leaves this question out | none | Next card. |
| "Next" | Next card (multi-pick cards) | none | |
| "Done" (after the last card) | Sends the answers | `api.insights.submit({kind, id, rankingId, answers: [{questionId, optionIds}]})` → `{saved, highlights}` | Optional thank-you line with `highlights`, then go to the Feed tab. |
| "Skip all" | Sends nothing | none | Feed tab. |

`rankingId` is `RankResult.rankingId`. Only include questions the user answered. If `questionsFor` returns an empty list, go straight to the Feed.

**States for the whole flow:** "Post" shows a spinner and is disabled while saving. On error, toast and stay on step 4 with everything still filled in. Leaving mid-flow saves nothing.

## 7. Feed

**Routes:** `(tabs)/feed.tsx`, `post/[postId].tsx` · **Purpose:** what friends ranked, the moment they rank it. · **Status:** 🆕 (all `posts.*`)

```
┌ Feed ───────────────────────┐
│ (A) Albert ranked Zeitgeist │
│     #1 of his bars · 9.4    │
│     (photo)                 │
│     "DJ was unreal"         │
│     (Packed)(Mostly 20s)    │
│     You gave it 7.1         │
│     ♥ 3    💬 2     2h      │
│ (B) Bryan ranked …          │
└─────────────────────────────┘
```

**Reads:** `usePaginatedQuery(api.posts.feed, {}, {initialNumItems: 15})` → pages of `FeedItem`, newest first: friends' posts and the user's own. New posts appear at the top by themselves. Load more with `loadMore(15)` when the list reaches the end. No pull-to-refresh.

**A card shows:** `author.displayName` and `author.avatarUrl`, `target.name`, `label` ("#1 of their bars · 9.4") or `score`, `photoUrls` (0–4), `caption`, `tags` and `insightChips`, `myScoreForIt` as "You gave it 7.1" when set, `reactionCount`, `commentCount`, time since `createdAt`.

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| author | Opens that person | none | `/user/<userId>` |
| place name or photo | Opens the venue | none | `/venue/<target.kind>/<target.id>` |
| heart, label "Like" | Likes or unlikes | `api.posts.react({postId})` → `{reactionCount, myReaction?}` | Filled when `myReaction` is set. |
| comment icon, label "Comments" | Opens the comment sheet, or `/post/<postId>` | `api.posts.comments({postId})` → `CommentItem[]`, oldest first | |
| comment box + "Send" | Adds a comment (1–500 characters) | `api.posts.addComment({postId, text})` | Clear the box. The list updates by itself. |
| long-press my comment → "Delete" | Removes it (`mine === true` only) | `api.posts.removeComment({commentId})` | |
| "⋯" on my own post → "Edit caption" | Edits | `api.posts.update({postId, caption})` | |
| "⋯" on my own post → "Who sees it" | Changes visibility | `api.posts.update({postId, visibility})` | |
| "⋯" on my own post → "Add a photo" | Uploads and attaches (max 4) | upload snippet, then `api.posts.attachPhoto({postId, storageId})` | |
| "⋯" on my own post → "Delete post" | Confirms, then removes the post. The ranking stays. | `api.posts.remove({postId})` | |
| "Rank it too" on a card without `myScoreForIt` | Starts the rank flow for that place | none | `/rate?kind=&id=` |

`post/[postId].tsx` reads `api.posts.get({postId})` → `FeedItem | null` plus `api.posts.comments`. A post is "mine" when `author.userId === users.me.userId`.

**States:** `status === "LoadingFirstPage"` → skeleton cards. Empty → "Your feed is quiet. Add friends to see what they rank." with a "Find friends" button → `/friends`. `"LoadingMore"` → spinner row at the bottom. `"Exhausted"` → "You're all caught up".

## 8. Profile (mine) and my rankings

**Routes:** `(tabs)/profile.tsx`, `rankings.tsx` · **Purpose:** my taste and my ranked lists. · **Status:** header ✅ via `users.me`; the rest 🆕.

```
┌ Profile ─────────── ⚙ ┐
│ (avatar) Ethan  @ethan │
│ SF · "bio…"            │
│ 24 ranked · 6 friends  │
│ Chill ▓▓▓░  Night owl ▓▓│
│ [ Edit profile ]       │
│ [Friends][Saved][Following][Trips]
│ Bars        See all ▶  │
│ 1 Trick Dog       9.4  │
│ 2 Zeitgeist       8.9  │
│ Food        See all ▶  │
└────────────────────────┘
```

**Reads**
- `api.profile.get({})` 🆕 → `ProfileResult`: `user` (`displayName`, `username`, `avatarUrl`, `homeCity`, `bio`), `counts` (`ranked`, `friends`, `posts`), `tasteSummary`, `lists[]` (`category`, `noun` like "bars", `items: RankedListItem[]` best first), `recentPosts`.
- Until it lands: `api.users.me` ✅ gives name, avatar, home city and `tasteSummary`.
- `rankings.tsx`: `api.rankings.mine({category?})` 🆕 → `RankedListItem[]`: `position`, `name`, `score`, `bucket`, `rankedAt`.

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| gear, label "Settings" | Opens settings | none | `/settings` |
| "Edit profile" | Opens settings at the profile fields | none | `/settings` |
| "Friends" | | none | `/friends` |
| "Saved" | | none | `/saved` |
| "Following" | | none | `/following` |
| "Trips" | | none | `/trips` |
| "See all" on a list | Opens the full list for that category | none | `/rankings?category=<category>` |
| a ranked row | Opens the venue | none | `/venue/<kind>/<id>` |
| swipe a row → "Remove" (on `rankings.tsx`) | Confirms, then deletes the ranking and its post | `api.rankings.remove({rankingId})` 🆕 | |
| category tabs on `rankings.tsx`: "Bars", "Food", "Culture", "Outdoors", "Shows", "Pop-ups" | Filters | `rankings.mine` with `nightlife`, `food`, `culture`, `outdoors`, `live`, `popup` | |

**States:** loading → skeleton. No rankings → "Rank your first place" button → Rate tab.

## 9. Friend profile and Compare

**Routes:** `user/[userId].tsx`, `compare/[userId].tsx` · **Purpose:** see a person's taste and how it lines up with mine. · **Status:** 🆕

```
┌ ← Albert ───────────────┐   ┌ ← You and Albert ───────┐
│ (avatar) Albert · SF    │   │ 82% taste match         │
│ 31 ranked · 12 friends  │   │ You agree on 7 of 9     │
│ [ Add friend ]          │   │ Energy   you ▓▓▓  him ▓▓│
│ [ Compare tastes ]      │   │ Both ranked             │
│ Bars                    │   │ Zeitgeist  you 7.1 · 9.1│
│ 1 Zeitgeist       9.4   │   │ His favorites you haven't
│ Recent                  │   │ 1 El Rio          9.2   │
│ (post cards)            │   │ "You both love loud…"   │
└─────────────────────────┘   └─────────────────────────┘
```

**Reads**
- `api.profile.get({userId})` → `ProfileResult | null`. When `canSee === false`, show only the header and "Add friend to see their rankings".
- `api.profile.compare({userId})` → `CompareResult | null`: `tasteMatchPct`, `agreePct?`, `dims[]` (`label`, `me`, `them`, 0–100), `shared[]` (`name`, `myScore`, `theirScore`), `theirTopNewToMe[]`, `summary`.

**The friend button follows `user.status`:**

| `status` | Label | Tap calls | 
| --- | --- | --- |
| `none` | "Add friend" | `api.friends.request({userId})` |
| `outgoing` | "Requested" | `api.friends.cancel({requestId})` (after a confirm) |
| `incoming` | "Accept" and "Decline" | `api.friends.respond({requestId, accept: true})` / `accept: false` |
| `friends` | "Friends" | opens a menu with "Remove friend" → `api.friends.remove({userId})` |
| `self` | hidden | |

`requestId` comes from `user.requestId`. The label updates by itself after the call.

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| "Compare tastes" | Opens compare | none | `/compare/<userId>` |
| "Invite to a trip" (friends only) | Picks one of my trips | `api.trips.invite({tripId, userIds: [userId]})` | Toast "Invited". |
| ranked row, post card, shared row | Opens the venue | none | |

**States:** `null` → "This person isn't on clubi anymore". Compare with nothing shared → show the taste match and "You haven't ranked any of the same places yet".

## 10. Friends

**Route:** `friends.tsx` · **Purpose:** find people, answer requests. · **Status:** 🆕

```
┌ ← Friends ──────────────────┐
│ [ Search by name or username]│
│ Requests (2)                 │
│ (B) Bryan   [Accept][Decline]│
│ People you may know          │
│ (P) Priya  3 mutual · 82%    │
│            taste match [Add] │
│ Your friends (6)             │
│ (A) Albert       88% match   │
│ Sent (1)                     │
│ (S) Sam           [ Cancel ] │
└──────────────────────────────┘
```

**Reads**
- `api.friends.list({})` → `FriendsOverview`: `friends: FriendItem[]` (`displayName`, `username`, `avatarUrl`, `tasteMatchPct?`, `rankedCount?`), `incoming`, `outgoing` (`requestId`, `user`, `mutualCount?`).
- `api.friends.suggestions({})` → `FriendSuggestion[]`, best first. **Always show `reason`** ("3 mutual friends · 82% taste match").
- `api.friends.search({text})` → `UserSearchResult[]` (≤20). Each has `status` and maybe `requestId`; use the same button table as section 9.

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| search box, placeholder "Search by name or username" | Replaces the sections with results (2+ letters, wait 300 ms) | `api.friends.search({text})` | |
| "Add" | Sends a request | `api.friends.request({userId})` | Button becomes "Requested". If they had already asked me, it becomes "Friends". |
| "Accept" / "Decline" | Answers a request | `api.friends.respond({requestId, accept})` | The row moves or disappears by itself. |
| "Cancel" | Takes my request back | `api.friends.cancel({requestId})` | |
| a person row | Opens them | none | `/user/<userId>` |

**States:** hide a section with no rows. No friends and no suggestions → "Search for a friend's username to get started". Search with no results → "No one found".

## 11. Notifications

**Route:** `notifications.tsx` · **Purpose:** what happened while I was away. · **Status:** ✅ (`markRead` is 🆕)

```
┌ ← Notifications   Mark all read ┐
│ ● (B) Bryan ranked Zeitgeist    │
│       #1 · 9.4          2m      │
│ ● ♫  Calvin Harris is coming    │
│       to San Francisco · Dec 5  │
│   (A) Albert accepted your      │
│       friend request      1h    │
└─────────────────────────────────┘
```

**Reads:** `api.notifications.list({})` ✅ → `NotificationItem[]` (newest 50): `title`, `body`, `read`, `createdAt`, `actor?` (avatar), `type`, `link?`. New ones appear by themselves.

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| a row | Marks it read and opens it | `api.notifications.markRead({id})` 🆕 | `router.push(link)` when `link` is set. |
| "Mark all read" | Clears every dot | `api.notifications.markAllRead({})` ✅ | Until `markRead` lands, call this when the screen opens. |

| `type` | Example | `link` goes to |
| --- | --- | --- |
| `friend_posted` | "Bryan ranked Zeitgeist #1 · 9.4" | `/venue/<kind>/<id>` |
| `friend_ranked_same` | "…and you gave it 7.1" | `/venue/<kind>/<id>` |
| `event_tonight` | "Tonight: Warehouse Party · 8.8 for you" | `/venue/event/<id>` |
| `artist_event` | "Calvin Harris is coming to San Francisco · Sat Dec 5" | `/venue/event/<id>` |
| `friend_request` | "Priya wants to be friends" | `/friends` |
| `friend_accepted` | "Albert accepted your friend request" | `/user/<userId>` |
| `trip_invite` | "Bryan invited you to NYC in March" | `/trip/<tripId>` |
| `trip_update` | "Albert added Zeitgeist to Friday night" | `/trip/<tripId>` |
| `post_reaction` | "Bryan liked your ranking of Zeitgeist" | `/post/<postId>` |
| `post_comment` | "Albert: we have to go back" | `/post/<postId>` |

Pick an icon per `type`. Never build the text yourself; show `title` and `body`.

**States:** empty → "Nothing yet. Rank a place and your friends will hear about it."

## 12. Trips and groups

**Routes:** `trips.tsx`, `trip/[tripId].tsx` · **Purpose:** a named group ("Friday night", "NYC in March") and one list of places that suits everyone in it. · **Status:** 🆕

```
┌ ← Trips      [ New trip ] ┐   ┌ ← NYC in March ─────── ⋯ ┐
│ NYC in March              │   │ Mar 12–15 · New York      │
│ 4 people · Mar 12–15      │   │ (E)(B)(A) +1 invited      │
│ Friday night              │   │ [ Invite friends ]        │
│ Invited by Bryan          │   │ Picks for the group       │
│ [ Join ] [ Decline ]      │   │ 1 Le Bain  8.4 group      │
└───────────────────────────┘   │   You 9.0 · Bryan 7.8 👍 👎│
                                │ Shortlist                 │
                                │ Le Bain   👍 3  👎 0      │
                                │ [ Plan the night ]        │
                                └───────────────────────────┘
```

**Reads**
- `api.trips.list({})` → `TripSummary[]`: `name`, `city?`, `startDate?`, `endDate?` (ms), `memberCount`, `myStatus` (`owner`, `joined`, `invited`, `declined`), `ownerName`.
- `api.trips.get({tripId})` → `TripDetail | null`: the summary plus `members[]` (`displayName`, `avatarUrl`, `status`, `isOwner`, `isLocal?`), `shortlist[]` (`name`, `votesUp`, `votesDown`, `myVote?`), `lat?`, `lng?`, `vibe?`.
- `api.discover.forGroup({tripId, lat, lng})` → `GroupResult`: `items: GroupItem[]`, already ranked for the group. Each has the usual card fields; `score` is the **group** score, `memberScores[]` has each person's own score, `agreement` is 0–1 (1 = everyone feels the same). Pass the trip's `lat`, `lng` when it has them, otherwise the user's.
- `api.trips.suggestMembers({tripId})` → `TripMemberSuggestion[]`, best first, each with `reason`, `fitPct`, `isLocal`.

**"New trip" form**

| Field | Sends |
| --- | --- |
| "Name" (required) | `name` |
| "City" (optional) | `city` |
| "Dates" (optional, start and end) | `startDate`, `endDate` in ms |
| "Vibe": "Chill" / "Balanced" / "Wild" | `vibe`: `chill` / `balanced` / `wild` |
| "Who's coming" (friend picker, optional) | `memberIds` |

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| "New trip" | Opens the form | none | |
| "Create trip" | Creates it and invites the picked friends | `api.trips.create({name, city?, lat?, lng?, startDate?, endDate?, vibe?, memberIds?})` → `{tripId}` | `/trip/<tripId>` |
| "Join" / "Decline" (when `myStatus === "invited"`) | Answers the invite | `api.trips.respond({tripId, accept})` | |
| "Invite friends" | Opens a picker: "Suggested" on top from `trips.suggestMembers` (show `reason`, a "Local" mark when `isLocal`), then everyone from `friends.list` | `api.trips.invite({tripId, userIds})` → `{invited}` | Toast "Invited 2 friends". |
| 👍, label "Vote up" / 👎, label "Vote down" | Votes on a pick. Tapping the active one clears it. | `api.trips.vote({tripId, kind, id, vote})` with `1`, `-1` or `0` | The first 👍 puts the item on the shortlist. |
| a pick or shortlist row | Opens the venue | none | |
| "Plan the night" | Three stops for this group | none | `/plan?tripId=<tripId>` |
| "⋯" → "Edit trip" (owner) | Edits name, city, dates, vibe | `api.trips.update({tripId, …})` | |
| "⋯" → "Leave trip" (member) | Confirms, then leaves | `api.trips.leave({tripId})` | Back to `/trips`. |
| "⋯" → "Delete trip" (owner) | Confirms, then deletes | `api.trips.remove({tripId})` | Back to `/trips`. |

**States:** no trips → "Going somewhere with friends? Start a trip." with "New trip". Only me in the trip → picks still show (ranked for me) with "Invite friends to get picks that suit everyone". `null` → "This trip was deleted".

## 13. Plan my night

**Route:** `plan.tsx` · **Purpose:** three stops for tonight that suit me and the friends I pick. · **Status:** ✅ (`tripId` is 🆕)

```
┌ ← Plan my night ─────────────┐
│ Who's coming: (You)(Bryan ✓) │
│ (Chill)(Balanced ✓)(Wild)    │
│ Start     Trick Dog   8.6    │
│           You 9.0 · Bryan 8.2│
│ Then      El Rio      8.3    │
│ End the night  Zeitgeist 8.1 │
└──────────────────────────────┘
```

**Reads:** `api.discover.plan({lat, lng, memberIds?, vibe?})` ✅ → `PlanResult`: `stops: PlanStop[]` (up to 3; each has `slotLabel` "Start" / "Then" / "End the night", the usual card fields where `score` is the group score, `why`, and `memberScores[]`), `members[]`, `vibe`. With `?tripId=` pass `{lat, lng, tripId, vibe?}` 🆕 instead of `memberIds`.

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| friend chips under "Who's coming" | Toggles a friend (friends from `api.friends.list` 🆕) | re-runs `discover.plan` with the new `memberIds` | The stops update by themselves. |
| "Chill" / "Balanced" / "Wild" | Sets the vibe | re-runs with `vibe`: `chill` / `balanced` / `wild` | |
| a stop | Opens the venue | none | |

Only accepted friends count; others in `memberIds` are ignored. **States:** fewer than 3 stops → show what came back. No stops → "Not enough open places nearby right now."

## 14. Saved

**Route:** `saved.tsx` · **Purpose:** places I want to try and events I'm going to. · **Status:** 🆕

```
┌ ← Saved ─────────────────┐
│ ( Want to go )( Going )  │
│ Zeitgeist · Bar          │
│ Warehouse Party · Sat 9PM│
└──────────────────────────┘
```

**Reads:** `api.saves.list({type})` → `SavedItem[]`, newest first: `name`, `category`, `startsAt?`, `imageUrl?`. Tabs: "Want to go" → `type: "want"`, "Going" → `type: "going"`.

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| a row | Opens the venue | none | `/venue/<kind>/<id>` |
| swipe → "Remove" | Unsaves | `api.saves.toggle({kind, id, type})` | |

**States:** empty → "Tap Save on any place to keep it here."

## 15. Following and performer page

**Routes:** `following.tsx`, `performer/[performerId].tsx` · **Purpose:** artists I like and when they play near me. · **Status:** 🆕

```
┌ ← Following ───────────────┐   ┌ ← Calvin Harris ─────────┐
│ [ Search artists ]         │   │ (photo)  EDM · House     │
│ Calvin Harris  [Following] │   │ You rate them 9.2        │
│  Next: Sat Dec 5 · Bill G. │   │ [ Following ]            │
│ DJ Nova        [ Follow ]  │   │ Upcoming                 │
│  No dates nearby yet       │   │ Sat Dec 5 · Bill Graham  │
└────────────────────────────┘   └──────────────────────────┘
```

**Reads**
- `api.performers.following({})` → `PerformerCard[]`: people I follow or rated highly. Fields: `name`, `imageUrl?`, `genres`, `following`, `affinity?` (0–10, "You rate them 9.2"), `nextEvent?` (`title`, `startsAt`, `venueName?`).
- `api.performers.search({text})` → `PerformerCard[]` (≤10).
- `api.performers.get({performerId})` → the card plus `upcoming: {id, title, startsAt, venueName?}[]`.

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| "Follow" / "Following" | Toggles | `api.performers.follow({performerId, follow})` | Label follows `following`. |
| search box, placeholder "Search artists" | Results as the user types | `api.performers.search({text})` | |
| a performer row | Opens them | none | `/performer/<performerId>` |
| an upcoming event, or "Next: …" | Opens the event | none | `/venue/event/<id>` |

The user does not have to follow anyone: ranking an artist's show highly is enough to get the "is coming to your city" notification. **States:** empty → "Rank a show you loved, or follow an artist, and we'll tell you when they're in town."

## 16. Settings

**Route:** `settings.tsx` · **Purpose:** profile, privacy, notifications, account. · **Status:** 🆕 (sign out and the demo-location switch work today)

```
┌ ← Settings ────────────────────┐
│ (avatar)  [ Change photo ]     │
│ Display name [ Ethan        ]  │
│ Bio          [              ]  │
│ Home city    [ San Francisco]  │
│ Birthday     [ 2004-10-23   ]  │
│ [ Save ]                       │
│ Who sees my posts              │
│ (Friends)(Public)(Only me)     │
│ Show me in search and          │
│ suggestions              (on)  │
│ Notifications   six switches   │
│ Demo location            (on)  │
│ [ Change password ]            │
│ [ Sign out ]  [ Delete account ]│
└────────────────────────────────┘
```

**Reads:** `api.settings.get({})` → `SettingsResult | null`: `username`, `displayName`, `bio?`, `avatarUrl?`, `homeCity?`, `birthday?`, `defaultVisibility`, `discoverable`, `notifPrefs`.

| Label | Does | Calls | Then |
| --- | --- | --- | --- |
| "Change photo" | Picks a photo and uploads it | upload snippet with `api.settings.generateAvatarUploadUrl`, then `api.settings.setAvatar({storageId})` → `{avatarUrl}` | |
| "Save" | Saves the text fields that changed | `api.settings.update({displayName?, bio?, homeCity?, birthday?})` | Toast "Saved". `birthday` is `YYYY-MM-DD`. |
| "Friends" / "Public" / "Only me" under "Who sees my posts" | Default for new posts | `api.settings.update({defaultVisibility})` with `friends` / `public` / `private` | Saves on tap. |
| "Show me in search and suggestions" switch | | `api.settings.update({discoverable})` | Saves on tap. |
| "Friends' rankings" switch | | `api.settings.update({notifPrefs: {…all six…, friendPosts}})` | Saves on tap. |
| "Friend requests" switch | | same, `friendRequests` | |
| "Events tonight" switch | | same, `eventsTonight` | |
| "Artists I like" switch | | same, `artistAlerts` | |
| "Trips" switch | | same, `tripUpdates` | |
| "Likes and comments" switch | | same, `reactions` | |
| "Demo location" switch | Pretend to be at the demo spot | `setDemo(on)` from `useDemoLocation()` ✅ | Local only, nothing is sent. |
| "Change password" | Form: "Current password", "New password", "Update password" | `api.auth.changePassword` ✅ (ask Ethan for the exact arguments) | Toast "Password updated". |
| "Sign out" | Signs out | `useAuthActions().signOut()` from `@convex-dev/auth/react` ✅ | Back to Welcome. |
| "Delete account" | Opens a confirm sheet: "Type your username to confirm", then "Delete forever" (enabled only when the text matches `username`) | `api.settings.deleteAccount({confirmUsername})` | Sign out, back to Welcome. |

Send `notifPrefs` as the whole object with all six booleans, changing just the one that was tapped. `update` returns the fresh `SettingsResult`.

**States:** loading → skeleton. Each switch flips right away and flips back with a toast if the call fails.

---

## Build order

**Wire today (everything here is ✅ and returns real data):**
1. Sign up / Sign in, then the `users.me` check → quiz or tabs.
2. Quiz with 6 cards → `users.saveQuiz` → taste card from `tasteSummary`.
3. Map: `useNearby(filter)`, pins by `tier`, the seven filter chips, the sheet list, search, the attribution line.
4. Venue page at `venue/[kind]/[id]`: `places.get` with score, why, breakdown, friends.
5. Rank flow steps 1–5: `places.search`, `rankings.listInBucket`, the binary search, `rankings.rank` (without `visibility` and without a photo), the result screen.
6. Home: `discover.tonight` and the bell with `notifications.unreadCount`.
7. Notifications: `list`, `markAllRead`.
8. Plan my night: `discover.plan` with the vibe chips.

**Then, as each 🆕 group lands on `main`** (Ethan will say when; `git pull` and the types appear):
9. Feed (`posts.feed`, `react`, comments), then the photo step and "Who sees it" in the rank flow.
10. Quick questions after a ranking (`insights.questionsFor`, `insights.submit`) and the insight chips on the venue page.
11. Friends screen, friend profile, compare.
12. Profile lists (`profile.get`, `rankings.mine`), Settings.
13. Save / I'm going, the Saved screen, "Coming up for you" on Home.
14. Trips, group picks, "Plan the night" for a trip.
15. Performers: "Follow" on event pages, Following, performer page.

Write the 🆕 screens against the types in `convex/lib/contract.ts` now. The modules already exist as placeholders, so the import of `api` works; the specific function appears in the types the moment its backend lands.

If a screen needs a field that is not in the contract, ask Ethan to add it as an optional field. Do not compute it in the UI.
