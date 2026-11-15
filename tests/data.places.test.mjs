import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeCtx, run } from "./fixtures/fakeDb.mjs";
import { jsonFixture, load } from "./fixtures/load.mjs";

// osm-overpass.json: a trimmed real Overpass answer for the Mission, San Francisco (2026-11-15),
// with e-mail and social tags removed. Data © OpenStreetMap contributors, ODbL.
// google-textsearch.json: written by hand from the documented response shape (no live call was made).
const { osmToRow, webAddress } = await load("imports/osm");
const google = await load("imports/google");
const { googleMatch, googleToPatch, periodsToHours, searchBody, similarNames } = google;
const { featurize, upsertBatch } = await load("ingest");
const { isOpenAt } = await load("lib/hours");
const { FEATURES } = await load("lib/recs");

const f = (name) => FEATURES.indexOf(name);
const rows = jsonFixture("osm-overpass.json").elements.map(osmToRow);
const named = (name) => rows.find((row) => row?.name === name);

test("osmToRow carries hours, website, phone, cuisine and the full address through", () => {
  const delfina = named("Delfina");
  assert.equal(delfina.hours, "Mo-Sa 16:30-22:00; Su 16:30-21:00");
  assert.equal(delfina.website, "https://www.delfinasf.com/");
  assert.equal(delfina.phone, "+1 415 552 4055");
  assert.equal(delfina.address, "3621 18th Street, San Francisco, CA 94110");
  assert.equal(delfina.city, "San Francisco");
  assert.equal(delfina.subcategory, "italian restaurant");
  assert.deepEqual(delfina.tags, ["italian", "pizza", "outdoor seating"]);
  assert.equal(named("Pancho Villa").address, "3071 16th Street", "no city in the tags, none invented");
  assert.equal(named("Mission Dolores Park").website, "https://sfrecpark.org/destination/mission-dolores-park/");
  assert.equal(named("Mission Dolores Park").address, undefined);
  assert.ok(rows.every((row) => row && row.sourceUrl.startsWith("https://www.openstreetmap.org/")));
  assert.ok(!JSON.stringify(rows).includes("@"), "no e-mail addresses");
});

test("OSM flags reach the tags and the feature vector", () => {
  const valencia = named("The Valencia Room");
  assert.ok(valencia.tags.includes("live music"));
  assert.ok(valencia.venueVector[f("liveMusic")] >= 0.9);
  assert.ok(named("The Beehive").tags.includes("cocktails"));
  assert.equal(named("The Beehive").subcategory, "cocktail bar");
  assert.ok(named("The Beehive").venueVector[f("price")] >= 0.7);
  assert.ok(named("Mother").tags.includes("lgbtq"));
  assert.ok(named("Mother").venueVector[f("dancing")] >= 0.6);
  assert.ok(named("Good Good Culture Club").tags.includes("wine"));
  assert.ok(!named("Royal Cuckoo Market").tags.includes("craft beer"), "brewery=no is not a beer bar");
  assert.ok(!named("Taqueria El Buen Sabor").tags.includes("brewery"), "microbrewery=no");
  const taps = osmToRow({ type: "node", id: 1, lat: 37.76, lon: -122.42, tags: { name: "Tap Haus", amenity: "pub", brewery: "Anchor;Sierra Nevada", outdoor_seating: "yes" } });
  assert.deepEqual(taps.tags, ["outdoor seating", "craft beer"]);
  const brewpub = osmToRow({ type: "node", id: 2, lat: 37.76, lon: -122.42, tags: { name: "Brew Co", amenity: "pub", microbrewery: "yes", brewery: "own" } });
  assert.deepEqual(brewpub.tags, ["brewery"]);
});

test("cuisine shapes the vector: a taqueria is cheaper and livelier than an Italian dinner", () => {
  const taqueria = named("Taqueria El Buen Sabor").venueVector;
  const italian = featurize({ category: "food", subcategory: "italian restaurant", tags: ["italian"], title: "Trattoria" });
  assert.ok(taqueria[f("price")] < italian[f("price")]);
  assert.ok(taqueria[f("food")] >= 0.9 && italian[f("food")] >= 0.9);
  const tea = featurize({ category: "food", subcategory: "cafe", tags: ["bubble tea"], title: "Boba Guys" });
  assert.ok(tea[f("energy")] <= 0.25 && tea[f("loudness")] <= 0.2);
});

