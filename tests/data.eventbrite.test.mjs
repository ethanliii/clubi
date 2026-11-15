import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture, jsonFixture, load } from "./fixtures/load.mjs";

// Fixtures are trimmed copies of real responses fetched on 2026-11-15:
//   eventbrite-listing.html  https://www.eventbrite.com/d/ca--san-francisco/events--today/
//   eventbrite-browse.html   https://www.eventbrite.com/b/ca--san-francisco/music/
//   eventbrite-detail.json   GET /v3/events/<id>/?expand=venue,category,subcategory,format,ticket_availability
const { eventbriteDetailToRow, eventbriteToRow, listingEvents, listingPaths, serverData, zonedToEpoch } = await load("imports/eventbrite");

const now = Date.parse("2026-11-15T20:00:00Z");
const listed = listingEvents(fixture("eventbrite-listing.html"));
const rows = listed.map((event) => eventbriteToRow(event, now));
const named = (start) => rows.find((row) => row?.name.startsWith(start));

test("zonedToEpoch turns a local wall-clock time into the right instant, across daylight saving", () => {
  assert.equal(zonedToEpoch("2026-11-15", "16:00", "America/Los_Angeles"), Date.parse("2026-11-16T00:00:00Z"));
  assert.equal(zonedToEpoch("2026-07-04", "21:30", "America/Los_Angeles"), Date.parse("2026-07-05T04:30:00Z"));
  assert.equal(zonedToEpoch("2026-11-15", "16:00", "America/New_York"), Date.parse("2026-11-15T21:00:00Z"));
  assert.equal(zonedToEpoch("2026-11-01", "00:30", "America/Los_Angeles"), Date.parse("2026-11-01T07:30:00Z"));
  assert.equal(zonedToEpoch("2026-11-15", undefined, "UTC"), Date.parse("2026-11-15T00:00:00Z"));
  assert.ok(Number.isNaN(zonedToEpoch("soon", "16:00", "America/Los_Angeles")));
  assert.ok(Number.isNaN(zonedToEpoch("2026-11-15", "16:00", "Mars/Olympus")));
  assert.ok(Number.isNaN(zonedToEpoch(undefined, "16:00", "UTC")));
});

test("listingEvents finds every embedded event once, on both page shapes", () => {
  assert.equal(listed.length, 7);
  assert.ok(listed.every((event) => /^\d+$/.test(event.eventbrite_event_id)));
  const browse = listingEvents(fixture("eventbrite-browse.html"));
  assert.deepEqual(browse.map((event) => event.name.slice(0, 12)), ["The Foundry ", "PRIME - Naug"]);
  assert.deepEqual(listingEvents("<html>blocked</html>"), []);
  assert.deepEqual(listingEvents("window.__SERVER_DATA__ = {not json};\n"), []);
  assert.equal(serverData(""), null);
});

test("eventbriteToRow maps a real listing event", () => {
  const row = named("LESBIAN LUBE WRESTLING");
  assert.equal(row.source, "eventbrite");
  assert.equal(row.sourceId, "2003558514451");
  assert.equal(row.start, Date.parse("2026-11-16T00:00:00Z"));
  assert.equal(row.end, Date.parse("2026-11-16T02:00:00Z"));
  assert.equal(row.lat, 37.77200880000001);
  assert.equal(row.lng, -122.4143809);
  assert.equal(row.venueName, "OASIS");
  assert.equal(row.city, "San Francisco");
  assert.equal(row.address, "298 11th Street, San Francisco, CA 94103");
  assert.equal(row.category, "culture");
  assert.ok(row.sourceUrl.endsWith("-tickets-2003558514451"));
  assert.equal(row.ticketUrl, row.sourceUrl);
  assert.ok(row.imageUrl.startsWith("https://img.evbuc.com/"));
  assert.ok(row.blurb.length > 20 && row.blurb.length <= 200);
  assert.equal(row.price, undefined, "the listing has no price");
  assert.equal(row.venueVector.length, 13);
  assert.ok(row.venueVector.every((x) => x >= 0 && x <= 1));
});

test("Eventbrite categories and formats map to ours", () => {
  assert.equal(named("Fall SF International Tea Festival").category, "food");
  assert.equal(named("ASTIG Sound").category, "live");
  assert.equal(named("Jaime French").category, "culture");
  assert.equal(named("Latin Sundays").category, "nightlife", "a music party is nightlife");
  assert.equal(named("VALÉ").category, "live");
  const [mija, prime] = listingEvents(fixture("eventbrite-browse.html")).map((event) => eventbriteToRow(event, now));
  assert.equal(mija.category, "nightlife", "a DJ set is nightlife");
  assert.equal(prime.category, "nightlife");
});

