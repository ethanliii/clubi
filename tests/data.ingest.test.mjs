import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeCtx, run } from "./fixtures/fakeDb.mjs";
import { load } from "./fixtures/load.mjs";

const { upsertBatch } = await load("ingest");
const performers = await load("performers");
const { recordPerformerAffinity, notifyPerformerFans } = performers;

const DAY = 24 * 60 * 60 * 1000;
// One clock reading for the whole file, so the same show() is the same row every time.
const T0 = Date.now();
const soon = (days) => T0 + days * DAY;
const MIDWAY = { lat: 37.7494, lng: -122.3866 };

const show = (over = {}) => ({
  source: "ticketmaster",
  sourceId: "tm-1",
  name: "Calvin Harris",
  category: "live",
  ...MIDWAY,
  city: "San Francisco",
  start: soon(20),
  venueName: "The Midway",
  performers: [{ name: "Calvin Harris", sourceId: "K8vZ9", genres: ["Dance/Electronic", "House"], imageUrl: "https://img.example/ch.jpg", kind: "artist" }],
  ...over,
});
const events = (ctx, rows) => run(upsertBatch, ctx, { kind: "event", rows });
const notes = (ctx, userId) => ctx.all("notifications").filter((n) => n.userId === userId && n.type === "artist_event");

async function fanOf(ctx, over = {}) {
  const userId = await ctx.db.insert("users", { username: "ethan", homeCity: "San Francisco", ...over });
  await events(ctx, [show({ sourceId: "tm-old", start: soon(1), name: "Calvin Harris at The Midway" })]);
  const [first] = ctx.all("events");
  await recordPerformerAffinity(ctx, { userId, eventId: first._id, score: 9.4 });
  return userId;
}

test("a new event stores its performers, links them, finds its venue and stamps createdAt", async () => {
  const ctx = fakeCtx();
  const placeId = await ctx.db.insert("places", { name: "The Midway", category: "nightlife", lat: MIDWAY.lat + 0.0005, lng: MIDWAY.lng, source: "seed" });
  await ctx.db.insert("places", { name: "The Midway", category: "nightlife", lat: MIDWAY.lat + 0.01, lng: MIDWAY.lng });
  const before = Date.now();
  const counts = await events(ctx, [show({ performers: [...show().performers, { name: "  " }, { name: "DJ Seinfeld" }, { name: "calvin harris" }] })]);
  assert.equal(counts.inserted, 1);
  const [event] = ctx.all("events");
  assert.deepEqual(event.performerNames, ["Calvin Harris", "DJ Seinfeld"]);
  assert.equal(event.venueName, "The Midway");
  assert.equal(event.placeId, placeId);
  assert.ok(event.createdAt >= before);
  const stored = ctx.all("performers");
  assert.deepEqual(stored.map((p) => p.normalizedName), ["calvin harris", "dj seinfeld"]);
  assert.deepEqual(stored[0].genres, ["Dance/Electronic", "House"]);
  assert.equal(stored[0].vector.length, 13);
  assert.equal(stored[0].source, "ticketmaster");
  assert.deepEqual(ctx.all("eventPerformers").map((l) => [l.eventId, l.performerId, l.start]), stored.map((p) => [event._id, p._id, event.start]));
});

test("the same performer is reused across events and sources, and gaps are filled, not overwritten", async () => {
  const ctx = fakeCtx();
  await events(ctx, [show({ source: "eventbrite", sourceId: "eb-1", name: "Calvin Harris at The Midway", performers: [{ name: "Calvin Harris" }] })]);
  assert.equal(ctx.all("performers")[0].genres, undefined);
  await events(ctx, [show({ start: soon(40) })]);
  await events(ctx, [show({ sourceId: "tm-2", start: soon(60), performers: [{ name: "Calvin Harris", genres: ["Pop"], imageUrl: "https://img.example/other.jpg" }] })]);
  const [performer, ...others] = ctx.all("performers");
  assert.equal(others.length, 0);
  assert.deepEqual(performer.genres, ["Dance/Electronic", "House"]);
  assert.equal(performer.imageUrl, "https://img.example/ch.jpg");
  assert.equal(ctx.all("eventPerformers").length, 3);
});

