import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeCtx, run } from "./fixtures/fakeDb.mjs";
import { load } from "./fixtures/load.mjs";

const { addManual, stats } = await load("catalog");
const { setIngestFrozen, upsertBatch } = await load("ingest");
const crons = (await load("crons")).default;

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.now();
const midway = { lat: 37.7494, lng: -122.3866 };

test("addManual stores a featurized manual place that imports cannot overwrite", async () => {
  const ctx = fakeCtx();
  const added = await run(addManual, ctx, { kind: "place", name: "The Midway", category: "nightlife", ...midway, tags: ["nightclub", "techno"], hours: "Fr,Sa 21:00-04:00", priceLevel: 3, website: "https://themidwaysf.com" });
  assert.equal(added.outcome, "inserted");
  const place = await ctx.db.get(added.id);
  assert.deepEqual([place.source, place.sourceId, place.hours, place.priceLevel, place.website], ["manual", "manual:midway", "Fr,Sa 21:00-04:00", 3, "https://themidwaysf.com"]);
  assert.equal(place.venueVector.length, 13);
  assert.ok(place.venueVector[8] >= 0.9, "techno → electronic");

  const osm = { source: "osm", sourceId: "node/1", name: "The Midway", category: "nightlife", ...midway, hours: "24/7", tags: ["a", "b", "c"], address: "900 Marin St", blurb: "x", imageUrl: "https://x/y.jpg" };
  assert.equal((await run(upsertBatch, ctx, { kind: "place", rows: [osm] })).duplicate, 1);
  assert.equal(ctx.all("places").length, 1);
  assert.equal((await ctx.db.get(added.id)).hours, "Fr,Sa 21:00-04:00");

  const again = await run(addManual, ctx, { kind: "place", name: "the midway", category: "nightlife", ...midway, hours: "Th-Sa 21:00-04:00" });
  assert.deepEqual([again.outcome, again.id], ["updated", added.id]);
});

test("a hand-added row takes over an imported duplicate and keeps what Brain learned", async () => {
  const ctx = fakeCtx();
  await run(upsertBatch, ctx, { kind: "place", rows: [{ source: "osm", sourceId: "node/2", name: "El Rio", category: "nightlife", lat: 37.7468, lng: -122.4194, hours: "Mo-Su 13:00-02:00", tags: ["outdoor seating", "lgbtq", "live music"], address: "3158 Mission St" }] });
  const [imported] = ctx.all("places");
  await ctx.db.patch(imported._id, { elo: 2.1, nComparisons: 9, learnedVector: [0.5] });
  const added = await run(addManual, ctx, { kind: "place", name: "El Rio", category: "nightlife", lat: 37.7468, lng: -122.4194, blurb: "Patio, dancing, $1 oysters on Fridays" });
  assert.deepEqual([added.outcome, added.id], ["replaced", imported._id]);
  const place = await ctx.db.get(added.id);
  assert.deepEqual([place.source, place.hours, place.address, place.elo, place.nComparisons, place.learnedVector], ["manual", "Mo-Su 13:00-02:00", "3158 Mission St", 2.1, 9, [0.5]]);
});

test("addManual adds an event with performers even while imports are frozen, and alerts fans", async () => {
  const ctx = fakeCtx();
  await run(setIngestFrozen, ctx, { frozen: true });
  const fan = await ctx.db.insert("users", { homeCity: "San Francisco" });
  const event = { kind: "event", name: "Calvin Harris", category: "live", ...midway, city: "San Francisco", venueName: "The Midway", performers: [{ name: "Calvin Harris", genres: ["House"] }] };
  const first = await run(addManual, ctx, { ...event, start: T0 + 5 * DAY });
  assert.equal(first.outcome, "inserted");
  const performers = await load("performers");
  await run(performers.follow, ctx.as(fan), { performerId: ctx.all("performers")[0]._id, follow: true });
  const second = await run(addManual, ctx, { ...event, start: T0 + 30 * DAY, price: 80 });
  assert.equal(second.outcome, "inserted");
  assert.notEqual(second.id, first.id);
  assert.equal(ctx.all("notifications")[0].title, "Calvin Harris is coming to San Francisco");
  assert.equal((await run(upsertBatch, ctx, { kind: "event", rows: [] })).frozen, true, "imports are still frozen");
});

