import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeCtx, run } from "./fixtures/fakeDb.mjs";
import { jsonFixture, load } from "./fixtures/load.mjs";

// luma-discover.json: trimmed entries from the real discover list for San Francisco, fetched
// 2026-11-15 from the endpoint imports/luma.ts reads. Host and guest fields were removed.
const { lumaToRow } = await load("imports/luma");
const { featurize, upsertBatch } = await load("ingest");
const { FEATURES } = await load("lib/recs");

const now = Date.parse("2026-11-15T20:00:00Z");
const entries = jsonFixture("luma-discover.json").entries;
const entry = (start) => entries.find((e) => e.event.name.startsWith(start));
const f = (name) => FEATURES.indexOf(name);

test("lumaToRow maps a real public event and names its venue", () => {
  const row = lumaToRow(entry("The SF Tea-Rave"), now);
  assert.equal(row.source, "luma");
  assert.equal(row.category, "live");
  assert.equal(row.subcategory, "dj night");
  assert.equal(row.venueName, "The Foundry SF");
  assert.equal(row.address, "1425 Folsom St, San Francisco");
  assert.equal(row.city, "San Francisco");
  assert.equal(row.price, 28.88);
  assert.equal(row.start, Date.parse("2026-11-15T21:00:00.000Z"));
  assert.deepEqual(row.tags, []);
  assert.equal(row.performers, undefined, "a title with no line-up names nobody");
  assert.ok(row.sourceUrl.startsWith("https://lu.ma/"));
  assert.ok(row.venueVector[f("electronic")] >= 0.8);
});

test("a street is not a venue name, and a hidden address stays hidden", () => {
  const street = lumaToRow(entry("Agentic Web"), now);
  assert.equal(street.venueName, undefined);
  assert.equal(street.address, "625 2nd St, San Francisco");
  assert.equal(street.price, 0);
  const hidden = lumaToRow(entry("Bits (mostly)"), now);
  assert.equal(hidden.address, undefined);
  assert.equal(hidden.venueName, undefined);
  assert.deepEqual(hidden.tags, ["approximate location"]);
  assert.equal(hidden.blurb, "Duboce Triangle · exact address after RSVP on Luma");
});

test("a show's title gives its performers; other events give none", () => {
  const comedy = lumaToRow(entry("Bits (mostly)"), now);
  assert.equal(comedy.category, "live");
  assert.deepEqual(comedy.performers, [{ name: "Lady Bushra", kind: "comedian" }]);
  assert.equal(lumaToRow(entry("Who's Watching"), now).performers, undefined);
  assert.equal(lumaToRow(entry("Agentic Web"), now).performers, undefined);
  const made = (name) => lumaToRow({ ...entry("The SF Tea-Rave"), event: { ...entry("The SF Tea-Rave").event, name } }, now);
  assert.deepEqual(made("DJ Night: Peggy Gou b2b Honey Dijon at The Foundry").performers, undefined, "the head of the title is an occasion");
  assert.deepEqual(made("Peggy Gou b2b Honey Dijon — live DJ set").performers.map((p) => p.name), ["Peggy Gou", "Honey Dijon"]);
  assert.equal(made("Peggy Gou b2b Honey Dijon — live DJ set").performers[0].kind, "dj");
  assert.equal(made("Founders Dinner with Sam and Alex").performers, undefined, "not a show");
});

test("events outside San Francisco, online, private or too far ahead are dropped", () => {
  assert.equal(lumaToRow(entry("Fairway Social"), now), null, "Palo Alto");
  assert.equal(lumaToRow(entry("Slow Burn Social"), now), null, "Berkeley");
  const base = entry("The SF Tea-Rave");
  const withEvent = (over) => ({ ...base, event: { ...base.event, ...over } });
  assert.equal(lumaToRow(withEvent({ visibility: "private" }), now), null);
  assert.equal(lumaToRow(withEvent({ location_type: "online" }), now), null);
  assert.equal(lumaToRow(withEvent({ coordinate: null }), now), null);
  assert.equal(lumaToRow(withEvent({ start_at: "2026-12-25T21:00:00.000Z" }), now), null);
  assert.equal(lumaToRow({}, now), null);
});

