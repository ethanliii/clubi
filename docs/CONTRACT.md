# clubi API contract (backend ↔ UI)

The single list of what the app can ask the backend. Screens call these with `useQuery` / `useMutation` / `usePaginatedQuery` from `convex/react` and get full TypeScript types from `convex/_generated/api`.

**Types live in one place: [`convex/lib/contract.ts`](../convex/lib/contract.ts).** This file lists the functions. If the two ever disagree, `contract.ts` wins.

## Rules

1. **Screens only render what the backend returns.** No screen computes a score, rank, tier, pin size, "why" line, match %, or suggestion order.
2. **The shape is frozen, the math is not.** Owners may change how a value is computed at any time. A shape may only grow: new fields are optional; a field is never renamed or removed.
3. **Every score comes with a non-empty `why`.** Every suggestion comes with a non-empty `reason`.
4. `useQuery` returns `undefined` while loading: show a skeleton, not an error.
5. Signed-out calls: queries return `null` or an empty list; mutations throw `"Not signed in"`.
6. Need a field that isn't here? Ask the owner to add it as optional. Don't work around it in the UI.
7. Mutations throw `Error` with a short sentence a user can read. Show `error.message` in a toast.

**Status:** ✅ live on `main` · 🆕 being built now (the module exists as a placeholder; calling it before it lands fails).

**Owners** (see [`SESSIONS.md`](SESSIONS.md)): **Brain** = scoring, discovery, insights, groups. **People** = accounts, rankings, social, trips, settings. **Data** = imports, catalog, performers.

**Link formats** used in `NotificationItem.link` and for navigation: `/venue/<kind>/<id>` (`kind` = `place` or `event`), `/user/<userId>`, `/post/<postId>`, `/trip/<tripId>`, `/friends`, `/performer/<performerId>`.

## Discovery, map and venue (Brain)

