import assert from "node:assert/strict";
import { test } from "node:test";
import { backend, fixtures, load, taste } from "./people.harness.mjs";

const friends = await load("friends");

async function world() {
  const t = backend();
  const f = fixtures(t);
  const me = await f.user("ethan", { displayName: "Ethan Li", homeCity: "San Francisco" });
  const bryan = await f.user("bryan", { displayName: "Bryan Park" });
  return { t, f, me, bryan };
}

test("request → respond(accept): one row per pair, both sides notified, both lists agree", async () => {
  const { t, me, bryan } = await world();
  const sent = await t.run(friends.request, me, { username: "@bryan" });
  assert.equal(sent.status, "outgoing");
  assert.deepEqual(await t.run(friends.request, me, { userId: bryan }), sent);
  assert.equal(t.all("friendships").length, 1);
  let note = t.all("notifications");
  assert.deepEqual(note.map((row) => [row.userId, row.type, row.link, row.actorId]), [[bryan, "friend_request", "/friends", me]]);

  const mine = await t.run(friends.list, me);
  assert.deepEqual([mine.friends.length, mine.incoming.length, mine.outgoing.length], [0, 0, 1]);
  assert.equal(mine.outgoing[0].user.username, "bryan");
  const theirs = await t.run(friends.list, bryan);
  assert.equal(theirs.incoming[0].requestId, sent.requestId);
  assert.equal(theirs.incoming[0].user.displayName, "Ethan Li");

  await assert.rejects(t.run(friends.respond, me, { requestId: sent.requestId, accept: true }), /no longer open/);
  await t.run(friends.respond, bryan, { requestId: sent.requestId, accept: true });
  await assert.rejects(t.run(friends.respond, bryan, { requestId: sent.requestId, accept: true }), /no longer open/);
  note = t.all("notifications");
  assert.deepEqual([note[1].userId, note[1].type, note[1].link], [me, "friend_accepted", `/user/${bryan}`]);
  const after = await t.run(friends.list, me);
  assert.deepEqual(after.friends.map((friend) => [friend.username, friend.tasteMatchPct, friend.rankedCount]), [["bryan", 75, 0]]);
  assert.equal(after.outgoing.length, 0);
  assert.deepEqual(await t.run(friends.request, bryan, { userId: me }), { requestId: sent.requestId, status: "friends" });
});

test("asking someone who already asked me accepts their request", async () => {
  const { t, me, bryan } = await world();
  const theirs = await t.run(friends.request, bryan, { userId: me });
  const mine = await t.run(friends.request, me, { username: "bryan" });
  assert.deepEqual(mine, { requestId: theirs.requestId, status: "friends" });
  assert.equal(t.all("friendships").length, 1);
  assert.equal(t.all("friendships")[0].status, "accepted");
  assert.deepEqual(t.all("notifications").map((row) => [row.userId, row.type]), [[me, "friend_request"], [bryan, "friend_accepted"]]);
});

