# Session brief: Data

**You own the world the app shows:** every place and event on the map, where it came from, who is performing, and the alert that tells a user an artist they love is coming to town.

Read first: [`../SESSIONS.md`](../SESSIONS.md) (rules, file ownership), [`../CONTRACT.md`](../CONTRACT.md) (the Performers section is yours), [`../ALGORITHM.md`](../ALGORITHM.md) §4 (performer affinity and alerts), `convex/lib/contract.ts`. Then read the code you inherit: `convex/ingest.ts` (the upsert, de-dupe and featurizer), `convex/imports/osm.ts`, `convex/imports/luma.ts` (the model for a polite import), `convex/crons.ts`, `convex/tables/catalog.ts`, `convex/tables/entities.ts`, `convex/performers.ts` (placeholder signatures you must keep).

**Why this matters:** a recommendation is only as good as the catalog behind it. Today the map has OpenStreetMap places and Luma events. Ethan wants live events from more sources, real details for venues, and the moment in the demo where someone who ranked a Calvin Harris show highly gets "Calvin Harris is coming to San Francisco".

**Your files:** `convex/tables/catalog.ts`, `tables/entities.ts`, `convex/ingest.ts`, `convex/imports/*`, `convex/crons.ts`, `convex/catalog.ts`, `convex/performers.ts`, `convex/lib/performers.ts`, `tests/data.*.test.mjs`, `tests/fixtures/*`.

**Ground rules for every import** (they are already how `imports/luma.ts` behaves; keep them): public pages and documented APIs only; respect robots.txt; at most one request a second to any host; a generic `User-Agent` with no personal details; public, in-person events only; never store guest lists, attendee names, hosts' contact details or exact addresses a host shares only with guests; keep `sourceUrl` so the app can link back; every import checks `ingestFrozen` first and does nothing when it is set; a missing key or a blocked page means "skip and report", never a crash. Write each parser as a pure function (`xToRow(raw, now)`) with a test, the way `lumaToRow` and `osmToRow` are.

You can't deploy, so prove parsers against the real thing: fetch a real response once with `curl` (politely), save a small trimmed sample under `tests/fixtures/` (no personal data, no keys), and test the parser on it.

Do the tasks in order. Commit after each. `npx tsc --noEmit` and `npm test` green every time.

## D1. Performers (`lib/performers.ts`, `performers.ts`, `ingest.ts`) — must have

1. `lib/performers.ts` (pure, tested in `tests/data.performers.test.mjs`): `normalizePerformerName(name)`; `parsePerformers(title)` that pulls names out of event titles ("Calvin Harris at The Midway", "DJ X b2b DJ Y", "A w/ B", "X presents: Y", "A, B + C", "feat."), is conservative (a title like "Sunday Farmers Market" yields nothing), and returns at most 5; `genresToVector(genres)` → the 13 features; `affinityStep(old, score, n)` and `shouldAlert(...)` from ALGORITHM.md §4.
2. `ingestRow` gains optional `performers: {name, sourceId?, genres?, imageUrl?, kind?}[]` and `venueName`. In `upsertBatch`, for events: set `createdAt` on insert, store `performerNames` and `venueName`, upsert each performer (index `by_normalizedName`), link it with `eventPerformers`, try to set `placeId` to a catalog place with the same normalised name within 150 m, and for a **newly inserted** event call `notifyPerformerFans`. Updating an existing event must not notify again.
3. `performers.ts`: keep the two exported helper signatures.
   - `recordPerformerAffinity(ctx, {userId, eventId, score})`: for each performer of that event, move the user's affinity toward `score` (§4), creating the row if needed.
   - `notifyPerformerFans(ctx, eventId)`: the alert rule in §4. For each performer of the event, each user with affinity ≥ the threshold or `following`, who hasn't been alerted for this event, whose home city matches the event's city (or is unset), gets `notify(ctx, {type: "artist_event", title: "Calvin Harris is coming to San Francisco", body: "Sat Dec 5 · The Midway · you rated them 9.4", link: "/venue/event/<id>"})`. At most 2 artist alerts per user per day. Record `lastNotifiedEventId`.
   - Public: `search({text})`, `get({performerId})`, `forEvent({eventId})`, `following()`, `follow({performerId, follow})`, all returning `PerformerCard` shapes with `nextEvent` filled from `eventPerformers` (`by_performer`, start ≥ now).

## D2. Eventbrite (`imports/eventbrite.ts`) — must have

What is already known (checked today):

- Eventbrite's public search API is gone: `GET /v3/events/search/` returns 404. The token still works for single events: `GET https://www.eventbriteapi.com/v3/events/<id>/?expand=venue,category,subcategory,format,organizer,ticket_availability` with header `Authorization: Bearer <EVENTBRITE_TOKEN>`.
- The public listing pages return event ids without a login: `https://www.eventbrite.com/d/ca--san-francisco/events--today/` (also `events--tomorrow`, `events--this-weekend`, `music--events`, and `?page=2`) contain `"eventbrite_event_id":"<id>"` and links ending `-tickets-<id>`. Check robots.txt before relying on a path, and look at the page's embedded JSON first: it may already carry name, start time and venue coordinates, which would save the API calls.

