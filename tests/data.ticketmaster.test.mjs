import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeCtx, run } from "./fixtures/fakeDb.mjs";
import { jsonFixture, load } from "./fixtures/load.mjs";

// The fixture follows the documented Discovery API v2 shape. It was written by hand (no
// TICKETMASTER_KEY was available), so these tests prove the mapping, not the live API.
const { bestImage, geohashOf, importTicketmaster, searchUrl, ticketmasterToRow } = await load("imports/ticketmaster");
const { upsertBatch } = await load("ingest");
const { FEATURES } = await load("lib/recs");

const now = Date.parse("2026-11-15T20:00:00Z");
const events = jsonFixture("ticketmaster-events.json")._embedded.events;
const [calvin, warriors, hamilton, cancelled, tba, noMap] = events;
const f = (name) => FEATURES.indexOf(name);

test("geohashOf matches known geohashes", () => {
  assert.equal(geohashOf(37.7749, -122.4194, 5), "9q8yy");
  assert.equal(geohashOf(37.7749, -122.4194), "9q8yyk8");
  assert.equal(geohashOf(40.7128, -74.006, 6), "dr5reg");
  assert.equal(geohashOf(51.5074, -0.1278, 5), "gcpvj");
  assert.equal(geohashOf(-33.8688, 151.2093, 5), "r3gx2");
});

test("searchUrl asks for the documented parameters and never contains a key", () => {
  const url = searchUrl({ lat: 37.7749, lng: -122.4194, radiusKm: 25, from: now, to: now + 14 * 86400000, page: 2 });
  assert.equal(url.origin + url.pathname, "https://app.ticketmaster.com/discovery/v2/events.json");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    geoPoint: "9q8yyk8", radius: "25", unit: "km",
    startDateTime: "2026-11-15T20:00:00Z", endDateTime: "2026-11-29T20:00:00Z",
    size: "100", page: "2", sort: "date,asc",
  });
});

test("ticketmasterToRow maps a concert: venue, price, 16:9 image, attractions as performers", () => {
  const row = ticketmasterToRow(calvin, now);
  assert.equal(row.source, "ticketmaster");
  assert.equal(row.sourceId, "vvG1VZKS5pr1qy");
  assert.equal(row.name, "Calvin Harris");
  assert.equal(row.category, "live");
  assert.equal(row.subcategory, "dance/electronic");
  assert.deepEqual(row.tags, ["music", "dance/electronic", "house"]);
  assert.equal(row.start, Date.parse("2026-12-06T05:00:00Z"));
  assert.deepEqual([row.lat, row.lng], [37.7494, -122.3866]);
  assert.deepEqual([row.venueName, row.city, row.address], ["The Midway", "San Francisco", "900 Marin Street"]);
  assert.equal(row.price, 79.5);
  assert.ok(row.imageUrl.endsWith("calvin_TABLET_LANDSCAPE_16_9.jpg"), "the 1024 px 16:9 image");
  assert.equal(row.ticketUrl, calvin.url);
  assert.equal(row.sourceUrl, calvin.url);
  assert.equal(row.blurb, "Music · Dance/Electronic · House");
  assert.deepEqual(row.performers, [
    { name: "Calvin Harris", sourceId: "K8vZ917G1V7", genres: ["Music", "Dance/Electronic", "House"], imageUrl: "https://s1.ticketm.net/dam/a/123/calvin_artist_TABLET_LANDSCAPE_16_9.jpg", kind: "artist" },
    { name: "Disclosure", sourceId: "K8vZ9175rX7", genres: ["Music", "Dance/Electronic"], imageUrl: "https://s1.ticketm.net/dam/c/fbc/b293c0ad_TABLET_LANDSCAPE_16_9.jpg", kind: "artist" },
  ]);
  assert.equal(row.venueVector.length, 13);
  assert.ok(row.venueVector[f("electronic")] >= 0.85 && row.venueVector[f("dancing")] >= 0.7);
});

