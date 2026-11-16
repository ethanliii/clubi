import assert from "node:assert/strict";
import { test } from "node:test";
import { getFunctionName } from "convex/server";
import { actionCtx, fakeCtx, run } from "./fixtures/fakeDb.mjs";
import { fixture, jsonFixture, load } from "./fixtures/load.mjs";

// The import actions themselves, start to finish: the real handlers, the real queries and
// mutations they call, an in-memory database, and `fetch` answered from the saved fixtures.
// What these cannot show is the live sites and Convex itself: tests/fixtures/live-run.mjs runs the
// same actions against the real sites.
const eventbrite = await load("imports/eventbrite");
const luma = await load("imports/luma");
const partiful = await load("imports/partiful");
const ticketmaster = await load("imports/ticketmaster");
const google = await load("imports/google");
const osm = await load("imports/osm");
const { setIngestFrozen } = await load("ingest");

const NOW = Date.parse("2026-11-15T20:00:00Z");
const page = (status, body, type = "application/json") =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": type } });

/** Run `work` with the clock at NOW, no waiting between requests, and `fetch` answered by `answer(url, init)`. */
async function online(answer, work, env = {}) {
  const real = { fetch: globalThis.fetch, setTimeout: globalThis.setTimeout, now: Date.now };
  const savedEnv = Object.fromEntries(["EVENTBRITE_TOKEN", "TICKETMASTER_KEY", "GOOGLE_MAPS_KEY"].map((k) => [k, process.env[k]]));
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    const request = { url: String(url), method: init.method ?? "GET", headers: init.headers ?? {}, body: init.body };
    requests.push(request);
    const response = await answer(request);
    if (response === undefined) throw new Error("network down");
    return response;
  };
  // Waits between requests and retries (1 to 8 seconds) are skipped; request time-outs (15 seconds and up) never fire.
  globalThis.setTimeout = (fn, ms, ...args) => (ms < 10000 ? real.setTimeout(fn, 0, ...args) : real.setTimeout(() => {}, 0));
  Date.now = () => NOW;
  for (const key of Object.keys(savedEnv)) delete process.env[key];
  Object.assign(process.env, env);
  try {
    return { result: await work(), requests };
  } finally {
    globalThis.fetch = real.fetch;
    globalThis.setTimeout = real.setTimeout;
    Date.now = real.now;
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const KEYS = { EVENTBRITE_TOKEN: "test-eventbrite-token", TICKETMASTER_KEY: "test-ticketmaster-key", GOOGLE_MAPS_KEY: "test-google-key" };
const IMPORTS = [
  ["eventbrite", eventbrite.importEventbrite, {}],
  ["luma", luma.importLuma, {}],
  ["partiful", partiful.importPartiful, {}],
  ["ticketmaster", ticketmaster.importTicketmaster, {}],
  ["google", google.enrichPlaces, {}],
  ["osm", osm.importOsm, { lat: 37.76, lng: -122.42, radiusMeters: 500, areaKey: "osmArea:1:1" }],
];
const seededDb = async () => {
  const db = fakeCtx();
  // Something for the Google enrichment to look up.
  await db.db.insert("places", { name: "Zeitgeist", category: "nightlife", lat: 37.77, lng: -122.4221, source: "seed", city: "San Francisco" });
  return db;
};

test("while imports are frozen, no event import or enrichment makes a single request", async () => {
  for (const [name, action, args] of IMPORTS.filter(([n]) => n !== "osm")) {
    const db = await seededDb();
    await run(setIngestFrozen, db, { frozen: true });
    const { result, requests } = await online(() => page(200, {}), () => run(action, actionCtx(db), args), KEYS);
    assert.equal(requests.length, 0, name);
    assert.ok(result.frozen === true || result.skipped === "ingest frozen", name);
    assert.equal(db.all("events").length, 0, name);
  }
});

test("a blocked site or a dead network is reported, never thrown, and writes nothing", async () => {
  for (const [how, answer] of [["403", () => page(403, "Forbidden", "text/html")], ["network down", () => undefined], ["garbage", () => page(200, "<html>Just a moment...</html>", "text/html")]]) {
    for (const [name, action, args] of IMPORTS) {
      const db = await seededDb();
      const { result, requests } = await online(answer, () => run(action, actionCtx(db), args), KEYS);
      const label = `${name}, ${how}`;
      assert.ok(requests.length >= 1, label);
      assert.equal(db.all("events").length, 0, label);
      assert.equal(db.all("places").length, 1, label);
      assert.equal(db.all("places")[0].googlePlaceId, undefined, label);
      assert.ok(!JSON.stringify(result).includes("test-"), `${label}: a key leaked into the result`);
      if (name === "eventbrite") assert.equal(result.blockedPages.length + result.pages, 7, label);
      if (name === "osm") assert.equal(db.all("appConfig").some((c) => c.key === "osmArea:1:1"), false, `${label}: the area must be tried again`);
      if (["luma", "ticketmaster", "osm"].includes(name)) assert.ok(typeof result.error === "string" && result.error.length > 0, `${label}: ${JSON.stringify(result)}`);
      if (name === "google" && how !== "garbage") assert.ok(typeof result.error === "string", `${label}: ${JSON.stringify(result)}`);
    }
  }
});

test("without their keys, Ticketmaster and Google skip; Eventbrite still imports, without prices", async () => {
  const db = await seededDb();
  const answer = ({ url }) => (url.includes("eventbrite.com/d/") ? page(200, fixture("eventbrite-listing.html"), "text/html") : page(404, ""));
  assert.deepEqual((await online(answer, () => run(ticketmaster.importTicketmaster, actionCtx(db), {}))).result, { skipped: "no TICKETMASTER_KEY" });
  assert.deepEqual((await online(answer, () => run(google.enrichPlaces, actionCtx(db), {}))).result, { skipped: "no GOOGLE_MAPS_KEY" });
  const { result, requests } = await online(answer, () => run(eventbrite.importEventbrite, actionCtx(db), {}));
  assert.deepEqual([result.hasToken, result.detailCalls, result.inserted], [false, 0, 7]);
  assert.ok(requests.every((r) => r.url.startsWith("https://www.eventbrite.com/")));
  assert.ok(db.all("events").every((e) => e.price === undefined));
});

test("Eventbrite: listing pages, then one price lookup per new event, with the token sent to the API only", async () => {
  const db = fakeCtx();
  const detail = jsonFixture("eventbrite-detail.json");
  const answer = ({ url }) => {
    if (url.startsWith("https://www.eventbriteapi.com/v3/events/")) {
      const id = url.match(/events\/(\d+)\//)[1];
      return id === detail.id ? page(200, { ...detail, status: "started" }) : page(404, { error: "NOT_FOUND" });
    }
    if (url.includes("/b/")) return page(200, fixture("eventbrite-browse.html"), "text/html");
    return page(200, url.includes("events--today/") && !url.includes("page=2") ? fixture("eventbrite-listing.html") : "<html></html>", "text/html");
  };
  const first = await online(answer, () => run(eventbrite.importEventbrite, actionCtx(db), { detailLimit: 4 }), KEYS);
  assert.deepEqual(
    [first.result.pages, first.result.listed, first.result.newEvents, first.result.detailCalls, first.result.detailFailures, first.result.inserted],
    [7, 9, 9, 4, 3, 9],
  );
  const api = first.requests.filter((r) => r.url.startsWith("https://www.eventbriteapi.com/"));
  const site = first.requests.filter((r) => r.url.startsWith("https://www.eventbrite.com/"));
  assert.equal(api.length, 4);
  assert.ok(api.every((r) => r.headers.Authorization === "Bearer test-eventbrite-token"));
  assert.ok(site.every((r) => r.headers.Authorization === undefined), "the token never goes to the website");
  assert.ok(first.requests.every((r) => !r.url.includes("test-eventbrite-token")), "and never into a URL");
  const priced = db.all("events").find((e) => e.sourceId === detail.id);
  assert.equal(priced.price, 0, "an event that has started still gets its price");
  assert.equal(db.all("events").filter((e) => e.price !== undefined).length, 1);
  assert.ok(db.all("performers").some((p) => p.name === "Mija"));

  // The next run knows every event already: no price lookups, and nothing changes.
  const second = await online(answer, () => run(eventbrite.importEventbrite, actionCtx(db), {}), KEYS);
  assert.deepEqual([second.result.newEvents, second.result.detailCalls, second.result.inserted, second.result.updated, second.result.unchanged], [0, 0, 0, 0, 9]);
  assert.equal((await db.db.get(priced._id)).price, 0, "the price survives a read that has none");
});

test("Luma: pages are followed by cursor, and a failure part-way keeps what was read", async () => {
  const fixturePage = jsonFixture("luma-discover.json");
  const db = fakeCtx();
  const good = await online(
    ({ url }) => page(200, url.includes("pagination_cursor=fixture-cursor") ? { entries: [], has_more: false } : fixturePage),
    () => run(luma.importLuma, actionCtx(db), {}),
  );
  assert.deepEqual([good.result.pages, good.result.fetched, good.result.kept, good.result.inserted, good.result.error], [2, 6, 4, 4, undefined]);
  assert.ok(good.requests[1].url.includes("pagination_cursor=fixture-cursor"));
  assert.deepEqual(db.all("performers").map((p) => p.name), ["Lady Bushra"]);

  const partial = fakeCtx();
  const broken = await online(
    ({ url }) => (url.includes("pagination_cursor") ? page(429, "slow down") : page(200, fixturePage)),
    () => run(luma.importLuma, actionCtx(partial), {}),
  );
  assert.deepEqual([broken.result.pages, broken.result.inserted, broken.result.error], [1, 4, "Luma answered 429"]);
});

test("Partiful: Explore, listed URLs, similar events and geocoding, each address asked once", async () => {
  const db = fakeCtx();
  const eventPage = partiful.pageProps(fixture("partiful-event.html"));
  // Similar events that Explore already listed are not read again.
  const onExplore = partiful.pageProps(fixture("partiful-explore.html")).trendingSections.SF.items.map((item) => item.event.id);
  const similarIds = partiful.similarEventIds(eventPage).filter((id) => !onExplore.includes(id));
  assert.ok(similarIds.length >= 1 && similarIds.length < partiful.similarEventIds(eventPage).length);
  // The listed event, moved inside the 14-day window so it is kept.
  const listed = { ...eventPage, event: { ...eventPage.event, startDate: "2026-11-20T03:00:00.000Z" } };
  const html = (props) => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: props } })}</script>`;
  const answer = ({ url }) => {
    if (url.startsWith("https://nominatim.openstreetmap.org/search")) {
      return page(200, url.includes("1469") ? jsonFixture("nominatim-search.json") : [{ lat: "37.8066", lon: "-122.4302" }]);
    }
    if (url === "https://partiful.com/explore") return page(200, fixture("partiful-explore.html"), "text/html");
    if (url === "https://partiful.com/e/" + listed.event.id) return page(200, html(listed), "text/html");
    return page(200, html({ event: null, passwordRequired: true }), "text/html");
  };
  await run(partiful.setPartifulUrls, db, { urls: ["https://partiful.com/e/" + listed.event.id, "https://evil.example/e/x"] });

  const first = await online(answer, () => run(partiful.importPartiful, actionCtx(db), {}));
  assert.deepEqual(
    [first.result.exploreEvents, first.result.urlsRead, first.result.similarEvents, first.result.kept, first.result.geocoded, first.result.inserted],
    [5, 1 + similarIds.length, similarIds.length, 2, 2, 2],
  );
  const hosts = new Set(first.requests.map((r) => new URL(r.url).host));
  assert.deepEqual([...hosts].sort(), ["nominatim.openstreetmap.org", "partiful.com"]);
  assert.equal(first.requests.filter((r) => r.url.includes("nominatim")).length, 2);
  const market = db.all("events").find((e) => e.title === "Fort Mason Holiday Night Market");
  assert.deepEqual([market.price, market.lat, market.lng, market.tags, market.venueName], [0, 37.8066, -122.4302, [], "Fort Mason Center for Arts & Culture"]);
  const cookie = db.all("events").find((e) => e.title.startsWith("Cookie Picnic"));
  assert.deepEqual([cookie.lat, cookie.lng, cookie.tags], [37.7842604, -122.4313184, []]);

  // Straight away again: the pages were read less than 6 hours ago and both addresses are cached.
  const second = await online(answer, () => run(partiful.importPartiful, actionCtx(db), {}));
  assert.deepEqual(second.requests.map((r) => r.url), ["https://partiful.com/explore"]);
  assert.deepEqual([second.result.inserted, second.result.updated], [0, 0]);
  assert.equal(db.all("events").length, 2);
});

test("Ticketmaster: the key goes in the query to Ticketmaster only, and attractions become performers", async () => {
  const db = fakeCtx();
  const { result, requests } = await online(
    () => page(200, jsonFixture("ticketmaster-events.json")),
    () => run(ticketmaster.importTicketmaster, actionCtx(db), { days: 30 }),
    KEYS,
  );
  assert.deepEqual([result.pages, result.fetched, result.kept, result.withPerformers, result.performers, result.inserted], [1, 6, 3, 2, 4, 3]);
  assert.equal(requests.length, 1);
  const url = new URL(requests[0].url);
  assert.equal(url.host, "app.ticketmaster.com");
  assert.equal(url.searchParams.get("apikey"), "test-ticketmaster-key");
  assert.equal(url.searchParams.get("endDateTime"), "2026-12-15T20:00:00Z");
  assert.ok(!JSON.stringify(result).includes("test-ticketmaster-key"));
  assert.deepEqual(db.all("performers").map((p) => p.name), ["Calvin Harris", "Disclosure", "Golden State Warriors", "Los Angeles Lakers"]);

  const refused = await online(() => page(401, { fault: { faultstring: "Invalid ApiKey" } }), () => run(ticketmaster.importTicketmaster, actionCtx(fakeCtx()), {}), KEYS);
  assert.equal(refused.result.error, "Ticketmaster answered 401");
});

test("Google: one search per place, the key in a header, and only gaps are filled", async () => {
  const db = await seededDb();
  const { result, requests } = await online(() => page(200, jsonFixture("google-textsearch.json")), () => run(google.enrichPlaces, actionCtx(db), {}), KEYS);
  assert.deepEqual(result, { looked: 1, matched: 1, patched: 1, noMatch: 0 });
  assert.equal(requests[0].url, "https://places.googleapis.com/v1/places:searchText");
  assert.equal(requests[0].headers["X-Goog-Api-Key"], "test-google-key");
  assert.equal(JSON.parse(requests[0].body).textQuery, "Zeitgeist, San Francisco");
  const [place] = db.all("places");
  assert.deepEqual([place.hours, place.externalRating, place.priceLevel, place.source], ["Mo-Su 09:00-02:00", 4.4, 1, "seed"]);
  // Nothing left to look up, so the next run asks Google nothing.
  const again = await online(() => page(200, {}), () => run(google.enrichPlaces, actionCtx(db), {}), KEYS);
  assert.deepEqual([again.requests.length, again.result.looked], [0, 0]);
});

test("OpenStreetMap: one Overpass answer becomes places, and the area is marked as imported", async () => {
  const db = fakeCtx();
  const { result, requests } = await online(
    () => page(200, jsonFixture("osm-overpass.json")),
    () => run(osm.importOsm, actionCtx(db), { lat: 37.7609, lng: -122.4214, radiusMeters: 450, areaKey: "osmArea:1888:-6122" }),
  );
  assert.deepEqual([result.fetched, result.inserted, result.error], [9, 9, undefined]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, "POST");
  assert.equal(db.all("appConfig").find((c) => c.key === "osmArea:1888:-6122").value.places, 9);
  assert.ok(db.all("places").find((p) => p.name === "Delfina").website);
});

/** An action ctx with file storage, whose `discover.nearby` answers with the given places at the top of every list. */
function photoCtx(db, nearbyIds) {
  const base = actionCtx(db);
  const stored = [];
  db.storage = { delete: async (id) => void stored.splice(stored.indexOf(id), 1) };
  return {
    ...base,
    stored,
    runQuery: (reference, args) =>
      getFunctionName(reference) === "discover:nearby"
        ? { items: [{ kind: "event", id: "events:1" }, ...nearbyIds.map((id) => ({ kind: "place", id }))] }
        : base.runQuery(reference, args),
    storage: {
      store: async (blob) => (stored.push(`_storage:${blob.type}:${blob.size}`), stored[stored.length - 1]),
      getUrl: async (id) => "https://files.test/" + id,
    },
  };
}
const jpeg = () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), { status: 200, headers: { "Content-Type": "image/jpeg" } });
const photos = [
  { name: "places/ChIJexample0000000000000001/photos/tall", widthPx: 3000, heightPx: 4000, authorAttributions: [{ displayName: "Someone Else" }] },
  { name: "places/ChIJexample0000000000000001/photos/wide", widthPx: 4000, heightPx: 3000, authorAttributions: [{ displayName: "Ana Lopez" }] },
];
/** Google, answering a Text Search, a Place Details and a photo download. */
const googleWithPhotos = ({ url }) => {
  if (url.endsWith("/media?maxWidthPx=800")) return jpeg();
  if (url.endsWith("places:searchText")) {
    const body = jsonFixture("google-textsearch.json");
    body.places[0].photos = photos;
    return page(200, body);
  }
  return page(200, { id: "g-known", photos: [photos[0]] });
};

test("Google photos: one lookup and one download per place, stored in file storage, the key only ever in a header", async () => {
  const db = await seededDb();
  const place = (over) => db.db.insert("places", { name: "P", category: "nightlife", lat: 37.77, lng: -122.4221, source: "osm", city: "San Francisco", ...over });
  const known = await place({ name: "Known to Google", googlePlaceId: "g-known" });
  const handSet = await place({ name: "Hand-set image", imageUrl: "https://hand.example/a.jpg" });
  const stranger = await place({ name: "Elbo Room" });
  const popup = await place({ name: "Dogpatch Vinyl Swap (demo pop-up)", tags: ["demo"] });
  const ctx = photoCtx(db, [popup, known, handSet, stranger]);

  const { result, requests } = await online(googleWithPhotos, () => run(google.enrichPhotos, ctx, {}), KEYS);
  assert.deepEqual(result, {
    planned: 3, waiting: 3, searches: 2, details: 1, photoFetches: 2, stored: 2, noMatch: 1, noPhoto: 0, closed: 0,
    tiers: { lists: 2, ranked: 0, seeded: 1, rest: 0 },
    misses: ['Elbo Room: nearest is "Zeitgeist" at 7 m'],
    budget: { lookups: 3, photos: 2, maxLookups: 1500, maxPhotos: 4800 },
  });
  // What the lists show comes first, then the hand-seeded place.
  assert.deepEqual(requests.map((r) => r.url), [
    "https://places.googleapis.com/v1/places/g-known",
    "https://places.googleapis.com/v1/places/ChIJexample0000000000000001/photos/tall/media?maxWidthPx=800",
    "https://places.googleapis.com/v1/places:searchText",
    "https://places.googleapis.com/v1/places:searchText",
    "https://places.googleapis.com/v1/places/ChIJexample0000000000000001/photos/wide/media?maxWidthPx=800",
  ]);
  assert.ok(requests.every((r) => r.headers["X-Goog-Api-Key"] === "test-google-key" && !r.url.includes("test-google-key")));
  assert.ok(requests[2].headers["X-Goog-FieldMask"].split(",").includes("places.photos"));
  assert.ok(requests[2].headers["X-Goog-FieldMask"].split(",").includes("places.businessStatus"));
  assert.equal(requests[0].headers["X-Goog-FieldMask"], "id,photos,businessStatus");

  const [zeitgeist, ...rest] = db.all("places");
  // The search that found the photo also filled in what the hours enrichment fills in.
  assert.deepEqual([zeitgeist.imageUrl, zeitgeist.imageAttribution, zeitgeist.hours, zeitgeist.externalRating, zeitgeist.googlePlaceId],
    ["https://files.test/_storage:image/jpeg:4", "Photo: Ana Lopez", "Mo-Su 09:00-02:00", 4.4, "ChIJexample0000000000000001"]);
  assert.equal(zeitgeist.imageStorageId, "_storage:image/jpeg:4");
  assert.deepEqual(rest.map((p) => [p.name, p.imageUrl, p.imageAttribution]), [
    ["Known to Google", "https://files.test/_storage:image/jpeg:4", "Photo: Someone Else"],
    ["Hand-set image", "https://hand.example/a.jpg", undefined],
    ["Elbo Room", undefined, undefined],
    ["Dogpatch Vinyl Swap (demo pop-up)", undefined, undefined],
  ]);
  assert.ok(!JSON.stringify(db.all("places")).includes("test-google-key"));

  // Every place is settled: a second run asks Google nothing and spends nothing.
  const again = await online(googleWithPhotos, () => run(google.enrichPhotos, ctx, {}), KEYS);
  assert.deepEqual([again.requests.length, again.result.planned, again.result.budget.lookups, again.result.budget.photos], [0, 0, 3, 2]);
  // And the hours enrichment does not search for a place the photo run already searched for.
  const hoursRun = await online(googleWithPhotos, () => run(google.enrichPlaces, actionCtx(db), {}), KEYS);
  assert.equal(hoursRun.requests.length, 0);
});

test("Google photos stop at the budget, skip when frozen or without a key, and retry a failed download", async () => {
  const spent = await seededDb();
  await spent.db.insert("appConfig", { key: "googlePhotoBudget", value: { lookups: google.MAX_PHOTO_LOOKUPS, photos: 0 } });
  const capped = await online(googleWithPhotos, () => run(google.enrichPhotos, photoCtx(spent, []), {}), KEYS);
  assert.deepEqual([capped.requests.length, capped.result.stopped, capped.result.stored], [0, "lookup budget spent", 0]);

  const noPhotosLeft = await seededDb();
  await noPhotosLeft.db.insert("appConfig", { key: "googlePhotoBudget", value: { lookups: 0, photos: google.MAX_PHOTO_FETCHES } });
  const searchOnly = await online(googleWithPhotos, () => run(google.enrichPhotos, photoCtx(noPhotosLeft, []), {}), KEYS);
  assert.deepEqual([searchOnly.requests.length, searchOnly.result.stopped, searchOnly.result.photoFetches], [1, "photo budget spent", 0]);
  assert.deepEqual([noPhotosLeft.all("places")[0].hours, noPhotosLeft.all("places")[0].imageUrl], ["Mo-Su 09:00-02:00", undefined]);

  const frozen = await seededDb();
  await run(setIngestFrozen, frozen, { frozen: true });
  const held = await online(googleWithPhotos, () => run(google.enrichPhotos, photoCtx(frozen, []), {}), KEYS);
  assert.deepEqual([held.requests.length, held.result], [0, { skipped: "ingest frozen" }]);
  const keylessCtx = photoCtx(await seededDb(), []);
  const keyless = await online(googleWithPhotos, () => run(google.enrichPhotos, keylessCtx, {}));
  assert.deepEqual([keyless.requests.length, keyless.result], [0, { skipped: "no GOOGLE_MAPS_KEY" }]);

  // The download fails (an HTML page, then a 500): the place keeps its Google id and is tried again, by id.
  const flaky = await seededDb();
  const ctx = photoCtx(flaky, []);
  const htmlPicture = (request) => (request.url.includes("/media") ? page(200, "<html>", "text/html") : googleWithPhotos(request));
  const first = await online(htmlPicture, () => run(google.enrichPhotos, ctx, {}), KEYS);
  assert.deepEqual([first.result.error, first.result.stored, flaky.all("places")[0].imageUrl, ctx.stored.length], ["Google Places sent no usable picture", 0, undefined, 0]);
  const second = await online((request) => (request.url.includes("/media") ? page(500, {}) : googleWithPhotos(request)), () => run(google.enrichPhotos, ctx, {}), KEYS);
  assert.deepEqual([second.result.error, second.result.details, second.result.searches], ["Google Places answered 500", 1, 0]);
  const third = await online(googleWithPhotos, () => run(google.enrichPhotos, ctx, {}), KEYS);
  assert.deepEqual([third.result.stored, third.result.budget.lookups, third.result.budget.photos], [1, 3, 3]);
  assert.ok(flaky.all("places")[0].imageUrl.startsWith("https://files.test/"));
});

test("Google photos: a place Google says is closed for good is flagged, kept, hidden from discovery and never looked up again", async () => {
  const { isVisibleTo } = await load("lib/discovery");
  const db = await seededDb();
  const earlier = await db.db.insert("places", { name: "Earlier Miss", category: "food", lat: 37.77, lng: -122.4221, source: "osm" });
  // The first matcher's log no longer holds anything back: its misses get one more lookup.
  await db.db.insert("appConfig", { key: "googlePhotoChecked", value: { [earlier]: 1 } });
  await db.db.insert("appConfig", { key: "googleChecked", value: { [earlier]: 1 } });
  const ctx = photoCtx(db, []);
  const closedDown = (request) => {
    if (!request.url.endsWith("places:searchText")) return googleWithPhotos(request);
    const body = jsonFixture("google-textsearch.json");
    body.places[0].businessStatus = "CLOSED_PERMANENTLY";
    body.places[0].photos = photos;
    return page(200, body);
  };
  const { result, requests } = await online(closedDown, () => run(google.enrichPhotos, ctx, {}), KEYS);
  assert.deepEqual([result.planned, result.closed, result.noMatch, result.stored, result.photoFetches, requests.length], [2, 1, 1, 0, 0, 2]);
  assert.deepEqual(result.misses.sort(), ['Earlier Miss: nearest is "Zeitgeist" at 7 m, closed for good', "Zeitgeist: closed for good on Google"]);
  const [zeitgeist, miss] = db.all("places");
  assert.deepEqual([zeitgeist.permanentlyClosed, zeitgeist.imageUrl, zeitgeist.googlePlaceId, miss.permanentlyClosed], [true, undefined, undefined, undefined]);
  const viewer = { userId: null, taste: [], under21: false };
  assert.equal(isVisibleTo({ kind: "place", doc: zeitgeist }, viewer, NOW), false);
  assert.equal(isVisibleTo({ kind: "place", doc: miss }, viewer, NOW), true);
  assert.deepEqual((await run(google.photoMisses, db, {})).closed, ["Zeitgeist"]);
  const coverage = await run(google.photoCoverage, db, { ids: [zeitgeist._id, miss._id] });
  assert.deepEqual([coverage.permanentlyClosed, coverage.without], [1, ["Zeitgeist [nightlife]: closed for good", 'Earlier Miss [food]: nearest is "Zeitgeist" at 7 m, closed for good']]);
  const again = await online(closedDown, () => run(google.enrichPhotos, ctx, {}), KEYS);
  assert.deepEqual([again.requests.length, again.result.planned], [0, 0]);
});
