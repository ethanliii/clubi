import assert from "node:assert/strict";
import { test } from "node:test";
import { backend, fixtures, load, taste } from "./people.harness.mjs";

const profile = await load("profile");
const settings = await load("settings");
const users = await load("users");
const rankings = await load("rankings");
const posts = await load("posts");

async function world() {
  const t = backend();
  const f = fixtures(t);
  const me = await f.user("ethan", { displayName: "Ethan", tasteVector: taste({ 0: 0.9, 4: 0.9 }) });
  const friend = await f.user("bryan", { displayName: "Bryan", bio: "bars first", tasteVector: taste({ 0: 0.9, 4: 0.8 }) });
  const stranger = await f.user("sam");
  await f.friends(friend, me);
  const bars = [await f.place("Zeitgeist"), await f.place("Toronado"), await f.place("Trick Dog")];
  const cafe = await f.place("Sightglass", { category: "food" });
  const rank = (userId, id, extra = {}) =>
    t.run(rankings.rank, userId, { kind: "place", id, bucket: "loved", position: 99, comparisons: [], tags: [], ...extra });
  return { t, f, me, friend, stranger, bars, cafe, rank };
}

test("profile.get: mine has everything; a friend's has lists grouped by category and recent posts", async () => {
  const { t, me, friend, bars, cafe, rank } = await world();
  await rank(friend, bars[0]);
  await rank(friend, bars[1]);
  await rank(friend, cafe, { bucket: "fine" });
  await rank(me, bars[0]);

  const mine = await t.run(profile.get, me, {});
  assert.deepEqual([mine.user.isMe, mine.user.status, mine.canSee], [true, "self", true]);
  assert.deepEqual(mine.counts, { ranked: 1, friends: 1, posts: 1 });
  assert.deepEqual(mine.tasteSummary.map((dim) => dim.label), ["Chill", "Music-first", "Night owl", "Budget-minded"]);

  const theirs = await t.run(profile.get, me, { userId: friend });
  assert.deepEqual([theirs.user.username, theirs.user.bio, theirs.user.isMe, theirs.user.status, theirs.canSee], ["bryan", "bars first", false, "friends", true]);
  assert.deepEqual(theirs.counts, { ranked: 3, friends: 1, posts: 3 });
  assert.deepEqual(theirs.lists.map((list) => [list.category, list.noun, list.items.map((item) => item.name)]),
    [["nightlife", "bars", ["Zeitgeist", "Toronado"]], ["food", "food spots", ["Sightglass"]]]);
  assert.deepEqual(theirs.recentPosts.map((post) => post.target.name), ["Sightglass", "Toronado", "Zeitgeist"]);
  assert.equal(theirs.recentPosts[2].myScoreForIt, 8.4);
  assert.equal(await t.run(profile.get, null, { userId: friend }), null);
});

test("profile.get for a non-friend: header, counts and status only, unless they post publicly", async () => {
  const { t, friend, stranger, bars, cafe, rank } = await world();
  await rank(friend, bars[0]);
  await rank(friend, cafe, { visibility: "public" });
  const pending = await t.db.insert("friendships", { userA: stranger, userB: friend, status: "pending" });

  const closed = await t.run(profile.get, stranger, { userId: friend });
  assert.deepEqual([closed.canSee, closed.user.status, closed.user.requestId, closed.user.displayName], [false, "outgoing", pending, "Bryan"]);
  assert.deepEqual(closed.counts, { ranked: 2, friends: 1, posts: 2 });
  assert.deepEqual([closed.tasteSummary, closed.lists, closed.recentPosts], [[], [], []]);

  // A public profile shows a stranger only what was posted publicly.
  await t.db.patch(friend, { defaultVisibility: "public" });
  const open = await t.run(profile.get, stranger, { userId: friend });
  assert.equal(open.canSee, true);
  assert.deepEqual(open.lists.map((list) => list.items.map((item) => item.name)), [["Sightglass"]]);
  assert.deepEqual(open.recentPosts.map((post) => post.target.name), ["Sightglass"]);
});

test("a private ranking stays off the profile for friends, and under-21 viewers get no nightlife", async () => {
  const { t, me, friend, bars, cafe, rank } = await world();
  await rank(friend, bars[0], { visibility: "private" });
  await rank(friend, bars[1]);
  await rank(friend, cafe);
  const names = async (viewer) => (await t.run(profile.get, viewer, { userId: friend })).lists.flatMap((list) => list.items.map((item) => item.name));
  assert.deepEqual(await names(me), ["Toronado", "Sightglass"]);
  assert.deepEqual(await names(friend), ["Zeitgeist", "Toronado", "Sightglass"]);
  await t.db.patch(me, { birthday: `${new Date().getUTCFullYear() - 18}-06-01` });
  assert.deepEqual(await names(me), ["Sightglass"]);
});

