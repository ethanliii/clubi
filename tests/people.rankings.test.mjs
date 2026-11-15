import assert from "node:assert/strict";
import { test } from "node:test";
import { backend, fixtures, load, taste } from "./people.harness.mjs";

const rankings = await load("rankings");
const notifications = await load("notifications");

async function world() {
  const t = backend();
  const f = fixtures(t);
  const me = await f.user("ethan", { homeCity: "San Francisco" });
  const friend = await f.user("bryan");
  await f.friends(me, friend);
  const bars = [];
  for (const name of ["Alpha", "Beta", "Gamma", "Delta"]) {
    bars.push(await f.place(name, { venueVector: taste({ 0: 0.9, 1: bars.length / 4 }) }));
  }
  const rank = (userId, id, extra = {}) =>
    t.run(rankings.rank, userId, { kind: "place", id, bucket: "loved", position: 1, comparisons: [], tags: [], ...extra });
  return { t, f, me, friend, bars, rank };
}

test("rank numbers and scores a bucket, returns the overall position and creates a friends-only post", async () => {
  const { t, me, bars, rank } = await world();
  const first = await rank(me, bars[0]);
  assert.deepEqual([first.score, first.position, first.outOf], [8.4, 1, 1]);
  assert.equal(first.label, "#1 of your bars · 8.4");
  const second = await rank(me, bars[1], { position: 1, comparisons: [{ winnerId: bars[1], loserId: bars[0] }] });
  assert.deepEqual([second.score, second.position, second.outOf], [9.2, 1, 2]);
  const fine = await rank(me, bars[2], { bucket: "fine", position: 1 });
  assert.deepEqual([fine.position, fine.outOf], [3, 3]);
  const list = await t.run(rankings.listInBucket, me, { category: "nightlife", bucket: "loved" });
  assert.deepEqual(list.map((item) => [item.name, item.position, item.score]), [["Beta", 1, 9.2], ["Alpha", 2, 7.5]]);
  const posts = t.all("posts");
  assert.equal(posts.length, 3);
  assert.ok(posts.every((post) => post.visibility === "friends" && post.userId === me));
  const row = t.all("rankings").find((ranking) => ranking.placeId === bars[0]);
  assert.equal(row.wasLocal, true);
});

test("rank refuses signed-out callers, bad comparisons, bad group sizes and missing targets", async () => {
  const { t, me, bars, rank } = await world();
  await assert.rejects(rank(null, bars[0]), /Not signed in/);
  await assert.rejects(rank(me, bars[0], { comparisons: [{ winnerId: bars[0], loserId: bars[1] }] }), /already ranked/);
  await assert.rejects(rank(me, bars[0], { groupSize: 0 }), /Group size/);
  await assert.rejects(rank(me, bars[0], { groupSize: 2.5 }), /Group size/);
  await assert.rejects(rank(me, bars[0], { caption: "x".repeat(501) }), /caption/);
  await t.db.delete(bars[3]);
  await assert.rejects(rank(me, bars[3]), /no longer exists/);
  assert.equal(t.all("rankings").length, 0);
});

test("a re-rank does not teach the model twice from comparisons it already saw", async () => {
  const { t, me, bars, rank } = await world();
  await rank(me, bars[0]);
  const comparisons = [{ winnerId: bars[1], loserId: bars[0] }];
  await rank(me, bars[1], { comparisons });
  const afterFirst = { user: await t.db.get(me), place: await t.db.get(bars[1]), stored: t.all("comparisons").length };
  assert.equal(afterFirst.stored, 1);
  assert.equal(afterFirst.place.nComparisons, 1);

  // Same place, same bucket, same comparison again: nothing is learned and nothing is stored.
  const again = await rank(me, bars[1], { comparisons: [...comparisons, ...comparisons] });
  assert.equal(t.all("comparisons").length, 1);
  assert.equal((await t.db.get(bars[1])).nComparisons, 1);
  assert.equal((await t.db.get(bars[0])).nComparisons, 1);
  assert.deepEqual((await t.db.get(me)).tasteVector, afterFirst.user.tasteVector);
  assert.equal(t.all("rankings").length, 2);
  assert.equal(t.all("posts").length, 2);
  assert.equal(again.position, 1);

  // A flipped outcome is new information: it is stored and taught once.
  await rank(me, bars[1], { position: 2, comparisons: [{ winnerId: bars[0], loserId: bars[1] }] });
  assert.equal(t.all("comparisons").length, 2);
  assert.equal((await t.db.get(bars[1])).nComparisons, 2);
  const list = await t.run(rankings.listInBucket, me, { category: "nightlife", bucket: "loved" });
  assert.deepEqual(list.map((item) => item.name), ["Alpha", "Beta"]);
});