test("a title-only row links performers we already have and never creates one", async () => {
  const ctx = fakeCtx();
  await events(ctx, [{ source: "luma", sourceId: "l1", name: "Peggy Gou at 1015 Folsom", category: "live", ...MIDWAY, start: soon(3) }]);
  assert.equal(ctx.all("performers").length, 0);
  assert.equal(ctx.all("events")[0].performerNames, undefined);
  await events(ctx, [show()]);
  await events(ctx, [
    { source: "luma", sourceId: "l2", name: "Calvin Harris at The Midway", category: "popup", ...MIDWAY, start: soon(50) },
    { source: "luma", sourceId: "l3", name: "DJ Calvin Harris", category: "popup", ...MIDWAY, start: soon(51) },
  ]);
  assert.equal(ctx.all("performers").length, 1);
  const linked = ctx.all("events").filter((e) => e.source === "luma" && e.performerNames);
  assert.deepEqual(linked.map((e) => e.performerNames), [["Calvin Harris"], ["Calvin Harris"]]);
});

test("the artist alert: a fan hears once about a new event, with the contract's text", async () => {
  const ctx = fakeCtx();
  const userId = await fanOf(ctx);
  assert.equal(notes(ctx, userId).length, 0, "the event they ranked does not alert them");
  const start = Date.UTC(2027, 0, 10, 4); // Sat Jan 9, 8 pm Pacific
  const realNow = Date.now;
  Date.now = () => Date.UTC(2026, 11, 1);
  try {
    await events(ctx, [show({ start })]);
    const [note] = notes(ctx, userId);
    const event = ctx.all("events").find((e) => e.sourceId === "tm-1");
    assert.equal(note.title, "Calvin Harris is coming to San Francisco");
    assert.equal(note.body, "Sat Jan 9 · The Midway · you rated them 9.4");
    assert.equal(note.link, `/venue/event/${event._id}`);
    assert.equal(note.read, false);
    assert.equal(ctx.all("affinities")[0].lastNotifiedEventId, event._id);

    await events(ctx, [show({ start, imageUrl: "https://img.example/new.jpg", blurb: "Doors at 9" })]);
    assert.equal(ctx.all("events").find((e) => e.sourceId === "tm-1").imageUrl, "https://img.example/new.jpg");
    await events(ctx, [show({ start })]);
    await notifyPerformerFans(ctx, event._id);
    assert.equal(notes(ctx, userId).length, 1, "updates and repeats never notify again");
  } finally {
    Date.now = realNow;
  }
});

test("no alert for another city, a lukewarm rating, a past event, or someone already going", async () => {
  const far = fakeCtx();
  const visitor = await fanOf(far, { homeCity: "New York" });
  await events(far, [show()]);
  assert.equal(notes(far, visitor).length, 0);

  const meh = fakeCtx();
  const lukewarm = await meh.db.insert("users", { homeCity: "San Francisco" });
  await events(meh, [show({ sourceId: "tm-old", start: soon(1) })]);
  await recordPerformerAffinity(meh, { userId: lukewarm, eventId: meh.all("events")[0]._id, score: 6 });
  await events(meh, [show()]);
  assert.equal(notes(meh, lukewarm).length, 0);

  const going = fakeCtx();
  const keen = await fanOf(going);
  await events(going, [show({ performers: [], name: "Secret Show" })]);
  const event = going.all("events").find((e) => e.sourceId === "tm-1");
  await going.db.insert("saves", { userId: keen, targetKind: "event", targetId: event._id, type: "going", createdAt: Date.now() });
  await events(going, [show({ name: "Secret Show" })]);
  assert.deepEqual(going.all("events").find((e) => e.sourceId === "tm-1").performerNames, ["Calvin Harris"]);
  assert.equal(notes(going, keen).length, 0);
});