test("profile.compare: friends only, shared places with both scores, agreement, their best I haven't tried", async () => {
  const { t, me, friend, stranger, bars, cafe, rank } = await world();
  await rank(me, bars[0]);
  await rank(me, cafe);
  await rank(friend, bars[0]);
  await rank(friend, bars[1]);
  await rank(friend, bars[2], { visibility: "private" });
  await rank(friend, cafe, { bucket: "didnt" });

  assert.equal(await t.run(profile.compare, stranger, { userId: friend }), null);
  assert.equal(await t.run(profile.compare, me, { userId: me }), null);
  assert.equal(await t.run(profile.compare, null, { userId: friend }), null);

  const result = await t.run(profile.compare, me, { userId: friend });
  assert.deepEqual([result.me.username, result.them.username], ["ethan", "bryan"]);
  assert.ok(result.tasteMatchPct > 95);
  assert.deepEqual(result.dims.map((dim) => dim.label), ["Chill", "Music-first", "Night owl", "Budget-minded"]);
  assert.ok(result.dims.every((dim) => dim.me >= 0 && dim.me <= 100 && dim.them >= 0 && dim.them <= 100));
  assert.deepEqual(result.shared.map((row) => [row.name, row.myScore, row.theirScore]).sort(), [["Sightglass", 8.4, 1.7], ["Zeitgeist", 8.4, 9.5]]);
  assert.equal(result.agreePct, 50);
  // Their private ranking (Trick Dog) is not offered.
  assert.deepEqual(result.theirTopNewToMe.map((item) => item.name), ["Toronado"]);
  assert.equal(result.summary, "You two agree on bars, split on food spots");
});

test("settings.get and update: only passed fields change, values are validated, prefs merge", async () => {
  const { t, me } = await world();
  assert.equal(await t.run(settings.get, null), null);
  const before = await t.run(settings.get, me);
  assert.deepEqual([before.username, before.displayName, before.defaultVisibility, before.discoverable], ["ethan", "Ethan", "friends", true]);
  assert.ok(Object.values(before.notifPrefs).every((on) => on === true));

  const after = await t.run(settings.update, me, {
    displayName: "  Ethan   Li ", bio: " hi ", homeCity: " San Francisco ", birthday: "2001-10-23",
    defaultVisibility: "private", discoverable: false, notifPrefs: { reactions: false },
  });
  assert.deepEqual([after.displayName, after.bio, after.homeCity, after.birthday, after.defaultVisibility, after.discoverable],
    ["Ethan Li", "hi", "San Francisco", "2001-10-23", "private", false]);
  assert.deepEqual([after.notifPrefs.reactions, after.notifPrefs.friendPosts], [false, true]);
  const merged = await t.run(settings.update, me, { notifPrefs: { artistAlerts: false } });
  assert.deepEqual([merged.notifPrefs.reactions, merged.notifPrefs.artistAlerts, merged.displayName, merged.bio], [false, false, "Ethan Li", "hi"]);
  const cleared = await t.run(settings.update, me, { bio: "  ", homeCity: "" });
  assert.deepEqual([cleared.bio, cleared.homeCity], [undefined, undefined]);

  await assert.rejects(t.run(settings.update, me, { displayName: " " }), /1 to 40/);
  await assert.rejects(t.run(settings.update, me, { bio: "x".repeat(161) }), /160/);
  await assert.rejects(t.run(settings.update, me, { birthday: "23/10/2001" }), /YYYY-MM-DD/);
  await assert.rejects(t.run(settings.update, null, { bio: "x" }), /Not signed in/);
  assert.equal((await t.run(settings.get, me)).displayName, "Ethan Li");
});

test("a new ranking uses the default visibility from settings", async () => {
  const { t, me, bars, rank } = await world();
  await t.run(settings.update, me, { defaultVisibility: "private" });
  await rank(me, bars[0]);
  assert.equal(t.all("posts")[0].visibility, "private");
});

