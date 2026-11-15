import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeCtx, run } from "./fixtures/fakeDb.mjs";
import { fixture, jsonFixture, load } from "./fixtures/load.mjs";

// Fixtures are trimmed copies of real pages fetched on 2026-11-15 (host ids removed):
//   partiful-explore.html   https://partiful.com/explore ("Trending in the Bay")
//   partiful-event.html     one public event page, https://partiful.com/e/<id>
//   nominatim-search.json   https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=1469 Webster St, San Francisco, CA
const partiful = await load("imports/partiful");
const { geocodeQuery, geocodeResult, pageProps, partifulToRow, similarEventIds } = partiful;

const now = Date.parse("2026-11-15T20:00:00Z");
const explore = pageProps(fixture("partiful-explore.html"));
const trending = explore.trendingSections.SF.items.map((item) => item.event);
const cookie = trending.find((event) => event.title.startsWith("Cookie Picnic"));
const page = pageProps(fixture("partiful-event.html"));

test("pageProps reads the embedded data and survives a page without it", () => {
  assert.equal(trending.length, 5);
  assert.equal(page.event.title, "Fort Mason Holiday Night Market");
  assert.equal(pageProps("<html>Just a moment...</html>"), null);
  assert.equal(pageProps('<script id="__NEXT_DATA__" type="application/json">{broken</script>'), null);
});

test("partifulToRow maps a real public event; the rounded map point is marked approximate", () => {
  const row = partifulToRow(cookie, now);
  assert.equal(row.source, "partiful");
  assert.equal(row.sourceId, cookie.id);
  assert.equal(row.category, "popup");
  assert.equal(row.start, Date.parse("2026-11-15T21:00:00.000Z"));
  assert.deepEqual([row.lat, row.lng], [37.78, -122.43]);
  assert.deepEqual(row.tags, ["approximate location"]);
  assert.equal(row.address, "1469 Webster St, San Francisco, CA");
  assert.equal(row.city, "San Francisco");
  assert.equal(row.sourceUrl, "https://partiful.com/e/" + cookie.id);
  assert.equal(row.venueVector.length, 13);
  assert.ok(!JSON.stringify(row).includes(cookie.description.slice(0, 30)), "the host's description is not stored");
});

test("only published public San Francisco events in the next 14 days are kept", () => {
  const kept = trending.map((event) => partifulToRow(event, now)).filter(Boolean);
  assert.deepEqual(kept.map((row) => row.name), [cookie.title], "Oakland, Mountain View and far-off events are dropped");
  assert.equal(partifulToRow({ ...cookie, isPublic: false }, now), null);
  assert.equal(partifulToRow({ ...cookie, isPublic: undefined }, now), null);
  assert.equal(partifulToRow({ ...cookie, status: "CANCELED" }, now), null);
  assert.equal(partifulToRow({ ...cookie, locationInfo: null }, now), null);
  assert.equal(partifulToRow({ ...cookie, locationInfo: { neighborhood: "Mission" } }, now), null, "no public location");
  assert.equal(partifulToRow({ ...cookie, startDate: "not a date" }, now), null);
  assert.equal(partifulToRow({ ...cookie, title: " " }, now), null);
  assert.equal(partifulToRow({}, now), null);
});

test("a publicly shown street address is geocoded; anything vaguer is not", () => {
  assert.equal(geocodeQuery(cookie), "1469 Webster St, San Francisco, CA");
  assert.equal(geocodeQuery(page.event), "2 Marina Blvd Bldg C, San Francisco, CA", "the unit line is left out");
  const bromley = trending.find((event) => event.locationInfo.displayAddressLines[0] === "Bromley Pl");
  assert.equal(geocodeQuery(bromley), null, "a street with no number is not an address");
  assert.equal(geocodeQuery({ locationInfo: { displayAddressLines: ["Mission District"] } }), null);
  assert.equal(geocodeQuery({ locationInfo: null }), null);
  assert.equal(geocodeQuery({}), null);

  const point = geocodeResult(jsonFixture("nominatim-search.json"));
  assert.deepEqual(point, { lat: 37.7842604, lng: -122.4313184 });
  assert.equal(geocodeResult([]), null);
  assert.equal(geocodeResult({ error: "Unable to geocode" }), null);
  assert.equal(geocodeResult([{ lat: "x", lon: "y" }]), null);
});

test("a geocoded point replaces the rounded one only when it agrees with it", () => {
  const point = geocodeResult(jsonFixture("nominatim-search.json"));
  const precise = partifulToRow(cookie, now, undefined, point);
  assert.deepEqual([precise.lat, precise.lng, precise.tags], [point.lat, point.lng, []]);
  const wrong = partifulToRow(cookie, now, undefined, { lat: 37.7, lng: -122.2 });
  assert.deepEqual([wrong.lat, wrong.lng, wrong.tags], [37.78, -122.43, ["approximate location"]]);
  assert.deepEqual(partifulToRow(cookie, now, undefined, null).tags, ["approximate location"]);
});

test("an event page gives the price, the venue name and the ids of similar events", () => {
  const far = Date.parse("2026-12-10T00:00:00Z");
  const row = partifulToRow(page.event, far, page.offersJsonLd.price);
  assert.equal(row.price, 0);
  assert.equal(row.venueName, "Fort Mason Center for Arts & Culture");
  assert.equal(row.address, "2 Marina Blvd Bldg C, Unit 260, San Francisco, CA");
  assert.equal(partifulToRow(page.event, now), null, "more than 14 days away today");
  const ids = similarEventIds(page);
  assert.equal(ids.length, 3);
  assert.ok(ids.every((id) => /^[A-Za-z0-9]+$/.test(id)));
  assert.deepEqual(similarEventIds(null), []);
  assert.deepEqual(similarEventIds({ similarEvents: [{ id: "../evil" }, {}, null, { event: { id: "abc123" } }, { id: "abc123" }] }), ["abc123"]);
});

test("setPartifulUrls keeps only event URLs; the geocode cache remembers misses", async () => {
  const ctx = fakeCtx();
  const saved = await run(partiful.setPartifulUrls, ctx, {
    urls: ["https://partiful.com/e/abc123", "https://www.partiful.com/e/Def456?utm=x", "https://example.com/e/abc", "partiful.com/e/nope"],
  });
  assert.deepEqual(saved, { saved: 2, rejected: 2 });
  const plan = await run(partiful.urlPlan, ctx, {});
  assert.deepEqual(plan.listedIds, ["abc123", "Def456"]);
  assert.deepEqual(plan.due, ["https://partiful.com/e/abc123", "https://www.partiful.com/e/Def456"]);
  await run(partiful.markFetched, ctx, { urls: [plan.due[0]] });
  const after = await run(partiful.urlPlan, ctx, {});
  assert.deepEqual(after.due, ["https://www.partiful.com/e/Def456"]);
  assert.deepEqual(after.recentlyRead, ["https://partiful.com/e/abc123"]);

  await run(partiful.saveGeocodes, ctx, { found: [{ query: "1 Main St, SF, CA", lat: 37.79, lng: -122.39 }, { query: "9 Nowhere, SF, CA" }] });
  assert.deepEqual(await run(partiful.geocodeCache, ctx, {}), { "1 Main St, SF, CA": { lat: 37.79, lng: -122.39 }, "9 Nowhere, SF, CA": null });
});

test("no host or guest data in the fixtures or in a row", () => {
  const text = fixture("partiful-explore.html") + fixture("partiful-event.html") + JSON.stringify(partifulToRow(cookie, now));
  assert.ok(!/ownerIds|owners|GuestCount|hosts|createdBy/.test(text));
});
