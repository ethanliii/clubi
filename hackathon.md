# Hackathon log

- **Project:** clubi
- **What it does:** Mobile app where people sign in with a username and password and post moments to their own feed.
- **Live app:** not deployed
- **Repo:** private
- **Frontend:** not deployed
- **Convex deployment:** https://flexible-hornet-782.convex.cloud
- **Components:** @convex-dev/auth (auth, password, username)
- **Convex features:** schema, tables, indexes, queries, mutations, realtime queries
- **Auth:** Convex Auth
- **AI models:** none
- **Started:** 2026-11-15T17:53:13Z
- **Last updated:** 2026-11-15T18:28:58Z

## Log

### 2026-11-15 - 785a421
Created the clubi repository with a README. No app code or Convex functions
yet (`README.md`).

### 2026-11-15 - working tree
Scaffolded the Expo app and added username and password sign-up and sign-in with
Convex Auth v2, with sessions kept in expo-secure-store. Signed-in users can add
moments and see their own list, newest first, from the `by_author` index. Pushed
to a Convex preview deployment. Convex features: schema, indexes, query,
mutation, realtime queries, Convex Auth components (`convex/schema.ts`,
`convex/moments.ts`, `convex/auth.ts`, `convex/convex.config.ts`, `App.tsx`).
