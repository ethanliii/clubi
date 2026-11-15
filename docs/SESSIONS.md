# Three backend sessions: who owns what and how they stay out of each other's way

Ethan's backend is built by **three Claude Code sessions working at the same time**, each on its own branch. This file is the shared rulebook. Each session also has its own brief:

| Session | Brief | Branch | In one line |
| --- | --- | --- | --- |
| **Brain** | [`sessions/brain.md`](sessions/brain.md) | `session/brain` | Scoring, discovery, venue insights (the questions after a rating), group and trip picks |
| **People** | [`sessions/people.md`](sessions/people.md) | `session/people` | Rankings, friends, feed, photos, profile, settings, trips, notifications, demo data |
| **Data** | [`sessions/data.md`](sessions/data.md) | `session/data` | Eventbrite, Partiful, Ticketmaster, Google/OSM enrichment, performers, artist alerts, crons |

**Kickoff line for a session:** `Read docs/SESSIONS.md, docs/CONTRACT.md and docs/sessions/<name>.md completely, then do the tasks in order.`

Read before you write code: this file, [`CONTRACT.md`](CONTRACT.md), [`ALGORITHM.md`](ALGORITHM.md) (the sections your brief names), and `convex/lib/contract.ts`.

## 1. What already exists (on `main`)

A working Convex backend: sign-up and sign-in (Convex Auth, username + password), the taste quiz, Beli-style ranking (`rankings.rank`), hybrid-v3 scoring with live learning helpers, `discover.nearby` / `tonight` / `plan`, `places.get` / `search`, `debug.explain`, in-app notifications with a cron, and the catalog: 33 hand-seeded places, about 1,400 OpenStreetMap places, a Luma import on a 30-minute cron. `hackathon.md` has the history.

The foundation for this round is also on `main`: new tables (`convex/tables/insights.ts`, `trips.ts`, `entities.ts`, plus new optional fields), every new type in `convex/lib/contract.ts`, and a **placeholder file for every new module**, already registered in `convex/_generated/api.d.ts`. Your job is to replace your placeholders with real code.

## 2. One owner per file

Edit only your own files. Reading anything is fine. Writing rows into another owner's table from your own function is fine. Editing another owner's file is not.

| | **Brain** | **People** | **Data** |
| --- | --- | --- | --- |
| Tables | `convex/tables/insights.ts` | `convex/tables/people.ts`, `social.ts`, `trips.ts` | `convex/tables/catalog.ts`, `entities.ts` |
| Functions | `convex/discover.ts`, `places.ts`, `scoring.ts`, `debug.ts`, `insights.ts`, `seedPlaces.ts` | `convex/auth.ts`, `users.ts`, `rankings.ts`, `notifications.ts`, `notificationsCron.ts`, `posts.ts`, `friends.ts`, `profile.ts`, `settings.ts`, `trips.ts`, `saves.ts`, `seedSocial.ts`, `moments.ts` | `convex/ingest.ts`, `imports/*`, `crons.ts`, `catalog.ts`, `performers.ts` |
| Pure code | `convex/lib/recs.ts`, `discovery.ts`, `hours.ts`, `insights.ts`, `group.ts` | `convex/lib/social.ts` | `convex/lib/performers.ts` |
| App | `src/lib/useNearby.ts`, `src/lib/demoLocation.ts` | none | none |
| Tests | `tests/recs.test.mjs`, `tests/brain.*.test.mjs` | `tests/people.*.test.mjs` | `tests/data.*.test.mjs`, `tests/fixtures/*` |
| Docs | `docs/ALGORITHM.md` | none | none |

Nobody in these three sessions touches `src/app/`, `src/components/`, `src/theme/` or `App.tsx`: the screens are Bryan's.

**Shared files, and the rule for each:**

| File | Rule |
| --- | --- |
| `convex/schema.ts` | Don't edit. It only combines the table files. Add tables and fields in your own table file. |
| `convex/lib/contract.ts`, `docs/CONTRACT.md` | Frozen for this round. If you truly need a new field, add it as **optional**, at the end of the type, and list it in your final report. Never rename or remove anything. |
| `convex/_generated/api.d.ts` | Only if you add a module that has no placeholder: add its two lines in alphabetical position. Don't touch other lines. |
| `convex/crons.ts` | Data owns it. Brain and People: don't edit it; put the exact cron line you need in your final report. |
| `package.json`, `package-lock.json` | Avoid new dependencies. Everything in the briefs can be done with what's installed. If you must add one, use `npx expo install <pkg>` and say so in your final report. |
| `hackathon.md` | Don't edit. It is updated once after the merge. |

## 3. How to work