test("setAvatar stores the file id and a URL that every card reads, and drops the old file", async () => {
  const { t, me, friend } = await world();
  assert.match(await t.run(settings.generateAvatarUploadUrl, me), /^https:/);
  const first = await t.run(settings.setAvatar, me, { storageId: "_storage|a" });
  assert.equal(first.avatarUrl, "https://files.test/_storage|a");
  await t.run(settings.setAvatar, me, { storageId: "_storage|b" });
  assert.ok(t.deletedFiles.has("_storage|a"));
  assert.equal((await t.run(settings.get, me)).avatarUrl, "https://files.test/_storage|b");
  assert.equal((await t.run(profile.get, friend, { userId: me })).user.avatarUrl, "https://files.test/_storage|b");
  await assert.rejects(t.run(settings.setAvatar, me, { storageId: "_storage|a" }), /didn't finish uploading/);
});

test("users.me also returns bio and unreadCount", async () => {
  const { t, me, friend, bars, rank } = await world();
  await t.db.patch(me, { bio: "hello" });
  await rank(friend, bars[0]);
  const result = await t.run(users.me, me);
  assert.deepEqual([result.username, result.bio, result.unreadCount, result.onboarded], ["ethan", "hello", 1, true]);
  assert.equal(result.tasteSummary.length, 4);
  assert.equal(await t.run(users.me, null), null);
});

test("deleteAccount needs the username, then removes every trace of the user and nothing of anyone else", async () => {
  const { t, f, me, friend, stranger, bars, cafe, rank } = await world();
  await rank(me, bars[0], { photoStorageId: "_storage|p" });
  await rank(me, bars[1], { comparisons: [{ winnerId: bars[0], loserId: bars[1] }] });
  await rank(friend, cafe);
  const myPost = t.all("posts").find((post) => post.userId === me);
  const theirPost = t.all("posts").find((post) => post.userId === friend);
  await t.run(posts.react, friend, { postId: myPost._id });
  await t.run(posts.addComment, friend, { postId: myPost._id, text: "on mine" });
  await t.run(posts.react, me, { postId: theirPost._id });
  await t.run(posts.addComment, me, { postId: theirPost._id, text: "on theirs" });
  await t.run(settings.setAvatar, me, { storageId: "_storage|avatar" });
  await f.friends(me, stranger, "pending");
  await t.db.insert("saves", { userId: me, targetKind: "place", targetId: cafe, type: "want", createdAt: 1 });
  await t.db.insert("quizAnswers", { userId: me, answers: [[0]] });
  await t.db.insert("visitAnswers", { userId: me, targetKind: "place", targetId: cafe, category: "food", questionId: "q", optionIds: ["a"], createdAt: 1 });
  const myTrip = await t.db.insert("trips", { ownerId: me, name: "Mine", createdAt: 1 });
  const theirTrip = await t.db.insert("trips", { ownerId: friend, name: "Theirs", createdAt: 1 });
  await t.db.insert("tripMembers", { tripId: myTrip, userId: friend, status: "joined", createdAt: 1 });
  await t.db.insert("tripMembers", { tripId: theirTrip, userId: me, status: "joined", createdAt: 1 });
  await t.db.insert("tripVotes", { tripId: myTrip, userId: friend, targetKind: "place", targetId: cafe, vote: 1, createdAt: 1 });
  await t.db.insert("tripVotes", { tripId: theirTrip, userId: me, targetKind: "place", targetId: cafe, vote: 1, createdAt: 1 });

  await assert.rejects(t.run(settings.deleteAccount, me, { confirmUsername: "bryan" }), /username exactly/);
  await assert.rejects(t.run(settings.deleteAccount, null, { confirmUsername: "ethan" }), /Not signed in/);
  assert.equal(await t.run(settings.deleteAccount, me, { confirmUsername: " @Ethan " }), null);

  assert.equal(await t.db.get(me), null);
  const mentions = (table) => t.all(table).filter((row) => JSON.stringify(row).includes(me)).length;
  for (const table of ["rankings", "posts", "comparisons", "friendships", "reactions", "comments", "saves", "quizAnswers",
    "visitAnswers", "notifications", "trips", "tripMembers", "tripVotes"]) {
    assert.equal(mentions(table), 0, table);
  }
  assert.ok(t.deletedFiles.has("_storage|p") && t.deletedFiles.has("_storage|avatar"));
  assert.deepEqual(t.componentCalls.map((call) => call.name.split("/").pop()), ["revokeSessions", "deleteUsername"]);
  // The friend keeps their own things.
  assert.deepEqual([t.all("rankings").length, t.all("posts").length, t.all("trips").length], [1, 1, 1]);
  assert.deepEqual(t.all("trips")[0].name, "Theirs");
  assert.equal(await t.db.get(friend) !== null, true);
});

test("a very large account is deleted in batches: signed out at once, finished in the background", async () => {
  const { t, me, cafe } = await world();
  for (let i = 0; i < 320; i++) {
    await t.db.insert("saves", { userId: me, targetKind: "place", targetId: cafe, type: "want", createdAt: i });
  }
  await t.run(settings.deleteAccount, me, { confirmUsername: "ethan" });
  assert.notEqual(await t.db.get(me), null);
  assert.equal((await t.db.get(me)).discoverable, false);
  assert.equal(t.scheduled.length, 1);
  assert.deepEqual(t.componentCalls.map((call) => call.name.split("/").pop()), ["revokeSessions"]);
  // Run the scheduled continuation until it stops rescheduling itself.
  for (let run = 0; run < 5 && t.scheduled.length > 0; run++) {
    const { args } = t.scheduled.shift();
    await t.run(users.continueDelete, null, args);
  }
  assert.equal(await t.db.get(me), null);
  assert.equal(t.all("saves").length, 0);
});

test("profile counts shown to other people leave out private rankings and posts", async () => {
  const { t, me, friend, stranger, bars, cafe, rank } = await world();
  await rank(friend, bars[0], { visibility: "private" });
  await rank(friend, bars[1]);
  await rank(friend, cafe, { visibility: "public" });
  assert.deepEqual((await t.run(profile.get, friend, {})).counts, { ranked: 3, friends: 1, posts: 3 });
  assert.deepEqual((await t.run(profile.get, me, { userId: friend })).counts, { ranked: 2, friends: 1, posts: 2 });
  assert.deepEqual((await t.run(profile.get, stranger, { userId: friend })).counts, { ranked: 2, friends: 1, posts: 2 });
});