test("addManual refuses rows that make no sense, in words a person can read", async () => {
  const ctx = fakeCtx();
  const place = { kind: "place", name: "X", category: "food", lat: 37.7, lng: -122.4 };
  await assert.rejects(run(addManual, ctx, { ...place, name: "  " }), /A name is needed/);
  await assert.rejects(run(addManual, ctx, { ...place, lat: 137 }), /not on the map/);
  await assert.rejects(run(addManual, ctx, { ...place, priceLevel: 7 }), /1 to 4/);
  await assert.rejects(run(addManual, ctx, { ...place, kind: "event" }), /needs a start time/);
  assert.deepEqual(await run(addManual, ctx, { ...place, kind: "event", start: T0 - 3 * DAY }), { outcome: "dropped", id: null });
});

test("stats counts by source and category, the next 7 days, and how complete rows are", async () => {
  const ctx = fakeCtx();
  await run(upsertBatch, ctx, { kind: "place", rows: [
    { source: "osm", sourceId: "n/1", name: "Bar One", category: "nightlife", lat: 37.76, lng: -122.42, hours: "24/7", website: "https://one.example" },
    { source: "osm", sourceId: "n/2", name: "Cafe Two", category: "food", lat: 37.77, lng: -122.42 },
    { source: "seed", sourceId: "s/1", name: "Park Three", category: "outdoors", lat: 37.78, lng: -122.42, imageUrl: "https://x/p.jpg" },
  ] });
  await ctx.db.patch(ctx.all("places")[1]._id, { externalRating: 4.5 });
  const event = (n, over) => ({ source: "luma", sourceId: "l/" + n, name: "Event " + n, category: "popup", lat: 37.76, lng: -122.42, start: T0 + n * DAY, ...over });
  await run(upsertBatch, ctx, { kind: "event", rows: [
    event(1, { imageUrl: "https://x/1.jpg", price: 0 }),
    event(3, { source: "ticketmaster", category: "live", venueName: "Bar One", performers: [{ name: "Act", genres: ["Rock"] }] }),
    event(20),
  ] });
  await ctx.db.insert("events", { title: "Last week", start: T0 - 7 * DAY, category: "popup", lat: 37.76, lng: -122.42, source: "luma" });

  const s = await run(stats, ctx, {});
  assert.deepEqual(s.places.bySource, { osm: 2, seed: 1 });
  assert.deepEqual(s.places.byCategory, { nightlife: 1, food: 1, outdoors: 1 });
  assert.deepEqual(s.places.withHours, { count: 1, pct: 33.3 });
  assert.deepEqual(s.places.withImage, { count: 1, pct: 33.3 });
  assert.deepEqual(s.places.withWebsite, { count: 1, pct: 33.3 });
  assert.deepEqual(s.places.withExternalRating, { count: 1, pct: 33.3 });
  assert.equal(s.places.missingVector, 0);
  assert.deepEqual([s.events.total, s.events.upcoming, s.events.past, s.events.next7Days], [4, 3, 1, 2]);
  assert.deepEqual(s.events.bySource, { luma: 2, ticketmaster: 1 });
  assert.deepEqual(s.events.byCategory, { popup: 2, nightlife: 1 }, "a show at a bar is nightlife");
  assert.deepEqual(s.events.withImage, { count: 1, pct: 33.3 });
  assert.deepEqual(s.events.withPerformers, { count: 1, pct: 33.3 });
  assert.deepEqual(s.events.withPlace, { count: 1, pct: 33.3 }, "the event at Bar One is linked to the place");
  assert.deepEqual(s.events.withPrice, { count: 1, pct: 33.3 });
  assert.deepEqual(s.performers, { total: 1, withGenres: { count: 1, pct: 100 }, withImage: { count: 0, pct: 0 } });
  assert.equal(s.truncated, false);
  assert.deepEqual((await run(stats, fakeCtx(), {})).events.withImage, { count: 0, pct: 0 }, "an empty catalog divides by nothing");
});

test("crons: the schedule the brief asks for, and the lines that were there", () => {
  const every = Object.fromEntries(Object.entries(crons.crons).map(([name, job]) => [name, job.schedule]));
  assert.deepEqual(every, {
    "luma import": { type: "interval", minutes: 30 },
    "partiful import": { type: "interval", minutes: 30 },
    "eventbrite import": { type: "interval", minutes: 60 },
    "ticketmaster import": { type: "interval", hours: 2 },
    "google places enrichment": { type: "interval", hours: 6 },
    "event tonight notifications": { type: "interval", minutes: 30 },
    "artist alert catch-up": { type: "interval", hours: 24 },
  });
});
