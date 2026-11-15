# clubi

**What's worth doing near you right now, ranked for your taste, by people like you, especially locals.**

You rank the places you go (loved / fine / didn't, then "better or worse than X?"). Every ranking teaches the app your taste and teaches it about the place. The map shows bars, clubs, restaurants, museums, parks, concerts and pop-ups with a score that is yours alone and a one-line reason for it. Friends' rankings show up in a live feed, groups get picks everyone can live with, and when an artist you rated highly comes to town, you hear about it.

Built at the Consumer Mobile Hackathon (YC SF, Nov 15 2026) by Ethan (backend), Bryan (UI) and Albert.

## How it's built

| Part | What |
| --- | --- |
| App | Expo (React Native, TypeScript, Expo Router), screens in `src/app/` |
| Backend | Convex: database, live queries, functions, file storage, crons (`convex/`) |
| Sign-in | Convex Auth, username + password |
| Data | OpenStreetMap, Luma, Partiful, Eventbrite, Ticketmaster (optional key), Google Places (optional key) |
| Build tools | Backend written by three Claude Code sessions working in parallel; Capy and Revyl for the final pass, cloud iPhone build and checks |

## Where things are

| Read this | For |
| --- | --- |
| [`docs/UI-SPEC.md`](docs/UI-SPEC.md) | **Bryan:** what every screen does, every button, and which backend function it calls |
| [`docs/APP.md`](docs/APP.md) | **Anyone building screens:** the routes, shared components and helpers, and the conventions (loading, empty, error, labels) |
| [`docs/CONTRACT.md`](docs/CONTRACT.md) | Every function the app can call, with its exact shape. Types: `convex/lib/contract.ts` |
| [`docs/ALGORITHM.md`](docs/ALGORITHM.md) | How scores, group picks, friend suggestions, venue insights and artist alerts work, with the papers behind them |
| [`docs/SESSIONS.md`](docs/SESSIONS.md) | The three backend sessions: who owns which file, and the rules |
| [`docs/sessions/`](docs/sessions/) | One task list per session: `brain.md`, `people.md`, `data.md` |
| [`hackathon.md`](hackathon.md) | Build log |

## Run it

```bash
npm install
echo "EXPO_PUBLIC_CONVEX_URL=https://famous-lion-37.convex.cloud" > .env.local
npx expo start          # scan the QR code with Expo Go, or press w for web
```

Checks: `npx tsc --noEmit` (types) and `npm test` (pure-logic tests, Node's built-in runner).

Backend changes reach the shared deployment only when someone deploys `main` (`npx convex dev --once`). Don't deploy from a feature branch: a deploy replaces every function.

## Backend map

```
convex/
  schema.ts            combines the table files in tables/
  tables/              people, social, trips (People) · catalog, entities (Data) · insights (Brain)
  lib/                 pure logic, unit-tested: recs, discovery, insights, group, social, performers
  discover.ts places.ts scoring.ts insights.ts debug.ts          Brain
  rankings.ts posts.ts friends.ts profile.ts settings.ts trips.ts saves.ts notifications.ts users.ts auth.ts   People
  ingest.ts imports/ performers.ts catalog.ts crons.ts           Data
```

## Keys

The phone only needs `EXPO_PUBLIC_CONVEX_URL`. Server keys (`EVENTBRITE_TOKEN`, `TICKETMASTER_KEY`, `GOOGLE_MAPS_KEY`) are set on the Convex deployment with `npx convex env set NAME value`, never committed. See `.env.example`.