test("no host or guest data in the fixture", () => {
  assert.ok(!/host|guest_count|user_api_id|featured_guests/.test(JSON.stringify(entries)));
});

test("featurizer: event words move the features they should", () => {
  const event = (title, category = "popup") => featurize({ category, title });
  const plain = event("Community Gathering");
  assert.ok(event("House Night with open decks")[f("electronic")] >= 0.9);
  assert.equal(event("Open House at the new studio")[f("electronic")], plain[f("electronic")], "an open house is not house music");
  assert.ok(event("Techno Party")[f("dancing")] >= 0.8);
  assert.ok(event("Disco Brunch")[f("food")] >= 0.85 && event("Disco Brunch")[f("dancing")] >= 0.8);
  assert.ok(event("R&B Night")[f("hiphop")] >= 0.9);
  assert.ok(event("Reggaeton Fridays")[f("dancing")] >= 0.85);
  assert.ok(event("Sunday Jazz", "live")[f("liveMusic")] >= 0.9);
  assert.ok(event("Punk Matinee", "live")[f("indie")] >= 0.85);
  assert.ok(event("Comedy Showcase")[f("culture")] >= 0.7 && event("Comedy Showcase")[f("dancing")] <= 0.1);
  assert.ok(event("Drag Brunch")[f("pop")] >= 0.7);
  assert.ok(event("Tuesday Trivia")[f("dancing")] <= 0.05 && event("Tuesday Trivia")[f("liveMusic")] <= 0.15);
  assert.ok(event("Karaoke Night")[f("pop")] >= 0.85);
  assert.ok(event("Rooftop Sunset Session")[f("outdoors")] >= 0.6);
  assert.ok(event("Natural Wine Tasting")[f("price")] >= 0.7);
  assert.ok(event("Gallery Opening: New Works")[f("culture")] >= 0.95);
  assert.ok(event("Saturday Run Club")[f("outdoors")] >= 0.9 && event("Saturday Run Club")[f("loudness")] <= 0.2);
  assert.ok(event("Sound Bath")[f("energy")] <= 0.1);
  for (const vector of [plain, event("House Night"), event("Drag Brunch"), event("")]) {
    assert.equal(vector.length, 13);
    assert.ok(vector.every((x) => x >= 0 && x <= 1));
  }
});

test("known performers pull an event's vector toward their genres", async () => {
  const realNow = Date.now;
  Date.now = () => now;
  try {
    const ctx = fakeCtx();
    const base = { source: "ticketmaster", category: "live", lat: 37.77, lng: -122.41, city: "San Francisco" };
    const start = Date.parse("2026-11-20T04:00:00Z");
    await run(upsertBatch, ctx, { kind: "event", rows: [
      { ...base, sourceId: "a", name: "An Evening With Someone", start },
      { ...base, sourceId: "b", name: "An Evening With Someone Else", start, performers: [{ name: "Charlotte de Witte", genres: ["Dance/Electronic", "Techno"] }] },
      { ...base, sourceId: "c", name: "A Third Evening", start, performers: [{ name: "Unknown Local Act" }] },
    ] });
    const [plain, techno, unknown] = ctx.all("events");
    assert.ok(techno.venueVector[f("electronic")] > plain.venueVector[f("electronic")] + 0.15);
    assert.ok(techno.venueVector[f("dancing")] > plain.venueVector[f("dancing")]);
    assert.deepEqual(unknown.venueVector, plain.venueVector, "a performer with no known genre changes nothing");

    // A Luma row that only has a title links to the performer Ticketmaster told us about, and inherits the sound.
    const luma = lumaToRow({ ...entry("The SF Tea-Rave"), event: { ...entry("The SF Tea-Rave").event, name: "Charlotte de Witte at The Foundry" } }, now);
    assert.equal(luma.performers, undefined, "Luma's own category for this title is popup");
    await run(upsertBatch, ctx, { kind: "event", rows: [luma] });
    const linked = ctx.all("events").find((e) => e.source === "luma");
    assert.deepEqual(linked.performerNames, ["Charlotte de Witte"]);
    assert.ok(linked.venueVector[f("electronic")] > luma.venueVector[f("electronic")]);
    assert.equal(ctx.all("performers").length, 2);
  } finally {
    Date.now = realNow;
  }
});
