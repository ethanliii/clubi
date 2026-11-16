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

test("googleMatch needs both a matching name and 120 metres", () => {
  assert.equal(googleMatch(zeitgeist, results)?.id, results[0].id);
  assert.equal(googleMatch({ name: "Zeitgeist Coffee", lat: 37.7799, lng: -122.4101 }, results)?.id, results[1].id, "the namesake 1.5 km away is its own place");
  assert.equal(googleMatch({ ...zeitgeist, name: "Zeitgeist Coffee", lat: 37.775 }, results), null, "right name, 500 m from either");
  assert.equal(googleMatch({ ...zeitgeist, lat: 37.78 }, results), null);
  assert.equal(googleMatch({ ...zeitgeist, lat: zeitgeist.lat + 0.0009 }, results)?.id, results[0].id, "100 m off is still the place");
  assert.equal(googleMatch({ ...zeitgeist, lat: zeitgeist.lat + 0.0013 }, results), null, "145 m off is not");
  assert.equal(googleMatch({ ...zeitgeist, name: "Elbo Room" }, results), null, "nearby, but another name");
  assert.equal(googleMatch(zeitgeist, [{ ...results[0], businessStatus: "CLOSED_PERMANENTLY" }]), null);
  assert.equal(googleMatch(zeitgeist, [{ ...results[0], location: undefined }]), null);
  assert.equal(googleMatch(zeitgeist, undefined), null);
  assert.equal(googleMatch(zeitgeist, []), null);
});

test("nameStrength: a name inside the other or the same first telling word is a match, a shared common word is not", () => {
  const { nameStrength } = google;
  assert.equal(nameStrength("Niku", "Niku Steakhouse"), 2);
  assert.equal(nameStrength("21st Amendment Brewery", "21st Amendment Brewery & Restaurant"), 2);
  assert.equal(nameStrength("Zeitgeist", "Zeitgeist"), 2);
  assert.equal(nameStrength("Jackson Park", "Jackson Playground Park"), 1);
  assert.equal(nameStrength("Harmonic Brewing", "Harmonic Brewing - Dogpatch"), 2);
  assert.equal(nameStrength("Farley's", "Farleys Coffee"), 2);
  assert.equal(nameStrength("Bar", "Bar Agricole"), 0);
  assert.equal(nameStrength("Mission Bar", "Mission Chinese Food"), 0);
  assert.equal(nameStrength("Mission Creek Park", "Mission Bay Commons Park"), 0);
  assert.equal(nameStrength("Elbo Room", "Zeitgeist"), 0);
  assert.equal(nameStrength("The Pub", "The Ramp"), 0);
  assert.equal(nameStrength("21st Amendment Brewery", "21st Street Coffee"), 0, "a number alone proves nothing");
  assert.equal(nameStrength("", "Zeitgeist"), 0);
});