test("webAddress accepts a site and rejects anything else", () => {
  assert.equal(webAddress("https://example.com/menu"), "https://example.com/menu");
  assert.equal(webAddress("www.example.com"), "https://www.example.com");
  assert.equal(webAddress("http://a.example; http://b.example"), "http://a.example");
  assert.equal(webAddress("javascript:alert(1)"), undefined);
  assert.equal(webAddress("call us"), undefined);
  assert.equal(webAddress("localhost"), undefined);
  assert.equal(webAddress(""), undefined);
  assert.equal(webAddress(undefined), undefined);
});

test("a re-import keeps enrichment and Brain's fields, and stores website and phone", async () => {
  const ctx = fakeCtx();
  const pancho = named("Pancho Villa");
  await run(upsertBatch, ctx, { kind: "place", rows: [{ ...pancho, hours: undefined, phone: undefined }] });
  const [stored] = ctx.all("places");
  assert.equal(stored.website, "https://sfpanchovilla.com/");
  await ctx.db.patch(stored._id, { hours: "Mo-Su 10:00-23:00", phone: "(415) 864-8840", externalRating: 4.3, googlePlaceId: "g1", elo: 0.7, learnedVector: [1] });
  const counts = await run(upsertBatch, ctx, { kind: "place", rows: [{ ...pancho, hours: undefined, phone: undefined }] });
  assert.equal(counts.unchanged, 1);
  await run(upsertBatch, ctx, { kind: "place", rows: [{ ...pancho, phone: undefined, blurb: "Mission burritos" }] });
  const [after] = ctx.all("places");
  assert.equal(after.hours, "Mo-Su 10:00-22:00", "the source's own hours win once it has them");
  assert.deepEqual([after.phone, after.externalRating, after.googlePlaceId, after.elo, after.learnedVector], ["(415) 864-8840", 4.3, "g1", 0.7, [1]]);
});

const results = jsonFixture("google-textsearch.json").places;
const zeitgeist = { name: "Zeitgeist", lat: 37.77, lng: -122.4221 };

test("periodsToHours writes hours the catalog's own parser reads back", () => {
  const hours = periodsToHours(results[0].regularOpeningHours.periods);
  assert.equal(hours, "Mo-Su 09:00-02:00");
  assert.equal(isOpenAt(hours, 3, 23 * 60), true);
  assert.equal(isOpenAt(hours, 3, 60), true, "1 am belongs to the night before");
  assert.equal(isOpenAt(hours, 3, 5 * 60), false);

  const day = (d, open, close) => ({ open: { day: d, hour: open, minute: 0 }, close: { day: d, hour: close, minute: 30 } });
  const split = periodsToHours([day(1, 11, 14), day(1, 17, 21), day(2, 11, 14), day(2, 17, 21), day(5, 17, 22), day(6, 17, 22)]);
  assert.equal(split, "Mo,Tu 11:00-14:30,17:00-21:30; We,Th,Su off; Fr,Sa 17:00-22:30");
  assert.equal(isOpenAt(split, 1, 12 * 60), true);
  assert.equal(isOpenAt(split, 1, 15 * 60), false);
  assert.equal(isOpenAt(split, 3, 12 * 60), false);
  assert.equal(isOpenAt(split, 6, 18 * 60), true);

  assert.equal(periodsToHours([{ open: { day: 0, hour: 0, minute: 0 } }]), "24/7");
  assert.equal(periodsToHours([]), undefined);
  assert.equal(periodsToHours(undefined), undefined);
  assert.equal(periodsToHours([{ open: { day: 9, hour: 1 }, close: { day: 9, hour: 2 } }]), undefined);
});

test("googleMatch needs both a similar name and 75 metres", () => {
  assert.equal(googleMatch(zeitgeist, results)?.id, results[0].id);
  assert.equal(googleMatch({ name: "Zeitgeist Coffee", lat: 37.7799, lng: -122.4101 }, results)?.id, results[1].id, "the namesake 1.5 km away is its own place");
  assert.equal(googleMatch({ ...zeitgeist, name: "Zeitgeist Coffee", lat: 37.775 }, results), null, "right name, 500 m from either");
  assert.equal(googleMatch({ ...zeitgeist, lat: 37.78 }, results), null);
  assert.equal(googleMatch({ ...zeitgeist, name: "Elbo Room" }, results), null, "nearby, but another name");
  assert.equal(googleMatch(zeitgeist, [{ ...results[0], businessStatus: "CLOSED_PERMANENTLY" }]), null);
  assert.equal(googleMatch(zeitgeist, [{ ...results[0], location: undefined }]), null);
  assert.equal(googleMatch(zeitgeist, undefined), null);
  assert.equal(googleMatch(zeitgeist, []), null);
});