test("an event that gains its line-up later alerts then, and only then", async () => {
  const ctx = fakeCtx();
  const userId = await fanOf(ctx);
  await events(ctx, [show({ performers: [], name: "Mystery Headliner Night" })]);
  assert.equal(notes(ctx, userId).length, 0);
  await events(ctx, [show({ name: "Mystery Headliner Night" })]);
  assert.equal(notes(ctx, userId).length, 1);
  await events(ctx, [show({ name: "Mystery Headliner Night", performers: [...show().performers, { name: "Fisher" }] })]);
  assert.equal(notes(ctx, userId).length, 1);
  assert.equal(ctx.all("eventPerformers").filter((l) => l.eventId === ctx.all("events")[1]._id).length, 2);
});

test("at most 2 artist alerts a day, a home city is optional, followers count, under-21s never get nightlife", async () => {
  const ctx = fakeCtx();
  const userId = await fanOf(ctx, { homeCity: undefined });
  await events(ctx, [1, 2, 3].map((n) => show({ sourceId: `tm-${n}`, name: `Calvin Harris night ${n}`, start: soon(10 * n) })));
  assert.equal(notes(ctx, userId).length, 2);

  const club = fakeCtx();
  const adult = await club.db.insert("users", { homeCity: "SF", birthday: "1990-01-01" });
  const minor = await club.db.insert("users", { homeCity: "SF", birthday: new Date(Date.now() - 19 * 365 * DAY).toISOString().slice(0, 10) });
  await events(club, [show({ sourceId: "tm-old", start: soon(1) })]);
  const [performer] = club.all("performers");
  for (const id of [adult, minor]) await run(performers.follow, club.as(id), { performerId: performer._id, follow: true });
  await events(club, [show({ category: "nightlife" })]);
  assert.equal(notes(club, adult).length, 1);
  assert.equal(notes(club, adult)[0].body.endsWith("you follow them"), true);
  assert.equal(notes(club, minor).length, 0);
});

test("recordPerformerAffinity: headliner takes the full step, support half, repeats average", async () => {
  const ctx = fakeCtx();
  const userId = await ctx.db.insert("users", {});
  await events(ctx, [show({ performers: [{ name: "Calvin Harris" }, { name: "Disclosure" }] })]);
  const [event] = ctx.all("events");
  await recordPerformerAffinity(ctx, { userId, eventId: event._id, score: 9 });
  let rows = ctx.all("affinities");
  assert.deepEqual(rows.map((r) => [r.score, r.nRankings, r.following]), [[9, 1, false], [7, 1, false]]);
  await recordPerformerAffinity(ctx, { userId, eventId: event._id, score: 5 });
  rows = ctx.all("affinities");
  assert.equal(rows[0].score, 7);
  assert.equal(rows[0].nRankings, 2);
  await recordPerformerAffinity(ctx, { userId, eventId: event._id, score: NaN });
  assert.equal(ctx.all("affinities")[0].nRankings, 2);
});