test("the bucket nudge runs once per bucket, again only when the bucket changes", async () => {
  const { t, me, bars, rank } = await world();
  await rank(me, bars[0]);
  const loved = (await t.db.get(me)).tasteVector;
  assert.notDeepEqual(loved, taste());
  await rank(me, bars[0]);
  assert.deepEqual((await t.db.get(me)).tasteVector, loved);
  await rank(me, bars[0], { bucket: "didnt" });
  assert.notDeepEqual((await t.db.get(me)).tasteVector, loved);
  assert.equal(t.all("rankings").length, 1);
  assert.equal(t.all("rankings")[0].bucket, "didnt");
});

test("a re-rank keeps the post, its photos and its place in the feed", async () => {
  const { t, me, bars, rank } = await world();
  await rank(me, bars[0], { caption: " first ", photoStorageId: "_storage|a" });
  const before = t.all("posts")[0];
  assert.equal(before.caption, "first");
  await rank(me, bars[0], { bucket: "fine" });
  let after = t.all("posts")[0];
  assert.deepEqual([after.caption, after.photos, after.createdAt, after.visibility], ["first", ["_storage|a"], before.createdAt, "friends"]);
  await rank(me, bars[0], { caption: "second", photoStorageId: "_storage|b", visibility: "public" });
  after = t.all("posts")[0];
  assert.deepEqual([after.caption, after.photos, after.visibility], ["second", ["_storage|a", "_storage|b"], "public"]);
  await rank(me, bars[0]);
  assert.equal(t.all("posts")[0].visibility, "public");
});