test("googleVerdict: the surest name wins over the nearest, and a surely-matching closed result closes the place", () => {
  const { googleVerdict } = google;
  const at = (meters) => ({ latitude: zeitgeist.lat + meters / 111320, longitude: zeitgeist.lng });
  const result = (id, text, meters, businessStatus = "OPERATIONAL") => ({ id, displayName: { text }, location: at(meters), businessStatus });
  const place = { ...zeitgeist, name: "Jackson Park" };
  assert.equal(googleVerdict(place, [result("a", "Jackson Playground Park", 2), result("b", "Jackson Park", 90)]).match.id, "b");
  assert.equal(googleVerdict(place, [result("a", "Jackson Playground Park", 2)]).match.id, "a");
  assert.deepEqual(googleVerdict(place, [result("a", "Jackson Park", 5, "CLOSED_PERMANENTLY")]), { match: null, closed: true });
  assert.deepEqual(googleVerdict(place, [result("a", "Jackson Park", 5, "CLOSED_PERMANENTLY"), result("b", "Jackson Fillmore Trattoria", 20)]), { match: null, closed: true }, "a loose open match does not outweigh the place itself being closed");
  assert.equal(googleVerdict(place, [result("a", "Jackson Park", 5, "CLOSED_PERMANENTLY"), result("b", "Jackson Park", 20)]).match.id, "b", "reopened under the same name");
  assert.deepEqual(googleVerdict(place, [result("a", "Jackson Playground Park", 5, "CLOSED_PERMANENTLY")]), { match: null, closed: false }, "a loose match is not enough to close a place");
  assert.deepEqual(googleVerdict(place, [result("a", "Jackson Park", 500, "CLOSED_PERMANENTLY")]), { match: null, closed: false });
  // Any telling word in common is enough within 75 m, and only there.
  const lusk = { ...zeitgeist, name: "Twenty Five Lusk" };
  assert.equal(googleVerdict(lusk, [result("a", "25 Lusk", 16)]).match.id, "a");
  assert.equal(googleVerdict(lusk, [result("a", "25 Lusk", 100)]).match, null);
  assert.equal(googleVerdict({ ...zeitgeist, name: "Rolph Playground" }, [result("a", "James Rolph Jr. Playground", 69)]).match.id, "a");
  assert.equal(googleVerdict({ ...zeitgeist, name: "Mission Creek Park" }, [result("a", "Mission Creek Basketball Court", 20)]).match, null);
  assert.equal(googleVerdict({ ...zeitgeist, name: "El Trebol #2" }, [result("a", "El TREBOLITO Resturant bar", 7)]).match, null);
});

