import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeCtx, run } from "./fixtures/fakeDb.mjs";
import { fixture, jsonFixture, load } from "./fixtures/load.mjs";

// Under-21 users never get nightlife, and the app hides by `category === "nightlife"`. These tests
// are about one thing: an adults-only event must be stored as nightlife, whatever its source called it.
const { ageGate, upsertBatch } = await load("ingest");
const performers = await load("performers");
const eventbrite = await load("imports/eventbrite");
const partiful = await load("imports/partiful");
const ticketmaster = await load("imports/ticketmaster");
const luma = await load("imports/luma");

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.now();
const HERE = { lat: 37.7716, lng: -122.4136 };
const row = (over = {}) => ({ source: "luma", sourceId: "e1", name: "Community Gathering", category: "popup", ...HERE, start: T0 + 3 * DAY, ...over });
const events = (ctx, rows) => run(upsertBatch, ctx, { kind: "event", rows });
const stored = (ctx, sourceId) => ctx.all("events").find((e) => e.sourceId === sourceId);
const birthdayAged = (years) => new Date(T0 - years * 365.25 * DAY).toISOString().slice(0, 10);

test("ageGate: saying 21+ outright, in any of the usual ways", () => {
  for (const text of ["21+", "21 +", "21 and over", "21 & up", "21 or older", "Ages 21+", "must be 21", "Must be at least 21 to enter", "over 21", "strictly 21", "21 to drink", "Adults only", "adult-only"]) {
    assert.equal(ageGate({ title: "Show", description: `Doors at 8. ${text}. No refunds.` }), "adults", text);
    assert.equal(ageGate({ title: `Show (${text})` }), "adults", text);
  }
  assert.equal(ageGate({ title: "Show", ageRestriction: "21+" }), "adults");
  assert.equal(ageGate({ title: "Show", ageRestriction: "ALL_AGES" }), "open");
  assert.equal(ageGate({ title: "Show", ageRestriction: null }), undefined);
});

test("ageGate: real titles that a source filed under arts, food or community", () => {
  for (const title of [
    "Hunk-O-Mania Male Revue Show - San Francisco",
    "Drag Queen Sip and Paint San Francisco",
    "Art Party for Date | Paint and Sip Class",
    "Drag Queen Party Bus San Francisco - The Ultimate Night Out",
    "Banda Day Party: Banda, Perreo y Corridos",
    "Mission Bar Crawl",
    "Sunset Happy Hour for Founders",
    "Bottomless Mimosa Brunch",
    "Natural Wine Tasting with the Winemaker",
    "Whiskey 101",
    "Halloween Rave",
    "Burlesque Bingo",
    "The Official Afterparty",
    "A CLUB CALLED RHONDA w/ DRAMA ( DJ Set) - More TBA",
  ]) {
    assert.equal(ageGate({ title }), "adults", title);
  }
  for (const [title, venueName] of [
    ["Hayes Valley Comedy Night", "El Toro Night Club"],
    ["Open Mic", "The Cigar Bar & Grill"],
    ["Trivia", "Zeitgeist Beer Garden"],
    ["Book Launch", "Royal Cuckoo Organ Lounge"],
    ["Live Jazz", "Mr. Tipple's Jazz Club and Cocktails"],
    ["Quiz Night", "Harmonic Brewing"],
  ]) {
    assert.equal(ageGate({ title, venueName }), "adults", `${title} at ${venueName}`);
  }
});