test("performer queries return PerformerCard shapes with the next event", async () => {
  const ctx = fakeCtx();
  const userId = await fanOf(ctx);
  await events(ctx, [show(), show({ sourceId: "tm-3", start: soon(45), name: "Calvin Harris: Night Two" })]);
  const me = ctx.as(userId);
  const [performer] = ctx.all("performers");
  const next = ctx.all("events").sort((a, b) => a.start - b.start)[0];

  const [card] = await run(performers.search, me, { text: "calvin" });
  assert.deepEqual(card, {
    performerId: performer._id,
    name: "Calvin Harris",
    imageUrl: "https://img.example/ch.jpg",
    genres: ["Dance/Electronic", "House"],
    following: false,
    affinity: 9.4,
    nextEvent: { id: next._id, title: next.title, startsAt: next.start, venueName: "The Midway" },
  });
  assert.deepEqual(await run(performers.search, me, { text: "  " }), []);
  assert.deepEqual(await run(performers.search, ctx.as(null), { text: "calvin" }), []);

  const detail = await run(performers.get, me, { performerId: performer._id });
  assert.equal(detail.upcoming.length, 3);
  assert.ok(detail.upcoming[0].startsAt <= detail.upcoming[1].startsAt);
  assert.equal(await run(performers.get, ctx.as(null), { performerId: performer._id }), null);

  assert.deepEqual((await run(performers.forEvent, me, { eventId: next._id })).map((c) => c.name), ["Calvin Harris"]);
  assert.deepEqual((await run(performers.following, me, {})).map((c) => c.name), ["Calvin Harris"]);

  await assert.rejects(run(performers.follow, ctx.as(null), { performerId: performer._id, follow: true }), /Not signed in/);
  const other = await ctx.db.insert("users", {});
  assert.deepEqual(await run(performers.following, ctx.as(other), {}), []);
  assert.equal(await run(performers.follow, ctx.as(other), { performerId: performer._id, follow: true }), null);
  const followed = await run(performers.following, ctx.as(other), {});
  assert.equal(followed[0].following, true);
  assert.equal(followed[0].affinity, undefined);
  await run(performers.follow, ctx.as(other), { performerId: performer._id, follow: false });
  assert.deepEqual(await run(performers.following, ctx.as(other), {}), []);
  assert.equal(ctx.all("affinities").length, 2, "unfollowing clears the flag and keeps the row");
});

test("the catch-up alert reaches someone who followed after the event was imported", async () => {
  const ctx = fakeCtx();
  await events(ctx, [show()]);
  const userId = await ctx.db.insert("users", { homeCity: "Oakland" });
  const [performer] = ctx.all("performers");
  await run(performers.follow, ctx.as(userId), { performerId: performer._id, follow: true });
  assert.deepEqual(await run(performers.alertRecentFans, ctx, {}), { checked: 1, alerted: 1 });
  assert.deepEqual(await run(performers.alertRecentFans, ctx, {}), { checked: 1, alerted: 0 });
  assert.equal(notes(ctx, userId)[0].title, "Calvin Harris is coming to San Francisco");
});

test("imports never touch what Brain owns, and unchanged rows are left alone", async () => {
  const ctx = fakeCtx();
  await events(ctx, [show()]);
  const [event] = ctx.all("events");
  await ctx.db.patch(event._id, { elo: 1.5, nComparisons: 4, learnedVector: [1, 2, 3] });
  assert.equal((await events(ctx, [show()])).unchanged, 1);
  assert.equal((await events(ctx, [show({ blurb: "New" })])).updated, 1);
  const after = ctx.all("events")[0];
  assert.deepEqual([after.elo, after.nComparisons, after.learnedVector, after.createdAt], [1.5, 4, [1, 2, 3], event.createdAt]);
  const dropped = await events(ctx, [show({ sourceId: "old", start: Date.now() - 2 * DAY }), show({ sourceId: "nameless", name: " " })]);
  assert.equal(dropped.dropped, 2);
});

test("a later, thinner read of the same event keeps the price and image it had", async () => {
  const ctx = fakeCtx();
  const { knownSourceIds } = await load("ingest");
  await events(ctx, [show({ source: "eventbrite", sourceId: "eb-9", price: 25, imageUrl: "https://img.example/a.jpg" })]);
  assert.equal((await events(ctx, [show({ source: "eventbrite", sourceId: "eb-9" })])).unchanged, 1);
  assert.equal((await events(ctx, [show({ source: "eventbrite", sourceId: "eb-9", price: 30 })])).updated, 1);
  const [event] = ctx.all("events");
  assert.deepEqual([event.price, event.imageUrl], [30, "https://img.example/a.jpg"]);
  assert.deepEqual(
    await run(knownSourceIds, ctx, { kind: "event", source: "eventbrite", sourceIds: ["eb-9", "eb-10", "eb-9"] }),
    ["eb-9"],
  );
});