test("performers come only from titles that read as a bill", () => {
  const performers = (start) => named(start).performers?.map((p) => p.name);
  assert.deepEqual(performers("Jaime French"), ["Jaime French"]);
  assert.equal(named("Jaime French").performers[0].kind, "comedian");
  assert.deepEqual(performers("VALÉ"), ["VALÉ"]);
  assert.deepEqual(named("VALÉ").performers[0].genres, ["Latin"]);
  assert.deepEqual(performers("[Concert] Bay Puddles"), ["Bay Puddles Women's Jazz Band", "Yiying"]);
  assert.equal(performers("ASTIG Sound"), undefined);
  assert.equal(performers("Latin Sundays"), undefined);
  assert.equal(performers("LESBIAN LUBE WRESTLING"), undefined, "not a music event");
  const [mija, prime] = listingEvents(fixture("eventbrite-browse.html")).map((event) => eventbriteToRow(event, now));
  assert.deepEqual(mija.performers.map((p) => p.name), ["Mija"]);
  assert.equal(prime.performers, undefined);
});

test("online, cancelled, private, unlocated, past and far-future events are dropped", () => {
  const base = listed[0];
  assert.ok(eventbriteToRow(base, now));
  assert.equal(eventbriteToRow({ ...base, is_online_event: true }, now), null);
  assert.equal(eventbriteToRow({ ...base, is_cancelled: true }, now), null);
  assert.equal(eventbriteToRow({ ...base, is_protected_event: true }, now), null);
  assert.equal(eventbriteToRow({ ...base, primary_venue: null }, now), null);
  assert.equal(eventbriteToRow({ ...base, primary_venue: { name: "TBA", address: { city: "San Francisco" } } }, now), null);
  assert.equal(eventbriteToRow({ ...base, primary_venue: { name: "Nowhere", address: { latitude: "0", longitude: "0" } } }, now), null);
  assert.equal(eventbriteToRow({ ...base, name: "  " }, now), null);
  assert.equal(eventbriteToRow({ ...base, start_date: "2027-03-01", end_date: "2027-03-01" }, now), null);
  assert.equal(eventbriteToRow({ ...base, start_date: "2026-11-01", end_date: "2026-11-01" }, now), null);
  assert.equal(eventbriteToRow({ ...base, start_date: undefined }, now), null);
  assert.equal(eventbriteToRow({ ...base, timezone: "Not/AZone" }, now), null);
  assert.equal(eventbriteToRow({}, now), null);
});

test("eventbriteDetailToRow maps a real API response, with the price", () => {
  const detail = jsonFixture("eventbrite-detail.json");
  const row = eventbriteDetailToRow(detail, now);
  const fromListing = named("LESBIAN LUBE WRESTLING");
  assert.equal(row.price, 0);
  for (const key of ["sourceId", "name", "start", "end", "lat", "lng", "venueName", "city", "address", "category", "sourceUrl", "blurb"]) {
    assert.deepEqual(row[key], fromListing[key], key);
  }
  const paid = { ...detail, ticket_availability: { minimum_ticket_price: { major_value: "25.50" } } };
  assert.equal(eventbriteDetailToRow(paid, now).price, 25.5);
  assert.equal(eventbriteDetailToRow({ ...detail, is_free: true }, now).price, 0);
  assert.equal(eventbriteDetailToRow({ ...detail, ticket_availability: null }, now).price, undefined);
  assert.equal(eventbriteDetailToRow({ ...detail, online_event: true }, now), null);
  assert.equal(eventbriteDetailToRow({ ...detail, status: "canceled" }, now), null);
  assert.equal(eventbriteDetailToRow({ ...detail, listed: false }, now), null);
  assert.equal(eventbriteDetailToRow({ ...detail, venue: null }, now), null);
  assert.equal(eventbriteDetailToRow({ error: "NOT_FOUND", status_code: 404 }, now), null);
});

test("nothing personal is kept: no organizer fields in a row or in the fixtures", () => {
  const text = JSON.stringify(rows) + fixture("eventbrite-listing.html") + fixture("eventbrite-browse.html") + fixture("eventbrite-detail.json");
  assert.ok(!/organizer|organization_id|email|token/i.test(text));
});

test("listing pages stay on paths robots.txt allows", () => {
  for (const path of listingPaths("ca--san-francisco")) {
    assert.match(path, /^\/(d|b)\/ca--san-francisco\//);
    assert.ok(!/[?&](i|x|id|calendar)/.test(path), path);
  }
});