test("sports and theatre are live too, with their own shape", () => {
  const game = ticketmasterToRow(warriors, now);
  assert.equal(game.category, "live");
  assert.equal(game.subcategory, "basketball");
  assert.equal(game.price, 120, "the standard price range, not the one with fees");
  assert.deepEqual(game.performers.map((p) => [p.name, p.kind]), [["Golden State Warriors", "team"], ["Los Angeles Lakers", "team"]]);
  assert.ok(game.venueVector[f("liveMusic")] <= 0.3 && game.venueVector[f("energy")] >= 0.8);

  const musical = ticketmasterToRow(hamilton, now);
  assert.equal(musical.subcategory, "theatre");
  assert.equal(musical.start, Date.parse("2026-11-23T04:00:00Z"), "a day with no time yet is assumed to start at 8 pm local");
  assert.equal(musical.performers, undefined);
  assert.equal(musical.imageUrl, undefined);
  assert.equal(musical.price, undefined);
  assert.ok(musical.venueVector[f("culture")] >= 0.8);
});

test("cancelled, undated, unlocated, past and malformed events are dropped", () => {
  assert.equal(ticketmasterToRow(cancelled, now), null);
  assert.equal(ticketmasterToRow(tba, now), null);
  assert.equal(ticketmasterToRow(noMap, now), null);
  assert.equal(ticketmasterToRow({ ...calvin, dates: { ...calvin.dates, status: { code: "postponed" } } }, now), null);
  assert.equal(ticketmasterToRow(calvin, Date.parse("2026-12-07T00:00:00Z")), null);
  assert.equal(ticketmasterToRow({ ...calvin, name: " " }, now), null);
  assert.equal(ticketmasterToRow({ ...calvin, _embedded: {} }, now), null);
  assert.equal(ticketmasterToRow({}, now), null);
  assert.equal(ticketmasterToRow({ fault: { faultstring: "Invalid ApiKey" } }, now), null);
});

test("bestImage prefers real 16:9 art near 1024 px and only https", () => {
  assert.equal(bestImage(undefined), undefined);
  assert.equal(bestImage([{ ratio: "16_9", url: "http://insecure.example/a.jpg", width: 1024 }]), undefined);
  assert.equal(
    bestImage([
      { ratio: "16_9", url: "https://x/fallback.jpg", width: 1024, fallback: true },
      { ratio: "16_9", url: "https://x/real-small.jpg", width: 640, fallback: false },
      { ratio: "4_3", url: "https://x/four-three.jpg", width: 1024, fallback: false },
    ]),
    "https://x/real-small.jpg",
  );
  assert.equal(bestImage([{ ratio: "4_3", url: "https://x/only.jpg", width: 305 }]), "https://x/only.jpg");
});

test("a Ticketmaster row goes through the ingest: performers with genres, and the fan is alerted", async () => {
  const ctx = fakeCtx();
  const userId = await ctx.db.insert("users", { homeCity: "San Francisco" });
  const realNow = Date.now;
  Date.now = () => now;
  try {
    await run(upsertBatch, ctx, { kind: "event", rows: [ticketmasterToRow(calvin, now)] });
    const [headliner, support] = ctx.all("performers");
    assert.deepEqual([headliner.name, headliner.kind, headliner.sourceId], ["Calvin Harris", "artist", "K8vZ917G1V7"]);
    assert.ok(headliner.vector[f("electronic")] >= 0.9);
    assert.equal(support.name, "Disclosure");
    const performers = await load("performers");
    await run(performers.follow, ctx.as(userId), { performerId: support._id, follow: true });
    const second = { ...calvin, id: "second-night", name: "Disclosure (DJ Set)", _embedded: { ...calvin._embedded, attractions: [calvin._embedded.attractions[1]] } };
    await run(upsertBatch, ctx, { kind: "event", rows: [ticketmasterToRow(second, now)] });
    const [note] = ctx.all("notifications");
    assert.equal(note.title, "Disclosure is coming to San Francisco");
    assert.equal(note.body, "Sat Dec 5 · The Midway · you follow them");
  } finally {
    Date.now = realNow;
  }
});

test("without TICKETMASTER_KEY the import skips and says so", async () => {
  const saved = process.env.TICKETMASTER_KEY;
  delete process.env.TICKETMASTER_KEY;
  try {
    assert.deepEqual(await run(importTicketmaster, {}, {}), { skipped: "no TICKETMASTER_KEY" });
  } finally {
    if (saved !== undefined) process.env.TICKETMASTER_KEY = saved;
  }
});