test("similarNames: equal, a typo, or one name inside the other, but not a short fragment", () => {
  assert.ok(similarNames("Bloom's Saloon", "Blooms Saloon"));
  assert.ok(similarNames("The Fillmore", "Fillmore"));
  assert.ok(similarNames("El Rio", "El Rio SF"));
  assert.ok(similarNames("Tartine Bakery", "Tartine Bakery & Cafe"));
  assert.ok(similarNames("Zeitgeistt", "Zeitgeist"));
  assert.ok(!similarNames("Bar", "Bar Agricole"));
  assert.ok(!similarNames("Mission Bar", "Mission Chinese Food"));
  assert.ok(!similarNames("", "Zeitgeist"));
});

test("googleToPatch fills gaps and never overwrites what the row already has", () => {
  assert.deepEqual(googleToPatch({}, results[0]), {
    googlePlaceId: results[0].id, externalRating: 4.4, externalRatingCount: 5312,
    hours: "Mo-Su 09:00-02:00", priceLevel: 1, website: "https://www.zeitgeistsf.com/", phone: "(415) 255-7505",
  });
  const handSet = { hours: "Mo-Su 09:00-02:00; PH off", priceLevel: 2, website: "https://zeitgeist.example", phone: "+1 415 000 0000" };
  assert.deepEqual(googleToPatch(handSet, results[0]), { googlePlaceId: results[0].id, externalRating: 4.4, externalRatingCount: 5312 });
  assert.deepEqual(googleToPatch({}, { id: "x", rating: 9, priceLevel: "PRICE_LEVEL_UNSPECIFIED", websiteUri: "ftp://x" }), { googlePlaceId: "x" });
  assert.deepEqual(searchBody({ ...zeitgeist, city: "San Francisco" }), {
    textQuery: "Zeitgeist, San Francisco", pageSize: 5,
    locationBias: { circle: { center: { latitude: 37.77, longitude: -122.4221 }, radius: 200 } },
  });
});

test("candidates are ranked or seeded places without hours; apply patches only gaps and logs the lookup", async () => {
  const ctx = fakeCtx();
  const place = (over) => ctx.db.insert("places", { name: "P", category: "nightlife", lat: 37.77, lng: -122.42, source: "osm", ...over });
  const userId = await ctx.db.insert("users", {});
  const ranked = await place({ name: "Ranked, no hours", elo: 1.2, nComparisons: 3 });
  const rankedWithHours = await place({ name: "Ranked, has hours", hours: "24/7" });
  const seeded = await place({ name: "Seeded", source: "seed", website: "https://hand.example" });
  await place({ name: "Unranked OSM place" });
  await place({ name: "Already matched", source: "seed", googlePlaceId: "g0" });
  for (const placeId of [ranked, rankedWithHours]) {
    await ctx.db.insert("rankings", { userId, category: "nightlife", bucket: "loved", position: 1, score: 9, placeId });
  }
  const found = await run(google.candidates, ctx, {});
  assert.deepEqual(found.map((c) => c.name), ["Ranked, no hours", "Seeded"]);

  const patch = googleToPatch(found[1], results[0]);
  const applied = await run(google.apply, ctx, { patches: [{ placeId: seeded, ...patch }], checked: [ranked, seeded] });
  assert.deepEqual(applied, { patched: 1 });
  const after = await ctx.db.get(seeded);
  assert.equal(after.website, "https://hand.example", "the hand-set website stays");
  assert.deepEqual([after.hours, after.externalRating, after.googlePlaceId, after.source, after.name], ["Mo-Su 09:00-02:00", 4.4, results[0].id, "seed", "Seeded"]);
  const untouched = await ctx.db.get(ranked);
  assert.deepEqual([untouched.elo, untouched.nComparisons, untouched.hours], [1.2, 3, undefined]);
  assert.deepEqual(await run(google.candidates, ctx, {}), [], "nothing is looked up again within 30 days");
});

test("without GOOGLE_MAPS_KEY the enrichment skips and says so", async () => {
  const saved = process.env.GOOGLE_MAPS_KEY;
  delete process.env.GOOGLE_MAPS_KEY;
  try {
    assert.deepEqual(await run(google.enrichPlaces, {}, {}), { skipped: "no GOOGLE_MAPS_KEY" });
  } finally {
    if (saved !== undefined) process.env.GOOGLE_MAPS_KEY = saved;
  }
});
