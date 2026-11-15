# Session brief: People

**You own everything a user does with other people:** ranking a place, the friend feed, photos, friends and friend suggestions, profiles, settings, trips with friends, notifications, and the demo accounts that make the app look alive.

Read first: [`../SESSIONS.md`](../SESSIONS.md) (rules, file ownership), [`../CONTRACT.md`](../CONTRACT.md) (every function you build is listed there with its exact shape), [`../ALGORITHM.md`](../ALGORITHM.md) §5 (trip member suggestions), §6 (friend suggestions), §7 (feed order), `convex/lib/contract.ts`. Then read the code you inherit: `convex/rankings.ts`, `convex/users.ts`, `convex/notifications.ts`, `convex/notificationsCron.ts`, `convex/auth.ts`, `convex/tables/people.ts`, `social.ts`, `trips.ts`, and `convex/lib/discovery.ts` for the shared helpers (`friendIdsOf`, `displayNameOf`, `avatarUrlOf`, `userLoader`).

**Why this matters:** the two things that must never break in the demo are the ranking flow and the friend feed ("a friend's post shows up within a second, with no refresh"). Bryan is building the screens right now against `docs/CONTRACT.md`, so the shapes you return must match `contract.ts` exactly.

**Your files:** `convex/tables/people.ts`, `tables/social.ts`, `tables/trips.ts`, `convex/auth.ts`, `users.ts`, `rankings.ts`, `notifications.ts`, `notificationsCron.ts`, `posts.ts`, `friends.ts`, `profile.ts`, `settings.ts`, `trips.ts`, `saves.ts`, `seedSocial.ts`, `moments.ts`, `convex/lib/social.ts`, `tests/people.*.test.mjs`.

Do the tasks in order. Commit after each. `npx tsc --noEmit` and `npm test` green every time.

## P1. Finish the ranking mutation (`rankings.ts`, `notifications.ts`) — must have