test("ageGate: ordinary events are left alone, and saying all ages wins over a guess", () => {
  for (const [title, venueName, description] of [
    ["Fall SF International Tea Festival 2026", "Ferry Building Marketplace"],
    ["Finding Your Creative Voice in Challenging Times", "The C.G. Jung Institute"],
    ["Makeup and Hair Masterclass", "ERIA Marina"],
    ["Saturday Run Club", "Kezar Stadium"],
    ["Founders Fireside", "Notion HQ", "Talk at 6, happy hour to follow."],
    ["Barbershop Quartet Night", "Community Hall"],
    ["Candy Barn Opening", "Barbary Coast Trail"],
    ["Kids Science Day", "Exploratorium"],
  ]) {
    assert.equal(ageGate({ title, venueName, description }), undefined, title);
  }
  assert.equal(ageGate({ title: "All Ages Punk Matinee", venueName: "Bottom of the Hill Bar" }), "open");
  assert.equal(ageGate({ title: "Emo Night", venueName: "DNA Lounge", description: "18+ with ID" }), "open");
  assert.equal(ageGate({ title: "Family-friendly Beer Garden Afternoon" }), "open");
  assert.equal(ageGate({ title: "All Ages Show", description: "Bar area is 21+ only" }), "adults", "an outright 21+ beats everything");
});

test("an adults-only event is stored as nightlife whatever the source called it", async () => {
  const ctx = fakeCtx();
  await events(ctx, [
    row({ sourceId: "said", category: "culture", name: "Stand-up Showcase", blurb: "Doors 7pm. 21+ with valid ID." }),
    row({ sourceId: "title", category: "food", name: "Mission Bar Crawl", start: T0 + 4 * DAY }),
    row({ sourceId: "venue", category: "live", name: "Songwriter Round", venueName: "Lost Weekend Lounge", start: T0 + 5 * DAY }),
    row({ sourceId: "flag", category: "popup", name: "Supper Club", minAge: 21, start: T0 + 6 * DAY }),
    row({ sourceId: "open", category: "live", name: "All Ages Matinee", venueName: "Thee Parkside Bar", start: T0 + 7 * DAY }),
    row({ sourceId: "plain", category: "culture", name: "Gallery Talk", start: T0 + 8 * DAY }),
  ]);
  const got = (id) => [stored(ctx, id).category, stored(ctx, id).minAge];
  assert.deepEqual(got("said"), ["nightlife", 21]);
  assert.deepEqual(got("title"), ["nightlife", 21]);
  assert.deepEqual(got("venue"), ["nightlife", 21]);
  assert.deepEqual(got("flag"), ["nightlife", 21]);
  assert.deepEqual(got("open"), ["live", undefined]);
  assert.deepEqual(got("plain"), ["culture", undefined]);
});

test("an event at a bar or club in the catalog is nightlife, even when nothing in its text says so", async () => {
  const ctx = fakeCtx();
  await ctx.db.insert("places", { name: "Oasis", category: "nightlife", subcategory: "nightclub", ...HERE, source: "osm" });
  await ctx.db.insert("places", { name: "Root Division", category: "culture", lat: HERE.lat + 0.01, lng: HERE.lng, source: "osm" });
  const wrestling = row({ sourceId: "w", category: "culture", name: "Lube Wrestling: A Fundraiser", venueName: "OASIS" });
  const artTalk = row({ sourceId: "a", category: "culture", name: "Art Stars Networking", venueName: "Root Division", lat: HERE.lat + 0.01, start: T0 + 4 * DAY });
  const allAges = row({ sourceId: "k", category: "live", name: "All Ages Drag Brunch", venueName: "Oasis", start: T0 + 5 * DAY });
  await events(ctx, [wrestling, artTalk, allAges]);
  assert.deepEqual([stored(ctx, "w").category, stored(ctx, "w").minAge], ["nightlife", 21]);
  assert.equal(stored(ctx, "a").category, "culture");
  assert.equal(stored(ctx, "k").category, "live", "the event's own word beats where it is held");

  // The same rows again change nothing: the category does not flip back and forth between runs.
  const again = await events(ctx, [wrestling, artTalk, allAges]);
  assert.deepEqual([again.unchanged, again.updated], [3, 0]);
});

