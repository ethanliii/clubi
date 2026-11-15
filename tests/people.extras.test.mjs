import assert from "node:assert/strict";
import { test } from "node:test";
import { backend, fixtures, load, taste } from "./people.harness.mjs";

const friends = await load("friends");
const posts = await load("posts");
const profile = await load("profile");
const rankings = await load("rankings");
const cron = await load("notificationsCron");

test("block hides both people from each other everywhere and ends the friendship; unblock restores search", async () => {
  const t = backend();
  const f = fixtures(t);
  const me = await f.user("ethan", { homeCity: "San Francisco" });
  const bryan = await f.user("bryan", { homeCity: "San Francisco", defaultVisibility: "public" });
  const mutual = await f.user("cara");
  await f.friends(me, bryan);
  await f.friends(me, mutual);
  await f.friends(mutual, bryan);
  const bar = await f.place("Zeitgeist");
  await t.run(rankings.rank, bryan, { kind: "place", id: bar, bucket: "loved", position: 1, comparisons: [], tags: [], visibility: "public" });
  const postId = t.all("posts")[0]._id;
  await t.run(posts.addComment, bryan, { postId, text: "mine" });
  assert.equal((await t.run(posts.friendsFeed, me)).length, 1);

  await assert.rejects(t.run(friends.block, me, { userId: me }), /can't block yourself/);
  await assert.rejects(t.run(friends.block, null, { userId: bryan }), /Not signed in/);
  await t.run(friends.block, me, { userId: bryan });
  await t.run(friends.block, me, { userId: bryan });
  assert.equal(t.all("blocks").length, 1);
  assert.equal(t.all("friendships").length, 2);

  // Both directions: search, suggestions (they share a mutual friend), feed, the public post, the profile.
  for (const [viewer, other, name] of [[me, bryan, "bryan"], [bryan, me, "ethan"]]) {
    assert.deepEqual(await t.run(friends.search, viewer, { text: name }), []);
    assert.deepEqual(await t.run(friends.suggestions, viewer, {}), []);
    assert.equal(await t.run(profile.get, viewer, { userId: other }), null);
  }
  assert.deepEqual(await t.run(posts.friendsFeed, me), []);
  assert.equal(await t.run(posts.get, me, { postId }), null);
  assert.deepEqual(await t.run(posts.comments, me, { postId }), []);
  await assert.rejects(t.run(posts.react, me, { postId }), /isn't available/);
  assert.deepEqual((await t.run(posts.comments, mutual, { postId })).map((row) => row.text), ["mine"]);
  await assert.rejects(t.run(friends.request, me, { userId: bryan }), /Unblock them first/);
  await assert.rejects(t.run(friends.request, bryan, { userId: me }), /couldn't find/);
  assert.deepEqual((await t.run(friends.blocked, me)).map((card) => card.username), ["bryan"]);
  assert.deepEqual(await t.run(friends.blocked, bryan), []);

  await t.run(friends.unblock, me, { userId: bryan });
  assert.equal(t.all("blocks").length, 0);
  assert.deepEqual((await t.run(friends.search, me, { text: "bryan" })).map((row) => row.status), ["none"]);
  assert.deepEqual((await t.run(friends.suggestions, me, {})).map((row) => row.username), ["bryan"]);
  assert.notEqual(await t.run(posts.get, me, { postId }), null);
});

test("event-tonight cron skips users who turned it off and stops at three a day", async () => {
  const t = backend();
  const f = fixtures(t);
  const likes = taste({ 0: 0.9, 5: 0.9 });
  const wants = await f.user("wants", { tasteVector: likes });
  const optedOut = await f.user("optedout", { tasteVector: likes, notifPrefs: { eventsTonight: false } });
  await f.user("noquiz", { tasteVector: undefined });
  for (let i = 0; i < 5; i++) await f.event(`Show ${i}`, { venueVector: likes });

  for (let run = 0; run < 5; run++) await t.run(cron.eventTonight, null);
  const sent = t.all("notifications");
  assert.equal(sent.length, 3);
  assert.ok(sent.every((row) => row.userId === wants && row.type === "event_tonight"));
  assert.equal(new Set(sent.map((row) => row.link)).size, 3);
  assert.match(sent[0].title, /^Tonight: Show \d · \d+\.\d for you$/);
  assert.ok(!sent.some((row) => row.userId === optedOut));
});