1. **Live learning was connected an hour ago** (`applyComparison` per comparison, then `applyBucket`, inside `rankings.rank`). Read it, make sure a re-rank of the same place doesn't teach the model twice from comparisons it already saw, and leave it in place.
2. When the target is an event, call `recordPerformerAffinity(ctx, {userId, eventId, score})` from `convex/performers.ts` (a placeholder today; the Data session fills it in).
3. New optional args: `visibility` (default: the user's `defaultVisibility`, else `friends`) saved on the post, and `groupSize` saved on the ranking. A `private` post notifies nobody.
4. `rankings.mine({category?})` → `RankedListItem[]`, best first (`position` is the overall position in the category, across buckets).
5. `rankings.remove({rankingId})`: mine only; deletes the ranking and its post, then closes the gap (re-number and re-score the bucket with the same formula `rank` uses; share that code, don't copy it).
6. `notify` checks the receiver's `notifPrefs` (a missing pref means on) and never notifies a user about their own action. Map: `friend_posted`, `friend_ranked_same` → `friendPosts`; `friend_request`, `friend_accepted` → `friendRequests`; `event_tonight` → `eventsTonight`; `artist_event` → `artistAlerts`; `trip_invite`, `trip_update` → `tripUpdates`; `post_reaction`, `post_comment` → `reactions`. Add `notifications.markRead({id})`.

## P2. Friends (`friends.ts`, `lib/social.ts`) — must have

Friendship rows: `userA` asked `userB`; `status` is `pending`, `accepted` or `declined`. One row per pair, whichever direction came first.

- `list()` → `FriendsOverview`. Friends carry `tasteMatchPct` (from `similarity` in `convex/lib/recs.ts`) and `rankedCount`.
- `search({text})` → `UserSearchResult[]`: exact username prefix (index `by_username`) plus display-name search (search index `search_displayName`), 20 at most, never me, never users with `discoverable === false` unless we're already friends. Each row has my `status` with them and the `requestId` when there is a pending one.
- `request({username?, userId?})` → `{requestId, status}`. Rules: not myself; if they already asked me, accept it; if we're already friends or I already asked, return the existing row; a previously declined pair may ask again. Notifies `friend_request`.
- `respond({requestId, accept})` (only the person who was asked; notifies `friend_accepted`), `cancel({requestId})` (only the asker), `remove({userId})`.
- `suggestions({limit?})` → `FriendSuggestion[]`. The scoring is ALGORITHM.md §6 and lives in `lib/social.ts` as pure functions (`adamicAdar`, `suggestionScore`, `suggestionReason`) with tests in `tests/people.social.test.mjs`. Candidates: friends of my friends (cap the walk: 50 friends × 50 each), and when that gives fewer than `limit`, the best taste matches from my home city (bounded scan). Every suggestion has a non-empty `reason`.

## P3. Feed, photos, reactions, comments (`posts.ts`) — must have

- One helper builds a `FeedItem` from a post row (author, target name and category, score and `position` from the ranking, `label` like "#2 of their bars · 8.9", `photoUrls` via `ctx.storage.getUrl`, `tags`, `myScoreForIt`, `reactionCount`, `myReaction`, `commentCount`, `visibility`, `rankingId`). Leave `insightChips` unset with the comment `INTEGRATION: insightChips from convex/lib/insights.ts answerChips()`.
- **Who can see a post:** the author always; `public` anyone signed in; `friends` (and unset) accepted friends only; `private` nobody else. Put this in one function and use it everywhere, including `byUser`, `get`, `comments`, `react`.
- `feed({paginationOpts})`: my friends' posts and mine, newest first, true pagination (`paginationOptsValidator`). With up to about 50 friends, the simplest correct way is: page through `posts` by creation time and filter to authors in my friend set, or merge per-author index reads; pick one, keep it bounded, and explain the choice in a comment. See ALGORITHM.md §7 for why plain newest-first is right today.
- `friendsFeed()` (newest 30), `byUser({userId, paginationOpts})`, `get({postId})`.
- `generateUploadUrl()`, `attachPhoto({postId, storageId})` (my post, 4 photos at most), `update({postId, caption?, visibility?})`, `remove({postId})` (also its reactions and comments).
- `react({postId, emoji?})` toggles; notifies the author (`post_reaction`) the first time only. `comments({postId})`, `addComment({postId, text})` (trimmed, 1–500 characters; notifies the author with `post_comment`), `removeComment({commentId})` (the commenter or the post's author).

## P4. Profile and settings (`profile.ts`, `settings.ts`, `users.ts`) — must have

- `profile.get({userId?})` → `ProfileResult`. Mine: everything. Someone else: `canSee` is true for friends (or when their `defaultVisibility` is `public`); otherwise return the header, counts and `status` only, with empty lists. `lists` groups rankings by category with the same nouns `rankings.ts` uses.
- `profile.compare({userId})` → `CompareResult` (friends only): taste match, the same four meters `users.me` returns for both people, places both ranked with both scores, `agreePct`, their best places I haven't ranked, and a one-line `summary` ("You two agree on bars, split on food").
- `settings.get()`, `settings.update(...)` (validate: display name 1–40 characters, bio ≤ 160, birthday `YYYY-MM-DD`), `generateAvatarUploadUrl()`, `setAvatar({storageId})` (save `avatarStorageId` and put the storage URL in `avatar`, which is what `avatarUrlOf` reads), `deleteAccount({confirmUsername})` (reuse the batch-delete approach of `users.purgeTestUsers`; also remove friendships, saves, trip memberships, reactions, comments and `visitAnswers`).
- `users.me`: also return `bio` and `unreadCount` if cheap (optional fields; add them to the contract type as optional).

## P5. Trips and groups (`trips.ts`) — must have

A trip is any named group ("Friday night", "NYC in March"). The owner is a member without a `tripMembers` row.

- `create`, `list`, `get`, `update`, `invite` (accepted friends only; notifies `trip_invite`), `respond`, `leave`, `remove` (owner; also members and votes).
- `vote({tripId, kind, id, vote})`: joined members and the owner only; `0` clears; returns the item's `TripShortlistItem`. `get` returns the shortlist: every item with at least one `+1`, most net votes first.
- `suggestMembers({tripId})` → `TripMemberSuggestion[]`: my friends who aren't in the trip yet, scored by ALGORITHM.md §5 (taste fit with the current members' average taste, a bonus for friends whose home city is the trip's city, mutual friends already in the trip). Pure scoring in `lib/social.ts`, tested. Every row has a `reason` ("Lives in New York · 84% match with the group").
- A member joining or a new shortlist item notifies the others with `trip_update`, at most one notification per trip per receiver per hour.

## P6. Saves (`saves.ts`)

`toggle({kind, id, type})` → `{saved}` and `list({type?})` → `SavedItem[]`. Marking `going` on an event is public to friends by design (it powers "friends going" on the home screen); `want` is private.

## P7. Demo data (`seedSocial.ts`)

An `internalMutation` `run({forUsername?})`, safe to run twice, that makes the app look lived-in:

- 8 demo users (usernames starting `demo_`, so `users.purgeTestUsers` style cleanup can find them) with distinct, hand-set taste vectors and priors (a techno night owl, a cocktail-and-jazz local, a food-first planner, an outdoorsy museum-goer, …), display names, home cities (5 in San Francisco, 3 elsewhere), short bios.
- For each, 8–15 rankings over the hand-seeded places (`source: "seed"`, read them from the `places` table by the `by_source` index) that are consistent with their taste (score places by `contentScore(taste, venueVector)`, bucket by score, keep positions and scores valid with the same code `rank` uses), comparisons, and a friends-only post per ranking with captions, spread over the last 10 days.
- Friendships among them, and when `forUsername` is given: accepted friendships between that user and 4 of them, 2 incoming requests, and one trip ("Saturday in the Mission") with 3 members and a few votes.
- A matching `clear()` that removes everything the seed created.

## P8. If there is time

- `notificationsCron`: a weekly "Your week" digest is not needed; instead make `eventTonight` skip users with `eventsTonight` off and respect the per-day cap it already has.
- `posts.feed`: the light re-ordering from ALGORITHM.md §7 inside each page.
- Block list: `friends.block({userId})` hides a user from search, suggestions and feed.

## Final report

List: every function built or changed with its final args and return type; test names and results; any optional field you added to `contract.ts`; each `INTEGRATION:` note; cron lines you need; anything skipped.