1. You are on your own branch in your own working folder. **Commit to that branch after every finished task.** Don't push, don't switch branches, don't merge. The main session merges the three branches.
2. **Don't deploy.** No `npx convex dev`, `npx convex deploy` or `npx convex run`: there is one shared deployment, and a push from a branch replaces everyone's functions. Prove your work with the type checker and tests instead.
3. After every task, and before you finish: `npx tsc --noEmit` and `npm test` must both pass. Never commit a red branch.
4. Do the tasks in your brief **in order**. The first ones are the must-haves. Plan to work for at least 20 minutes and keep going down the list for as long as the work is good; stop cleanly at a task boundary.
5. If something another session owns blocks you, don't edit their file. Code against the placeholder signature, leave a comment starting with `INTEGRATION:` saying what must be connected, and list it in your final report.
6. Your final message is a report for the main session: what you built (function by function), what you verified and how, every `INTEGRATION:` note, cron lines you need, new environment variables, and anything you skipped.

## 4. Code rules

- **Match the code that's there.** Read two or three existing files in `convex/` before writing. Same validator style, same helpers (`getAuthUserId`, `displayNameOf`, `avatarUrlOf`, `friendIdsOf`, `notify`), same error style (`throw new Error("Short sentence a user can read")`).
- **Pure logic goes in `convex/lib/*.ts` with no runtime Convex imports** (`import type` is fine), so `node --test` can load it directly, the way `tests/recs.test.mjs` loads `convex/lib/recs.ts`. Every weight is a named constant at the top of the file.
- **Tests:** `tests/<session>.<topic>.test.mjs`, Node's built-in runner (`npm test`). Test the pure functions hard: the edge cases, not just the happy path.
- **Every public function has argument validators and checks who is calling** (`getAuthUserId(ctx)`); a user can only change their own rows. Internal work (imports, seeds, crons) uses `internalQuery` / `internalMutation` / `internalAction`.
- **Keep every query bounded.** Always go through an index, and `take(n)` instead of `collect()` on anything that can grow (rankings of a popular place, posts, notifications, the catalog). A query must stay well under a few thousand documents read.
- **Queries are live.** Don't call `Date.now()` to build a value that changes on every run unless the existing code already does it the same way; follow `convex/lib/discovery.ts`.
- **Never replace a catalog row.** Use `patch` with only the fields you own. `elo`, `nComparisons` and `learnedVector` on places and events belong to Brain and must survive every import.
- **Return shapes are exactly the contract types.** Import them from `convex/lib/contract.ts` and annotate handler return types with them.
- **Privacy, enforced in the backend:** under-21 users never get nightlife; posts default to friends-only; nobody's live location is stored or returned; answers to venue questions leave the backend only as totals; imports never store guest lists, hosts' personal details or anything about a person who isn't a clubi user.
- **Secrets:** read keys from `process.env.NAME` inside actions (`EVENTBRITE_TOKEN`, `TICKETMASTER_KEY`, `GOOGLE_MAPS_KEY`). A missing key means "skip this source and say so", never a crash. Never write a key into a file that git tracks.
- **Expo:** you are not writing screens, but if you touch `src/lib/`, follow `AGENTS.md`.

## 5. How the three connect

```
           Data                         People                        Brain
  imports → places, events      rankings.rank  ───────────►  applyComparison / applyBucket
  performers, eventPerformers        │  │                    (taste + place quality learn)
        │                            │  └──► recordPerformerAffinity (Data)
        │  new event stored          │
        └──► notifyPerformerFans ──► notify (People) ──► "Calvin Harris is coming…"
                                     │
             insights.submit (Brain) ◄── the app, right after rank
                    │
                    └──► learnedVector on the place ──► every score that uses that place

  trips, tripMembers, tripVotes (People) ──► discover.forGroup / plan (Brain)
  friendships, saves (People) ──► friends on cards, "friends going" (Brain)
```

The cross-session calls all have a placeholder with the final signature already on `main`, so each side compiles alone:

| Call | Defined by | Called by |
| --- | --- | --- |
| `applyComparison`, `applyBucket` (`convex/scoring.ts`) | Brain (exists) | People, in `rankings.rank` |
| `recordPerformerAffinity`, `notifyPerformerFans` (`convex/performers.ts`) | Data | People (`rankings.rank`), Data (ingest) |
| `notify` (`convex/notifications.ts`) | People (exists) | Data, Brain |
| Tables `trips`, `tripMembers`, `tripVotes`, `saves`, `friendships` | People | Brain reads them |
| Tables `performers`, `eventPerformers`, `affinities` | Data | Brain reads them |
| Table `visitAnswers`, `venueStats` | Brain | People may read `visitAnswers` by `rankingId` |

## 6. After the sessions

The main session merges the three branches into `main`, connects every `INTEGRATION:` note, regenerates `convex/_generated`, deploys once, runs the imports and seeds, and builds a small test page that exercises every function end to end.