test("a venue that reaches the catalog after the event still makes it nightlife on the next change", async () => {
  const ctx = fakeCtx();
  const show = row({ sourceId: "late", category: "live", name: "Songwriter Round", venueName: "El Rio" });
  await events(ctx, [show]);
  assert.equal(stored(ctx, "late").category, "live");
  await ctx.db.insert("places", { name: "El Rio", category: "nightlife", ...HERE, source: "osm" });
  await events(ctx, [{ ...show, blurb: "Now with an opener" }]);
  assert.deepEqual([stored(ctx, "late").category, stored(ctx, "late").minAge], ["nightlife", 21]);
  assert.equal((await events(ctx, [{ ...show, blurb: "Now with an opener" }])).unchanged, 1);
});

test("when one source knows it is 21+, the row another source owns becomes nightlife and stays so", async () => {
  const ctx = fakeCtx();
  const lumaRow = row({ sourceId: "l1", category: "popup", name: "Supper Series", sourceUrl: "https://lu.ma/supper", imageUrl: "https://x/1.jpg", address: "1 Main St", blurb: "Dinner and a talk" });
  await events(ctx, [lumaRow]);
  assert.equal(stored(ctx, "l1").category, "popup");
  const ebRow = row({ source: "eventbrite", sourceId: "eb1", category: "food", name: "Supper Series", minAge: 21, sourceUrl: "https://www.eventbrite.com/e/1" });
  assert.equal((await events(ctx, [ebRow])).duplicate, 1);
  assert.deepEqual([stored(ctx, "l1").category, stored(ctx, "l1").minAge], ["nightlife", 21]);
  // Luma reads the event again and still says "popup": it must not undo what Eventbrite told us.
  assert.equal((await events(ctx, [lumaRow])).unchanged, 1);
  assert.equal((await events(ctx, [{ ...lumaRow, imageUrl: "https://x/2.jpg" }])).updated, 1);
  assert.deepEqual([stored(ctx, "l1").category, stored(ctx, "l1").minAge], ["nightlife", 21]);
  assert.equal(ctx.all("events").length, 1);

  // A kept row that says "all ages" itself is not overruled by a guess from another source.
  const open = fakeCtx();
  await events(open, [row({ sourceId: "l2", category: "live", name: "All Ages Matinee", imageUrl: "https://x/1.jpg", address: "1 Main St", blurb: "Bands", sourceUrl: "https://lu.ma/m" })]);
  await events(open, [row({ source: "eventbrite", sourceId: "eb2", category: "nightlife", name: "All Ages Matinee" })]);
  assert.equal(stored(open, "l2").category, "live");
});

test("an under-21 fan is never told about, or shown, an adults-only event", async () => {
  const ctx = fakeCtx();
  const adult = await ctx.db.insert("users", { homeCity: "San Francisco", birthday: birthdayAged(30) });
  const minor = await ctx.db.insert("users", { homeCity: "San Francisco", birthday: birthdayAged(19) });
  const noBirthday = await ctx.db.insert("users", { homeCity: "San Francisco" });
  const act = { performers: [{ name: "Peggy Gou", genres: ["House"] }] };
  await events(ctx, [row({ source: "ticketmaster", sourceId: "all-ages", category: "live", name: "Peggy Gou: All Ages Matinee", ...act })]);
  const [performer] = ctx.all("performers");
  for (const id of [adult, minor, noBirthday]) await run(performers.follow, ctx.as(id), { performerId: performer._id, follow: true });

  // Filed as "live" by the source, but 21+ in the description.
  await events(ctx, [row({ source: "ticketmaster", sourceId: "club", category: "live", name: "Peggy Gou", blurb: "This is a 21 and over event.", start: T0 + 10 * DAY, ...act })]);
  const club = stored(ctx, "club");
  assert.equal(club.category, "nightlife");
  const told = (userId) => ctx.all("notifications").filter((n) => n.userId === userId).length;
  assert.deepEqual([told(adult), told(minor), told(noBirthday)], [1, 0, 1]);

  const upcoming = async (userId) => (await run(performers.get, ctx.as(userId), { performerId: performer._id })).upcoming.map((e) => e.title);
  assert.deepEqual(await upcoming(adult), ["Peggy Gou: All Ages Matinee", "Peggy Gou"]);
  assert.deepEqual(await upcoming(minor), ["Peggy Gou: All Ages Matinee"]);
  assert.deepEqual(await run(performers.forEvent, ctx.as(minor), { eventId: club._id }), []);
  assert.equal((await run(performers.forEvent, ctx.as(adult), { eventId: club._id })).length, 1);
  const allAges = stored(ctx, "all-ages");
  assert.equal((await run(performers.forEvent, ctx.as(minor), { eventId: allAges._id })).length, 1);
  // The catch-up alert follows the same rule.
  await run(performers.alertRecentFans, ctx, {});
  assert.equal(ctx.all("notifications").filter((n) => n.userId === minor && n.link.endsWith(club._id)).length, 0);
});

