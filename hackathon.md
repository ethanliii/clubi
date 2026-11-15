# Hackathon log

- **Project:** clubi
- **What it does:** Mobile app that ranks places and events near you for your taste, with a one-line reason for every score.
- **Live app:** not deployed
- **Repo:** private
- **Frontend:** not deployed
- **Convex deployment:** https://famous-lion-37.convex.cloud
- **Components:** @convex-dev/auth (auth, password, username)
- **Convex features:** schema, tables, indexes, full-text search, queries, mutations, actions, scheduled functions, crons, realtime queries
- **Auth:** Convex Auth
- **AI models:** none
- **Started:** 2026-11-15T17:53:13Z
- **Last updated:** 2026-11-15T20:35:49Z

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

### 2026-11-15 - 57a474f
Added the catalog ingest. An internal upsert mutation writes places and events
by source and source id, drops unnamed rows and past events, and skips a row
with the same name within 50 m (or the same title starting within an hour)
without ever touching hand-seeded rows. A keyword featurizer turns category,
tags and text into the 13-feature venue vector. An OpenStreetMap import action
pulls named bars, restaurants, cafes, museums, theatres and parks around a point
from Overpass, and a public ensureArea mutation snaps a location to a grid cell
and schedules that import the first time anyone opens the map there. Ran it on
the dev deployment for the demo area: 1,374 OpenStreetMap places beside the 33
seeded ones, none duplicated. Map data (c) OpenStreetMap contributors. Convex
features: mutations, queries, actions, scheduled functions, indexes
(`convex/ingest.ts`, `convex/imports/osm.ts`).

### 2026-11-15 - 367b91d
The nearby hook now asks the backend to import places around the viewer the
first time it is used in an area, once per grid cell, so the map fills in
anywhere and not only around the seed data. A failed request leaves the list as
it is. Checked on the dev deployment: an area with no places returned 60 ranked
results about 20 seconds after the request (`src/lib/useNearby.ts`).

### 2026-11-15 - 107b415
Added the Luma import. An action pages the public discover list that luma.com/sf
itself calls, one request a second, and keeps public in-person events inside San
Francisco that start within 7 days. Events whose host shares the exact address
only with guests keep Luma's approximate pin and no address, and host or guest
data is never stored. Each event is featurized from its title and upserted
through the ingest mutation, which writes nothing while the ingest is frozen.
Ran it on the dev deployment: 41 events, and a second run changed nothing.
Convex features: actions, mutations (`convex/imports/luma.ts`).

### 2026-11-15 - 065c54f
Added the cron schedule: the Luma import now runs every 30 minutes and stops by
itself while the ingest freeze flag in appConfig is set, so no outside calls
happen during the demo after the data freeze. Convex features: crons
(`convex/crons.ts`).

### 2026-11-15 - 4c61fc5
In-app notifications are live. Ranking a place now notifies each accepted
friend, and a friend who already ranked the same place gets a note with their
own score. The notification list, unread count and mark-all-read functions
replace their stubs, and a helper lets other mutations create notifications. A
30 minute cron finds events starting in the next six hours that score 8.5 or
higher for a user, with the same scoring the venue page uses, and notifies them
at most three times a day. An internal mutation removes test accounts and their
rows in scheduled batches and can reset place and event Elo. Pushed to the
Convex dev deployment. Convex features: queries, mutations, indexes, crons,
scheduled functions (`convex/notifications.ts`, `convex/notificationsCron.ts`,
`convex/crons.ts`, `convex/rankings.ts`, `convex/users.ts`,
`convex/tables/people.ts`).