| Function | Kind | Args → Returns | |
| --- | --- | --- | --- |
| `api.discover.nearby` | query | `{lat, lng, radiusMeters?=2500, filter?="all", limit?=60}` → `NearbyResult` | ✅ |
| `api.discover.tonight` | query | `{lat, lng}` → `{topPicks, friendsGoing, events}`, each `NearbyItem[]` | ✅ |
| `api.discover.plan` | query | `{lat, lng, memberIds?, vibe?, tripId?}` → `PlanResult` (≤3 stops, each with every member's score). `vibe`: `chill` \| `balanced` \| `wild` | ✅ (`tripId` 🆕) |
| `api.discover.upcoming` | query | `{lat, lng, days?=14, limit?=30}` → `NearbyItem[]`: events in the next days, best for me first; artists I like push an event up | 🆕 |
| `api.discover.similar` | query | `{kind, id, lat, lng, limit?=8}` → `NearbyItem[]` ("more like this") | 🆕 |
| `api.discover.forGroup` | query | `{lat, lng, memberIds?, tripId?, filter?="all", limit?=30}` → `GroupResult`: one list ranked for the whole group, with each member's score and an agreement value | 🆕 |
| `api.places.get` | query | `{kind, id}` → `VenueDetail \| null` | ✅ |
| `api.places.search` | query | `{text, lat, lng}` → `NearbyItem[]` (≤10) | ✅ |
| `api.debug.explain` | query | `{kind, id, lat, lng}` → every term behind one score (for the demo and the test page) | ✅ |
| `src/lib/useNearby.ts` | hook | `useNearby(filter)` → `NearbyResult \| undefined` (also asks the backend to import places for a new area) | ✅ |
| `src/lib/demoLocation.ts` | hook | `useDemoLocation()` → `{lat, lng, isDemo, setDemo, ready}` | ✅ |

`Filter` = `tonight` \| `bars` \| `food` \| `events` \| `popups` \| `outdoors` \| `all`. `tier`: `top` = top 5 (big ringed pin), `good` = labeled pin, `other` = dot.

## Venue insights: the questions after a ranking (Brain)

After `rankings.rank` succeeds, the app asks 3–4 quick multiple-choice questions about the visit. Answers are stored per person, but only totals ever leave the backend.

| Function | Kind | Args → Returns | |
| --- | --- | --- | --- |
| `api.insights.questionsFor` | query | `{kind, id}` → `InsightQuestion[]` (3–4, picked for this category and for what we know least about this venue) | 🆕 |
| `api.insights.submit` | mutation | `{kind, id, rankingId?, answers: InsightAnswer[]}` → `{saved: number, highlights: string[]}`. Skipped questions are simply left out. Calling again replaces my earlier answers for that venue. | 🆕 |
| `api.insights.venue` | query | `{kind, id}` → `VenueInsights` (totals per question, highlights, "best for") | 🆕 |
| `api.insights.dashboard` | query | `{kind, id}` → `VenueDashboard` (audience taste, locals share, visits by hour and day, head-to-head win rate, "also loved", weekly trend) | 🆕 |

## Accounts, quiz and settings (People)

| Function | Kind | Args → Returns | |
| --- | --- | --- | --- |
| `api.auth.signUpWithUsernamePassword`, `signInWithUsernamePassword`, `signOut`, `changePassword` | Convex Auth | see `App.tsx` for the working calls | ✅ |
| `api.users.me` | query | `{}` → `{userId, username, displayName, avatarUrl?, homeCity?, onboarded, tasteSummary: {label, pct}[]} \| null` | ✅ |
| `api.users.saveQuiz` | mutation | `{answers: number[][]}` → `{tasteSummary}` | ✅ |
| `api.settings.get` | query | `{}` → `SettingsResult \| null` | 🆕 |
| `api.settings.update` | mutation | `{displayName?, bio?, homeCity?, birthday?, defaultVisibility?, discoverable?, notifPrefs?}` → `SettingsResult` (only the fields you pass change) | 🆕 |
| `api.settings.generateAvatarUploadUrl` | mutation | `{}` → `string` (POST the image to it, get `{storageId}`) | 🆕 |
| `api.settings.setAvatar` | mutation | `{storageId}` → `{avatarUrl}` | 🆕 |
| `api.settings.deleteAccount` | mutation | `{confirmUsername}` → `null` (removes my rankings, posts, friendships, answers) | 🆕 |

## Ranking (People)

| Function | Kind | Args → Returns | |
| --- | --- | --- | --- |
| `api.rankings.listInBucket` | query | `{category, bucket}` → `{id, kind, name, score, position}[]`, best first. The rank flow binary-searches this list. | ✅ |
| `api.rankings.rank` | mutation | `{kind, id, bucket, position, comparisons: {winnerId, loserId}[], tags, caption?, photoStorageId?, visibility?, groupSize?}` → `RankResult`. Also creates the post, teaches the taste model, and notifies friends. | ✅ (`visibility`, `groupSize` 🆕) |
| `api.rankings.mine` | query | `{category?}` → `RankedListItem[]`, best first | 🆕 |
| `api.rankings.remove` | mutation | `{rankingId}` → `null` (also removes its post) | 🆕 |

## Feed, photos, reactions, comments (People)

| Function | Kind | Args → Returns | |
| --- | --- | --- | --- |
| `api.posts.feed` | paginated query | `{paginationOpts}` → page of `FeedItem`, newest first: my friends' posts and mine. Use `usePaginatedQuery(api.posts.feed, {}, {initialNumItems: 15})` and `loadMore(15)` on scroll end. | 🆕 |
| `api.posts.friendsFeed` | query | `{}` → `FeedItem[]` (newest 30; same data without paging) | 🆕 |
| `api.posts.byUser` | paginated query | `{userId, paginationOpts}` → page of `FeedItem` (only what I'm allowed to see) | 🆕 |
| `api.posts.get` | query | `{postId}` → `FeedItem \| null` | 🆕 |
| `api.posts.generateUploadUrl` | mutation | `{}` → `string` | 🆕 |
| `api.posts.attachPhoto` | mutation | `{postId, storageId}` → `{photoUrls}` (max 4 photos; only my post) | 🆕 |
| `api.posts.update` | mutation | `{postId, caption?, visibility?}` → `null` | 🆕 |
| `api.posts.remove` | mutation | `{postId}` → `null` (the ranking stays) | 🆕 |
| `api.posts.react` | mutation | `{postId, emoji?="❤️"}` → `{reactionCount, myReaction?}`. Same emoji again removes it. | 🆕 |
| `api.posts.comments` | query | `{postId}` → `CommentItem[]`, oldest first | 🆕 |
| `api.posts.addComment` | mutation | `{postId, text}` → `CommentItem` | 🆕 |
| `api.posts.removeComment` | mutation | `{commentId}` → `null` | 🆕 |

**Photo after a rating:** `generateUploadUrl()` → `fetch(url, {method: "POST", headers: {"Content-Type": file.type}, body: file})` → read `{storageId}` from the JSON → pass it to `rankings.rank` as `photoStorageId`, or to `posts.attachPhoto` afterwards.

## Friends (People)

| Function | Kind | Args → Returns | |
| --- | --- | --- | --- |
| `api.friends.list` | query | `{}` → `FriendsOverview` (`friends`, `incoming`, `outgoing`) | 🆕 |
| `api.friends.search` | query | `{text}` → `UserSearchResult[]` (≤20, by username or display name; each has my `status` with them) | 🆕 |
| `api.friends.suggestions` | query | `{limit?=10}` → `FriendSuggestion[]`, best first, each with a `reason` | 🆕 |
| `api.friends.request` | mutation | `{username?, userId?}` → `{requestId, status}`. If they already asked me, this accepts. | 🆕 |
| `api.friends.respond` | mutation | `{requestId, accept}` → `null` | 🆕 |
| `api.friends.cancel` | mutation | `{requestId}` → `null` (take back my request) | 🆕 |
| `api.friends.remove` | mutation | `{userId}` → `null` | 🆕 |
| `api.profile.get` | query | `{userId?}` → `ProfileResult \| null` (mine when `userId` is left out) | 🆕 |
| `api.profile.compare` | query | `{userId}` → `CompareResult \| null` | 🆕 |

## Trips and groups (People for the trip itself, Brain for what the group should do)

A trip is any named group: "Friday night", "NYC in March".

| Function | Kind | Args → Returns | |
| --- | --- | --- | --- |
| `api.trips.create` | mutation | `{name, city?, lat?, lng?, startDate?, endDate?, vibe?, memberIds?}` → `{tripId}` | 🆕 |
| `api.trips.list` | query | `{}` → `TripSummary[]` (mine and ones I'm invited to) | 🆕 |
| `api.trips.get` | query | `{tripId}` → `TripDetail \| null` | 🆕 |
| `api.trips.update` | mutation | `{tripId, name?, city?, lat?, lng?, startDate?, endDate?, vibe?}` → `null` (owner only) | 🆕 |
| `api.trips.invite` | mutation | `{tripId, userIds}` → `{invited: number}` (friends only) | 🆕 |
| `api.trips.respond` | mutation | `{tripId, accept}` → `null` | 🆕 |
| `api.trips.leave` | mutation | `{tripId}` → `null` | 🆕 |
| `api.trips.remove` | mutation | `{tripId}` → `null` (owner only) | 🆕 |
| `api.trips.vote` | mutation | `{tripId, kind, id, vote}` → `TripShortlistItem`. `vote`: `1`, `-1`, or `0` to clear. The first `1` puts the item on the shortlist. | 🆕 |
| `api.trips.suggestMembers` | query | `{tripId}` → `TripMemberSuggestion[]`: which friends to add, best first (locals of the trip's city and friends whose taste fits the group come first) | 🆕 |
| `api.discover.forGroup` | query | pass `tripId` → the ranked list for that trip's joined members around the trip's location | 🆕 |
| `api.discover.plan` | query | pass `tripId` → three stops for that trip | 🆕 |

## Saved places, going to events (People)

| Function | Kind | Args → Returns | |
| --- | --- | --- | --- |
| `api.saves.toggle` | mutation | `{kind, id, type}` → `{saved: boolean}`. `type`: `want` \| `going` | 🆕 |
| `api.saves.list` | query | `{type?}` → `SavedItem[]`, newest first | 🆕 |

## Notifications (People)

| Function | Kind | Args → Returns | |
| --- | --- | --- | --- |
| `api.notifications.list` | query | `{}` → `NotificationItem[]` (newest 50) | ✅ |
| `api.notifications.unreadCount` | query | `{}` → `number` (capped at 99) | ✅ |
| `api.notifications.markAllRead` | mutation | `{}` → `null` | ✅ |
| `api.notifications.markRead` | mutation | `{id}` → `null` | 🆕 |

Types and what the user sees: `friend_posted` ("Bryan ranked Zeitgeist #1 · 9.4"), `friend_ranked_same` ("…and you gave it 7.1"), `event_tonight` ("Tonight: X · 8.8 for you"), `friend_request`, `friend_accepted`, `artist_event` ("Calvin Harris is coming to San Francisco · Sat Dec 5"), `trip_invite`, `trip_update`, `post_reaction`, `post_comment`. Each has a `link` to open on tap. A user's `notifPrefs` turn groups of these off.

## Performers: artists, DJs, teams, hosts (Data)

| Function | Kind | Args → Returns | |
| --- | --- | --- | --- |
| `api.performers.search` | query | `{text}` → `PerformerCard[]` (≤10) | 🆕 |
| `api.performers.get` | query | `{performerId}` → `(PerformerCard & {upcoming: {id, title, startsAt, venueName?}[]}) \| null` | 🆕 |
| `api.performers.forEvent` | query | `{eventId}` → `PerformerCard[]` | 🆕 |
| `api.performers.following` | query | `{}` → `PerformerCard[]`: people I follow or rated highly, with their next event | 🆕 |
| `api.performers.follow` | mutation | `{performerId, follow}` → `null` | 🆕 |
| `api.ingest.ensureArea` | mutation | `{lat, lng}` → `{status}`: import places around a point the first time anyone looks there | ✅ |

## Backend-only helpers other sessions call

| Helper | In | Used by |
| --- | --- | --- |
| `notify(ctx, {userId, type, title, body, link?, actorId?})` | `convex/notifications.ts` (People) | everyone; it checks the receiver's `notifPrefs` |
| `applyComparison(ctx, userId, winnerId, loserId)`, `applyBucket(ctx, userId, id, bucket)` | `convex/scoring.ts` (Brain) | `rankings.rank` |
| `recordPerformerAffinity(ctx, {userId, eventId, score})` | `convex/performers.ts` (Data) | `rankings.rank`, when the target is an event |
| `notifyPerformerFans(ctx, eventId)` | `convex/performers.ts` (Data) | the ingest, when a new event is stored |
| `similarity(a, b)`, `matchPct(score)`, `FEATURES` | `convex/lib/recs.ts` (Brain) | anyone comparing two taste vectors |
| `friendIdsOf(ctx, userId)`, `displayNameOf(user)`, `avatarUrlOf(user)` | `convex/lib/discovery.ts` (Brain) | everyone |