test("request rules: not myself, a real person, signed in; a declined pair may ask again in either direction", async () => {
  const { t, me, bryan } = await world();
  await assert.rejects(t.run(friends.request, me, { userId: me }), /can't add yourself/);
  await assert.rejects(t.run(friends.request, me, { username: "ethan" }), /can't add yourself/);
  await assert.rejects(t.run(friends.request, me, { username: "nobody" }), /couldn't find/);
  await assert.rejects(t.run(friends.request, me, {}), /who you want to add/);
  await assert.rejects(t.run(friends.request, null, { userId: bryan }), /Not signed in/);

  const first = await t.run(friends.request, me, { userId: bryan });
  await t.run(friends.respond, bryan, { requestId: first.requestId, accept: false });
  assert.equal(t.all("friendships")[0].status, "declined");
  assert.equal(t.all("notifications").length, 1);
  assert.deepEqual((await t.run(friends.list, me)).outgoing, []);

  // The person who declined asks: same row, now pointing the other way.
  const second = await t.run(friends.request, bryan, { userId: me });
  assert.deepEqual(second, { requestId: first.requestId, status: "outgoing" });
  const row = t.all("friendships");
  assert.equal(row.length, 1);
  assert.deepEqual([row[0].userA, row[0].userB, row[0].status], [bryan, me, "pending"]);
});

test("cancel is for the asker, remove unfriends from either side", async () => {
  const { t, me, bryan } = await world();
  const sent = await t.run(friends.request, me, { userId: bryan });
  await assert.rejects(t.run(friends.cancel, bryan, { requestId: sent.requestId }), /you sent/);
  await t.run(friends.cancel, me, { requestId: sent.requestId });
  assert.equal(t.all("friendships").length, 0);
  assert.equal(await t.run(friends.cancel, me, { requestId: sent.requestId }), null);

  const again = await t.run(friends.request, me, { userId: bryan });
  // remove does nothing to a pending request.
  await t.run(friends.remove, bryan, { userId: me });
  assert.equal(t.all("friendships").length, 1);
  await t.run(friends.respond, bryan, { requestId: again.requestId, accept: true });
  await assert.rejects(t.run(friends.cancel, me, { requestId: again.requestId }), /still waiting/);
  await t.run(friends.remove, bryan, { userId: me });
  assert.equal(t.all("friendships").length, 0);
  assert.deepEqual((await t.run(friends.list, me)).friends, []);
});

test("search: username prefix and display name, never me, hidden users only for friends, with my status", async () => {
  const { t, f, me, bryan } = await world();
  const brynn = await f.user("brynn_w", { displayName: "Brynn Walsh" });
  const hidden = await f.user("bryce", { displayName: "Bryce Hidden", discoverable: false });
  const hiddenFriend = await f.user("bruno", { displayName: "Bruno Friend", discoverable: false });
  await f.friends(hiddenFriend, me);
  const asked = await f.user("ethel", { displayName: "Ethel" });
  const pending = await t.run(friends.request, asked, { userId: me });
  await f.friends(me, bryan, "pending");

  const br = await t.run(friends.search, me, { text: " BR " });
  assert.deepEqual(br.map((row) => row.username).sort(), ["bruno", "bryan", "brynn_w"]);
  assert.equal(br.find((row) => row.userId === bryan).status, "outgoing");
  assert.equal(br.find((row) => row.userId === brynn).status, "none");
  assert.equal(br.find((row) => row.userId === hiddenFriend).status, "friends");
  assert.ok(!br.some((row) => row.userId === hidden));

  const eth = await t.run(friends.search, me, { text: "eth" });
  assert.deepEqual(eth.map((row) => [row.username, row.status, row.requestId]), [["ethel", "incoming", pending.requestId]]);
  assert.deepEqual((await t.run(friends.search, me, { text: "walsh" })).map((row) => row.username), ["brynn_w"]);
  assert.deepEqual(await t.run(friends.search, me, { text: "   " }), []);
  assert.deepEqual(await t.run(friends.search, null, { text: "br" }), []);

  for (let i = 0; i < 30; i++) await f.user(`zed${String(i).padStart(2, "0")}`);
  assert.equal((await t.run(friends.search, me, { text: "zed" })).length, 20);
});

test("suggestions: friends of friends first, scored by mutuals, taste and shared places, with reasons", async () => {
  const { t, f, me, bryan } = await world();
  await t.db.patch(me, { tasteVector: taste({ 0: 0.9, 4: 0.9 }) });
  const cara = await f.user("cara");
  await f.friends(me, bryan);
  await f.friends(cara, me);
  // dana knows both of my friends; evan knows one; both share nothing else with me.
  const dana = await f.user("dana", { displayName: "Dana", tasteVector: taste({ 0: 0.9, 4: 0.9 }) });
  const evan = await f.user("evan", { displayName: "Evan", tasteVector: taste({ 7: 0.9 }) });
  await f.friends(dana, bryan);
  await f.friends(cara, dana);
  await f.friends(bryan, evan);
  // Never suggested: someone hidden, someone I asked, someone who asked me, someone I declined.
  const hidden = await f.user("hidden", { discoverable: false });
  const asked = await f.user("asked");
  const asker = await f.user("asker");
  const declined = await f.user("declined");
  for (const other of [hidden, asked, asker, declined]) await f.friends(bryan, other);
  await f.friends(me, asked, "pending");
  await f.friends(asker, me, "pending");
  await f.friends(declined, me, "declined");

  const list = await t.run(friends.suggestions, me, { limit: 5 });
  assert.deepEqual(list.map((row) => row.username), ["dana", "evan"]);
  assert.deepEqual([list[0].mutualCount, list[0].tasteMatchPct, list[0].sharedPlaces], [2, 100, 0]);
  assert.equal(list[0].reason, "2 mutual friends · 100% taste match");
  assert.equal(list[1].reason, "Friends with Bryan Park");
  assert.ok(list[0].score > list[1].score && list[0].score <= 1 && list[1].score > 0);
  assert.equal((await t.run(friends.suggestions, me, { limit: 1 })).length, 1);
  assert.deepEqual(await t.run(friends.suggestions, null, {}), []);
});

test("suggestions fall back to my home city, ranked by taste and by agreement on shared places", async () => {
  const { t, f, me } = await world();
  await t.db.patch(me, { tasteVector: taste({ 0: 0.9, 4: 0.9 }) });
  const twin = await f.user("twin", { homeCity: "San Francisco", tasteVector: taste({ 0: 0.9, 4: 0.9 }) });
  const opposite = await f.user("opposite", { homeCity: "San Francisco", tasteVector: taste({ 7: 0.9, 9: 0.9 }) });
  await f.user("faraway", { homeCity: "Tokyo", tasteVector: taste({ 0: 0.9, 4: 0.9 }) });
  await f.user("shy", { homeCity: "San Francisco", discoverable: false });
  const places = [await f.place("Zeitgeist"), await f.place("Toronado"), await f.place("Trick Dog")];
  const rank = (userId, placeId, score) =>
    t.db.insert("rankings", { userId, placeId, category: "nightlife", bucket: "loved", position: 1, score });
  for (const [index, place] of places.entries()) {
    await rank(me, place, 9.5 - index);
    await rank(opposite, place, 9.5 - index);
  }
  const list = await t.run(friends.suggestions, me, {});
  assert.deepEqual(list.map((row) => row.username), ["twin", "opposite"]);
  assert.equal(list[0].reason, "Also in San Francisco · 100% taste match");
  assert.deepEqual([list[1].sharedPlaces, list[1].mutualCount], [3, 0]);
  assert.equal(list[1].reason, "You both ranked Zeitgeist and 2 more");
  assert.ok(list.every((row) => row.reason.length > 0 && row.userId !== me));
  // twin: 0.3 taste + 0.1 city. opposite: 0.2 × (3/5 × 1) co-rank + 0.1 city.
  assert.equal(list[0].score, 0.4);
  assert.equal(list[1].score, 0.22);
  assert.ok(twin && opposite);
});