test("visibility defaults to the user's setting, groupSize is saved, and a private post notifies nobody", async () => {
  const { t, me, friend, bars, rank } = await world();
  await rank(me, bars[0], { visibility: "private", groupSize: 4 });
  assert.equal(t.all("posts")[0].visibility, "private");
  assert.equal(t.all("rankings")[0].groupSize, 4);
  assert.equal(t.all("notifications").length, 0);

  await t.db.patch(me, { defaultVisibility: "public" });
  await rank(me, bars[1]);
  assert.equal(t.all("posts")[1].visibility, "public");
  const sent = t.all("notifications");
  assert.equal(sent.length, 1);
  assert.deepEqual([sent[0].userId, sent[0].type, sent[0].actorId], [friend, "friend_posted", me]);
  assert.match(sent[0].title, /^ethan ranked Beta #1 · 9\.2$/);

  // A re-rank does not notify again.
  await rank(me, bars[1], { position: 2 });
  assert.equal(t.all("notifications").length, 1);
});

test("friends who ranked the same place hear \"…and you gave it\", and prefs silence it", async () => {
  const { t, f, me, friend, bars, rank } = await world();
  const quiet = await f.user("quiet", { notifPrefs: { friendPosts: false } });
  await f.friends(quiet, me);
  await rank(friend, bars[0]);
  t.db.table("notifications").clear();
  await rank(me, bars[0]);
  const sent = t.all("notifications");
  assert.equal(sent.length, 1);
  assert.deepEqual([sent[0].userId, sent[0].type, sent[0].body], [friend, "friend_ranked_same", "…and you gave it 8.4"]);
});

test("ranking an event works and lands in its own category", async () => {
  const { t, f, me } = await world();
  const show = await f.event("Late Show");
  const result = await t.run(rankings.rank, me, { kind: "event", id: show, bucket: "loved", position: 1, comparisons: [], tags: [" loud ", "loud", ""] });
  assert.equal(result.label, "#1 of your shows · 8.4");
  const row = t.all("rankings")[0];
  assert.deepEqual([row.eventId, row.placeId, row.category, row.tags], [show, undefined, "live", ["loud"]]);
});

test("mine lists best first with the overall position, one category or all", async () => {
  const { t, f, me, bars, rank } = await world();
  await rank(me, bars[0]);
  await rank(me, bars[1], { position: 2 });
  await rank(me, bars[2], { bucket: "didnt" });
  const food = await f.place("Taqueria", { category: "food", imageUrl: "https://img.test/t.jpg" });
  await rank(me, food);
  const nightlife = await t.run(rankings.mine, me, { category: "nightlife" });
  assert.deepEqual(nightlife.map((item) => [item.name, item.position, item.bucket]), [["Alpha", 1, "loved"], ["Beta", 2, "loved"], ["Gamma", 3, "didnt"]]);
  const all = await t.run(rankings.mine, me, {});
  assert.deepEqual(all.map((item) => item.name), ["Alpha", "Taqueria", "Beta", "Gamma"]);
  assert.equal(all.find((item) => item.name === "Taqueria").imageUrl, "https://img.test/t.jpg");
  assert.equal(all.find((item) => item.name === "Taqueria").position, 1);
  assert.ok(all.every((item) => item.kind === "place" && typeof item.rankedAt === "number"));
  assert.deepEqual(await t.run(rankings.mine, null, {}), []);
});

test("remove deletes the ranking and its post, then closes the gap with rank's own scores", async () => {
  const { t, me, friend, bars, rank } = await world();
  await rank(me, bars[0]);
  await rank(me, bars[1], { position: 2, photoStorageId: "_storage|p" });
  await rank(me, bars[2], { position: 3 });
  const middle = t.all("rankings").find((row) => row.placeId === bars[1]);
  const post = t.all("posts").find((row) => row.rankingId === middle._id);
  await t.db.insert("reactions", { postId: post._id, userId: friend, emoji: "❤️" });
  await t.db.insert("comments", { postId: post._id, userId: friend, text: "yes", createdAt: 1 });

  await assert.rejects(t.run(rankings.remove, friend, { rankingId: middle._id }), /your own/);
  await assert.rejects(t.run(rankings.remove, null, { rankingId: middle._id }), /Not signed in/);
  assert.equal(await t.run(rankings.remove, me, { rankingId: middle._id }), null);

  const left = await t.run(rankings.listInBucket, me, { category: "nightlife", bucket: "loved" });
  assert.deepEqual(left.map((item) => [item.name, item.position, item.score]), [["Alpha", 1, 9.2], ["Gamma", 2, 7.5]]);
  assert.equal(t.all("posts").length, 2);
  assert.equal(t.all("reactions").length, 0);
  assert.equal(t.all("comments").length, 0);
  assert.ok(t.deletedFiles.has("_storage|p"));
  // Removing it twice is not an error.
  assert.equal(await t.run(rankings.remove, me, { rankingId: middle._id }), null);
});

test("notifications: list, unread count, markRead only touches my own row", async () => {
  const { t, me, friend, bars, rank } = await world();
  await rank(me, bars[0]);
  await rank(me, bars[1]);
  assert.equal(await t.run(notifications.unreadCount, friend), 2);
  const list = await t.run(notifications.list, friend);
  assert.equal(list.length, 2);
  assert.equal(list[0].actor.displayName, "ethan");
  assert.equal(list[0].link, `/venue/place/${bars[1]}`);
  await t.run(notifications.markRead, me, { id: list[0].id });
  assert.equal(await t.run(notifications.unreadCount, friend), 2);
  await t.run(notifications.markRead, friend, { id: list[0].id });
  assert.equal(await t.run(notifications.unreadCount, friend), 1);
  await assert.rejects(t.run(notifications.markRead, null, { id: list[0].id }), /Not signed in/);
  await t.run(notifications.markAllRead, friend);
  assert.equal(await t.run(notifications.unreadCount, friend), 0);
});

test("notify returns null for the actor themself, a switched-off pref or a missing user", async () => {
  const { t, f, me, friend } = await world();
  const ctx = t.ctx(me);
  const base = { type: "post_reaction", title: "t", body: "b" };
  assert.equal(await notifications.notify(ctx, { ...base, userId: me, actorId: me }), null);
  const off = await f.user("off", { notifPrefs: { reactions: false } });
  assert.equal(await notifications.notify(ctx, { ...base, userId: off, actorId: me }), null);
  assert.notEqual(await notifications.notify(ctx, { ...base, userId: off, actorId: me, type: "friend_request" }), null);
  await t.db.delete(friend);
  assert.equal(await notifications.notify(ctx, { ...base, userId: friend, actorId: me }), null);
  assert.equal(t.all("notifications").length, 1);
});