test("similarNames: equal, a typo, or one name inside the other, but not a short fragment", () => {
  assert.ok(similarNames("Bloom's Saloon", "Blooms Saloon"));
  assert.ok(similarNames("The Fillmore", "Fillmore"));
  assert.ok(similarNames("El Rio", "El Rio SF"));
  assert.ok(similarNames("Tartine Bakery", "Tartine Bakery & Cafe"));
  assert.ok(similarNames("Zeitgeistt", "Zeitgeist"));
  assert.ok(similarNames("Building 12 at Pier 70", "Pier 70 Building 12"), "the same words in another order");
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
  const found = await run(google.enrichmentCandidates, ctx, {});
  assert.deepEqual(found.map((c) => c.name), ["Ranked, no hours", "Seeded"]);

  const patch = googleToPatch(found[1], results[0]);
  const applied = await run(google.applyEnrichment, ctx, { patches: [{ placeId: seeded, ...patch }], checked: [ranked, seeded] });
  assert.deepEqual(applied, { patched: 1 });
  const after = await ctx.db.get(seeded);
  assert.equal(after.website, "https://hand.example", "the hand-set website stays");
  assert.deepEqual([after.hours, after.externalRating, after.googlePlaceId, after.source, after.name], ["Mo-Su 09:00-02:00", 4.4, results[0].id, "seed", "Seeded"]);
  const untouched = await ctx.db.get(ranked);
  assert.deepEqual([untouched.elo, untouched.nComparisons, untouched.hours], [1.2, 3, undefined]);
  assert.deepEqual(await run(google.enrichmentCandidates, ctx, {}), [], "nothing is looked up again within 30 days");
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

const shot = (id, widthPx, heightPx, ...authors) => ({
  name: `places/g1/photos/${id}`, widthPx, heightPx, authorAttributions: authors.map((displayName) => ({ displayName })),
});

test("bestPhoto takes the first wide landscape photo of the leading five, else the first; the credit names its authors", () => {
  const { bestPhoto, photoAttribution, photoMediaUrl } = google;
  const portrait = shot("a", 3000, 4000, "Ana Lopez");
  const small = shot("b", 640, 480);
  const wide = shot("c", 4000, 3000, "Bo Chen", " ", "Cy Diaz", "Di Eze");
  assert.equal(bestPhoto([portrait, small, wide]), wide);
  assert.equal(bestPhoto([portrait, small]), portrait, "nothing wide: Google's first");
  assert.equal(bestPhoto([portrait, small, small, small, small, wide]), portrait, "only the leading five are considered");
  assert.equal(bestPhoto([{ name: "https://evil.example/x" }, { widthPx: 900, heightPx: 600 }]), null, "a photo needs a Places photo name");
  assert.equal(bestPhoto(undefined), null);
  assert.equal(photoAttribution(portrait), "Photo: Ana Lopez");
  assert.equal(photoAttribution(wide), "Photo: Bo Chen, Cy Diaz");
  assert.equal(photoAttribution(small), undefined);
  assert.equal(photoMediaUrl(wide.name), "https://places.googleapis.com/v1/places/g1/photos/c/media?maxWidthPx=800");
});

test("photoOrder merges the lists best first, position by position", () => {
  const { photoOrder, PHOTO_LISTS } = google;
  assert.deepEqual(PHOTO_LISTS, { all: 60, tonight: 60, bars: 60, food: 60, outdoors: 60, events: 60 });
  // An event (null) holds its position; a place in two lists takes its earlier turn.
  assert.deepEqual(photoOrder({ all: [null, "a", "b", "c"], bars: ["b", "d"], outdoors: ["e"] }), ["b", "e", "a", "d", "c"]);
  const ids = (prefix, n) => Array.from({ length: n }, (_, i) => prefix + i);
  const order = photoOrder({ all: ids("all", 60), bars: ids("bar", 60), food: ids("food", 60) });
  const first90 = order.slice(0, 90);
  assert.deepEqual(["all", "bar", "food"].map((p) => first90.filter((id) => id.startsWith(p)).length), [30, 30, 30]);
  assert.deepEqual(photoOrder({}), []);
});

test("photo candidates: the plan, then ranked, seeded and the rest by distance; never one with an image, a demo pop-up, closed for good, or already checked", async () => {
  const ctx = fakeCtx();
  ctx.storage = { deleted: [], delete: async (id) => void ctx.storage.deleted.push(id) };
  const place = (over) => ctx.db.insert("places", { name: "P", category: "food", lat: 37.76, lng: -122.39, source: "osm", ...over });
  const planned = await place({ name: "Planned" });
  const matched = await place({ name: "Has a Google id", googlePlaceId: "g7" });
  const handSet = await place({ name: "Hand-set image", imageUrl: "https://hand.example/a.jpg" });
  const searchedBefore = await place({ name: "Searched before, no match" });
  const seeded = await place({ name: "Seeded", source: "seed" });
  await place({ name: "Pop-up (demo pop-up)", source: "seed", tags: ["demo", "party"] });
  await place({ name: "Crane Cove Sunset DJ Set", source: "seed" });
  await place({ name: "Far away", lat: 37.8 });
  await place({ name: "Near the centre", lat: 37.7608, lng: -122.3861 });
  const ranked = await place({ name: "Ranked", lat: 37.9 });
  await place({ name: "Closed for good", permanentlyClosed: true });
  const userId = await ctx.db.insert("users", { homeCity: "San Francisco" });
  await ctx.db.insert("rankings", { userId, category: "food", bucket: "loved", position: 1, score: 9, placeId: ranked });
  // A search by the hours enrichment that found nothing no longer holds a place back.
  await run(google.applyEnrichment, ctx, { patches: [], checked: [searchedBefore] });
  const ids = [planned, matched, handSet, searchedBefore];
  const first = await run(google.photoCandidates, ctx, { ids, limit: 2 });
  assert.deepEqual([first.places.map((c) => c.name), first.waiting, first.tiers], [["Planned", "Has a Google id"], 7, { lists: 3, ranked: 1, seeded: 1, rest: 2 }]);
  const everything = await run(google.photoCandidates, ctx, { ids, limit: 10 });
  assert.deepEqual(everything.places.map((c) => c.name), ["Planned", "Has a Google id", "Searched before, no match", "Ranked", "Seeded", "Near the centre", "Far away"]);
  assert.equal(everything.places[1].googlePlaceId, "g7");

  const photo = (n) => ({ storageId: `_storage:${n}`, url: `https://files.test/${n}`, attribution: "Photo: Ana Lopez" });
  assert.deepEqual(await run(google.savePhotoResult, ctx, { placeId: planned, searched: true, settled: true, found: { googlePlaceId: "g1", hours: "24/7" }, photo: photo(1) }), { patched: true, stored: true });
  const after = await ctx.db.get(planned);
  assert.deepEqual([after.imageUrl, after.imageStorageId, after.imageAttribution, after.hours, after.googlePlaceId], ["https://files.test/1", "_storage:1", "Photo: Ana Lopez", "24/7", "g1"]);
  // A hand-set image is never replaced: the downloaded file is thrown away.
  assert.deepEqual(await run(google.savePhotoResult, ctx, { placeId: handSet, searched: false, settled: true, photo: photo(2) }), { patched: false, stored: false });
  assert.equal((await ctx.db.get(handSet)).imageUrl, "https://hand.example/a.jpg");
  assert.deepEqual(ctx.storage.deleted, ["_storage:2"]);
  // No photo on Google: settled, so not asked again. A failed download (not settled) is tried again.
  await run(google.savePhotoResult, ctx, { placeId: seeded, searched: true, settled: true });
  await run(google.savePhotoResult, ctx, { placeId: matched, searched: false, settled: false });
  assert.deepEqual((await run(google.photoCandidates, ctx, { ids, limit: 3 })).places.map((c) => c.name), ["Has a Google id", "Searched before, no match", "Ranked"]);
});

test("the lookup logs are stored as lists, so they can pass the 1024 fields a Convex object may hold", async () => {
  const ctx = fakeCtx();
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push(await ctx.db.insert("places", { name: "P" + i, category: "food", lat: 37.76, lng: -122.39 }));
  // A log written in the old object form is read, and rewritten as a list.
  await ctx.db.insert("appConfig", { key: "googleChecked", value: { [ids[0]]: 5 } });
  await run(google.savePhotoResult, ctx, { placeId: ids[1], searched: true, settled: true, miss: "P1: no results" });
  await run(google.savePhotoResult, ctx, { placeId: ids[2], searched: true, settled: true, miss: "P2: no results" });
  const stored = Object.fromEntries(ctx.all("appConfig").map((row) => [row.key, row.value]));
  for (const key of ["googleChecked", "googlePhotoChecked2", "googlePhotoMissNotes"]) assert.ok(Array.isArray(stored[key]), key);
  assert.deepEqual(stored.googleChecked.map(([id]) => id).sort(), [...ids].sort());
  assert.deepEqual(stored.googlePhotoMissNotes, [[ids[1], "P1: no results"], [ids[2], "P2: no results"]]);
  assert.deepEqual((await run(google.photoMisses, ctx, {})).noMatch, ["P1: no results", "P2: no results"]);
  assert.deepEqual((await run(google.photoCandidates, ctx, { ids, limit: 5 })).places.map((c) => c.name), ["P0"]);
});

test("the photo budget counts each request before it is made and refuses at the cap", async () => {
  const ctx = fakeCtx();
  const { MAX_PHOTO_LOOKUPS, MAX_PHOTO_FETCHES } = google;
  assert.deepEqual([MAX_PHOTO_LOOKUPS, MAX_PHOTO_FETCHES], [1500, 1500]);
  assert.deepEqual(await run(google.photoBudget, ctx, {}), { lookups: 0, photos: 0, maxLookups: 1500, maxPhotos: 1500 });
  assert.deepEqual(await run(google.reservePhotoCall, ctx, { kind: "lookup" }), { ok: true });
  assert.deepEqual(await run(google.reservePhotoCall, ctx, { kind: "photo" }), { ok: true });
  assert.deepEqual(await run(google.reservePhotoCall, ctx, { kind: "photo" }), { ok: true });
  const row = ctx.all("appConfig").find((c) => c.key === "googlePhotoBudget");
  await ctx.db.patch(row._id, { value: { lookups: 1500, photos: 1499 } });
  assert.deepEqual(await run(google.reservePhotoCall, ctx, { kind: "lookup" }), { ok: false });
  assert.deepEqual(await run(google.reservePhotoCall, ctx, { kind: "photo" }), { ok: true });
  assert.deepEqual(await run(google.reservePhotoCall, ctx, { kind: "photo" }), { ok: false });
  assert.deepEqual(await run(google.photoBudget, ctx, {}), { lookups: 1500, photos: 1500, maxLookups: 1500, maxPhotos: 1500 });
});
