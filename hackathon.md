# Hackathon log

- **Project:** clubi
- **What it does:** Mobile app that ranks places and events near you for your taste, with a one-line reason for every score.
- **Live app:** not deployed
- **Repo:** private
- **Frontend:** not deployed
- **Convex deployment:** https://famous-lion-37.convex.cloud
- **Components:** @convex-dev/auth (auth, password, username)
- **Convex features:** schema, tables, indexes, full-text search, queries, mutations, realtime queries
- **Auth:** Convex Auth
- **AI models:** none
- **Started:** 2026-11-15T17:53:13Z
- **Last updated:** 2026-11-15T20:24:07Z

## Log

### 2026-11-15 - 785a421
Created the clubi repository with a README. No app code or Convex functions
yet (`README.md`).

### 2026-11-15 - 2824d41
Scaffolded the Expo app and added username and password sign-up and sign-in with
Convex Auth v2, with sessions kept in expo-secure-store. Signed-in users can add
moments and see their own list, newest first, from the `by_author` index. Pushed
to the Convex dev deployment. Convex features: schema, indexes, query,
mutation, realtime queries, Convex Auth components (`convex/schema.ts`,
`convex/moments.ts`, `convex/auth.ts`, `convex/convex.config.ts`, `App.tsx`).

### 2026-11-15 - c03cf03
Added the team docs and the shared API contract types, and split the schema into
per-owner table files with the places, events, rankings, comparisons,
notifications, posts and friendships tables. Seeded 33 demo places with hand-set
13-feature vectors and shipped the first discovery queries: nearby and tonight
lists scored by taste-to-venue cosine with a reason on every item, venue detail
with a score breakdown, and name search. Two client hooks read the device
location and the nearby list. Pushed to the Convex dev deployment. Convex
features: schema, indexes, full-text search, queries, mutations, realtime queries
(`convex/tables/`, `convex/lib/recs.ts`, `convex/discover.ts`,
`convex/places.ts`, `convex/seedPlaces.ts`, `src/lib/useNearby.ts`).

### 2026-11-15 - 8bc543a
Sign-up now takes an optional display name, birthday and home city next to the
username and password, and stores them on the user with the username. Added the
signed-in profile query and the taste quiz mutation, which saves the answers,
sets the user's taste vector and prior from them, and returns four taste meters.
Ranking and notification functions exist as stubs with the contract shapes so
screens can wire up. Pushed to the Convex dev deployment. Convex features:
queries, mutations, Convex Auth components (`convex/auth.ts`, `convex/users.ts`,
`convex/rankings.ts`, `convex/notifications.ts`).

### 2026-11-15 - 2a19940
Moved discovery to the hybrid-v2 score. Each place now blends the taste match
with ratings from people with similar taste, weighting locals and accepted
friends higher, and shows the viewer's own score when they ranked it. The reason
line names a friend or locals when their ratings carry the score, and adds
"Open now" or the event start. Lists hide closed places, past events and, for
viewers under 21, nightlife; the top five pins skip near-duplicates. The taste
match is measured from a no-signal baseline so scores spread out instead of all
landing near 9. Venue detail returns friends' rankings with captions and the
viewer's own position. Added four tests for the pure scoring functions, run with
Node's built-in runner. Convex features: queries, indexes, file storage URLs
(`convex/lib/discovery.ts`, `convex/lib/hours.ts`, `convex/lib/recs.ts`,
`convex/discover.ts`, `convex/places.ts`, `tests/recs.test.mjs`).

### 2026-11-15 - f244f0f
Ranking a place or event now works end to end on the backend. The rank mutation
inserts the item at the position the client's binary search chose, shifts the
rest of the bucket, recomputes every score in the bucket, saves each pairwise
comparison with its day and hour, and creates the friends-only post. Ranking
something again replaces the old ranking and updates its post. A query lists a
bucket best first, and the result carries a label such as "#1 of your bars ·
9.2". Pushed to the Convex dev deployment. Convex features: queries, mutations,
indexes (`convex/rankings.ts`).

### 2026-11-15 - 6fc2d6b
Made the nearby scan hold up with the full imported catalog: the lat index is
read outward from the viewer in both directions, so a dense area loses only its
far edge when the scan limit is hit. Added a debug query that returns every term
behind one item's score and map position (content, crowd, lambda, Elo, distance
penalty, time match, per-feature contributions and the weights) so the math can
be shown live. Convex features: queries, indexes (`convex/lib/discovery.ts`,
`convex/debug.ts`).

### 2026-11-15 - ebb985c
Added live learning (hybrid-v3). One helper applies a comparison: a logistic step
on the user's taste vector toward the winner's features and an Elo step on both
places. A second applies the bucket alone: loved pulls taste toward the place,
didn't like pushes it away. The taste step now measures surprise on the
similarity gap, because the raw dot product saturated and learned nothing when
the winner simply had more strong features. Both helpers run inside the ranking
mutation, so nearby lists re-sort through realtime queries with no training job.
Convex features: mutations, realtime queries (`convex/scoring.ts`,
`convex/lib/recs.ts`, `tests/recs.test.mjs`).