Build `importEventbrite` (`internalAction`): collect ids from a few listing pages for the city, fetch details for new ids only (skip ids already stored: one `internalQuery` that returns known `sourceId`s for `source: "eventbrite"`), cap at 60 detail calls a run, map to `ingestRow` (`source: "eventbrite"`, category from Eventbrite's category: Music → `live`, Food & Drink → `food`, Arts → `culture`, nightlife formats → `nightlife`, otherwise `popup`), featurize from name + summary + category, `performers` from `parsePerformers(name)` for music events, `ticketUrl`, `imageUrl`, price from `ticket_availability`. Online events and events without coordinates are dropped. The token comes from `process.env.EVENTBRITE_TOKEN`; for your local fixture fetch only, it is in the file named in your kickoff message. Never print it or commit it.

## D3. Partiful (`imports/partiful.ts`) — must have

**A first version landed an hour ago** (`convex/imports/partiful.ts`, with a cron line). Read it before anything else, keep what works, and close the gaps against this list. There is no API. In this order: (1) find out whether Partiful has a public listing for San Francisco that robots.txt allows (load the site, read what it calls; don't guess URLs); (2) otherwise read public event URLs from `appConfig` key `partifulUrls` (Ethan pastes them) and parse each page's embedded JSON / OpenGraph tags for title, start, image, and location. Geocode a street address only when the page shows one publicly, with OpenStreetMap Nominatim (one request a second, cached in `appConfig` or on the row); skip events with no public location. Category `popup`. Add `internalMutation` `setPartifulUrls({urls})`.

## D4. Ticketmaster (`imports/ticketmaster.ts`)

Discovery API v2, `process.env.TICKETMASTER_KEY`; without the key, return `{skipped: "no TICKETMASTER_KEY"}`. `geoPoint` (a geohash) + `radius`, next 14 days, `size=100`, up to 3 pages. Map venue coordinates, `ticketUrl`, the best 16:9 image, price range, classification (segment, genre, subGenre) → category `live` (sports and theatre too) and the feature vector, and **attractions → `performers` with genres and images**: this is the best source of real artist data, and what makes the artist alert work.

## D5. Better places (`imports/osm.ts`, `imports/google.ts`)

1. OpenStreetMap already has more than we keep. Carry through `opening_hours`, `website`, `phone` / `contact:phone`, `cuisine`, `addr:*` into `hours`, `website`, `phone`, `tags`, `address`, and use `cuisine`, `live_music`, `outdoor_seating`, `lgbtq`, `brewery`, `microbrewery`, `cocktails` in the featurizer.
2. `imports/google.ts`: optional enrichment with the Google Places API (New), `process.env.GOOGLE_MAPS_KEY`; without the key, return `{skipped: "no GOOGLE_MAPS_KEY"}`. For up to 40 catalog places per run that have rankings or sit in the top tier but lack hours or an image: Text Search by name near the coordinates, accept a match only within 75 m with a similar name, and patch `hours`, `externalRating`, `externalRatingCount`, `priceLevel`, `website`, `phone`, `googlePlaceId`. Never overwrite a `seed` or `manual` row's hand-set fields; never replace a row.

## D6. Luma and the featurizer (`imports/luma.ts`, `ingest.ts`)

- Luma rows: add `performers` from `parsePerformers(title)` for music-looking events, and `venueName` when the event names one.
- Featurizer: event genre words (house, techno, disco, r&b, latin, reggaeton, jazz, punk, comedy, drag, trivia, karaoke, rooftop, brunch, wine, gallery opening, run club, …) to features; performer genre vectors blended in when an event has known performers.

## D7. Crons and catalog tools (`crons.ts`, `catalog.ts`)

- Crons, each freeze-aware: Eventbrite every 60 minutes, Partiful every 30, Ticketmaster every 2 hours, Google enrichment every 6 hours. Keep the two lines that are there.
- `catalog.ts`: `addManual` (`internalMutation`: hand-add a place or event with `source: "manual"`, featurized, with optional performers) and `stats` (`internalQuery`: counts by source and category, events in the next 7 days, share with an image, share with performers, places with hours).

## D8. If there is time

- A `resident` importer for one or two public venue calendars in San Francisco with clean JSON (only if robots.txt allows and the format is stable).
- De-dupe across sources: the same event from Eventbrite and Luma (same normalised title, start within an hour, within 200 m) keeps one row and remembers both URLs.
- `performers.similar({performerId})` from the genre vectors.

## Final report

List: every function built or changed with its final args and return type; for each source, what you verified against the real site and what you could only test on fixtures; test names and results; environment variables needed; each `INTEGRATION:` note; anything skipped and why (blocked page, robots.txt, missing key).