test("each importer passes on what its source says about age", async () => {
  const now = Date.parse("2026-11-15T20:00:00Z");
  // Eventbrite: real listing rows, then the API's venue age field.
  const listed = eventbrite.listingEvents(fixture("eventbrite-listing.html")).map((e) => eventbrite.eventbriteToRow(e, now));
  const named = (start) => listed.find((r) => r.name.startsWith(start));
  assert.equal(named("Latin Sundays").category, "nightlife");
  assert.equal(named("Fall SF International Tea Festival").minAge, undefined);
  const detail = jsonFixture("eventbrite-detail.json");
  assert.equal(eventbrite.eventbriteDetailToRow(detail, now).category, "culture", "nothing in the real response says 21+");
  const restricted = eventbrite.eventbriteDetailToRow({ ...detail, venue: { ...detail.venue, age_restriction: "21+" } }, now);
  assert.deepEqual([restricted.category, restricted.minAge], ["nightlife", 21]);
  const inSummary = eventbrite.eventbriteDetailToRow({ ...detail, summary: "A fundraiser. 21+ only." }, now);
  assert.deepEqual([inSummary.category, inSummary.minAge], ["nightlife", 21]);
  const allAges = eventbrite.eventbriteDetailToRow({ ...detail, venue: { ...detail.venue, age_restriction: "ALL_AGES" } }, now);
  assert.deepEqual([allAges.category, allAges.minAge], ["culture", undefined]);

  // Partiful: the host's description is read but never stored, so the row carries the answer.
  const cookie = partiful.pageProps(fixture("partiful-explore.html")).trendingSections.SF.items.map((i) => i.event).find((e) => e.title.startsWith("Cookie Picnic"));
  assert.equal(partiful.partifulToRow(cookie, now).minAge, undefined);
  const party = partiful.partifulToRow({ ...cookie, description: "BYOB. Must be 21 to attend." }, now);
  assert.equal(party.minAge, 21);
  assert.ok(!JSON.stringify(party).includes("BYOB"), "and still does not store the description");

  // Ticketmaster: promoters put the rule in the notes.
  const [calvin] = jsonFixture("ticketmaster-events.json")._embedded.events;
  assert.equal(ticketmaster.ticketmasterToRow(calvin, now).minAge, undefined);
  assert.equal(ticketmaster.ticketmasterToRow({ ...calvin, pleaseNote: "This is a 21 and over event. Valid ID required." }, now).minAge, 21);
  assert.equal(ticketmaster.ticketmasterToRow({ ...calvin, ageRestrictions: { legalAgeEnforced: true, ageRuleDescription: "All Ages" } }, now).minAge, undefined);

  // Luma only gives a title and a venue: the ingest decides, from the same rule.
  const entry = jsonFixture("luma-discover.json").entries.find((e) => e.event.name.startsWith("The SF Tea-Rave"));
  const rave = luma.lumaToRow(entry, now);
  assert.equal(rave.category, "live", "Luma's own category");
  const realNow = Date.now;
  Date.now = () => now;
  try {
    const ctx = fakeCtx();
    await events(ctx, [rave, party, restricted]);
    assert.deepEqual(ctx.all("events").map((e) => [e.source, e.category, e.minAge]), [["luma", "nightlife", 21], ["partiful", "nightlife", 21], ["eventbrite", "nightlife", 21]]);
  } finally {
    Date.now = realNow;
  }
});
