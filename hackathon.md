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
- **Last updated:** 2026-11-15T20:14:24Z

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
