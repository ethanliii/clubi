# clubi: notes for coding agents

@AGENTS.md

## Before you write anything

1. `README.md`: what the product is and where things live.
2. `docs/CONTRACT.md` + `convex/lib/contract.ts`: the API between backend and screens. Shapes only grow; never rename or remove a field.
3. If you are one of the three backend sessions: `docs/SESSIONS.md` and your brief in `docs/sessions/`. Edit only the files you own.
4. If you are building screens: `docs/UI-SPEC.md`. Screens render what the backend returns and never compute a score or an order.

## Always

- `npx tsc --noEmit` and `npm test` pass before you call anything done.
- Don't deploy to Convex from a branch (`npx convex dev`, `deploy`, `run`): one shared deployment, and a push replaces every function.
- No keys or tokens in any tracked file.
- Privacy rules are enforced in the backend: under-21 users never get nightlife, posts default to friends-only, nobody's live location is stored, venue-question answers leave the backend only as totals.
