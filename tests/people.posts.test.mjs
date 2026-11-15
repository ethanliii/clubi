import assert from "node:assert/strict";
import { test } from "node:test";
import { backend, fixtures, load } from "./people.harness.mjs";

const posts = await load("posts");
const rankings = await load("rankings");

async function world() {
  const t = backend();
  const f = fixtures(t);
  const me = await f.user("ethan");
  const friend = await f.user("bryan", { displayName: "Bryan" });
  const stranger = await f.user("sam");
  await f.friends(friend, me);
  const bar = await f.place("Zeitgeist");
  const cafe = await f.place("Sightglass", { category: "food" });
  const rank = (userId, id, extra = {}) =>
    t.run(rankings.rank, userId, { kind: "place", id, bucket: "loved", position: 1, comparisons: [], tags: [], ...extra });
  const postOf = (userId, targetId) => t.all("posts").find((post) => post.userId === userId && post.targetId === targetId);
  const page = (userId, numItems = 15, cursor = null) => t.run(posts.feed, userId, { paginationOpts: { numItems, cursor } });
  return { t, f, me, friend, stranger, bar, cafe, rank, postOf, page };
}

test("a friend's post is in my feed the moment it is written, with the whole FeedItem", async () => {
  const { t, me, friend, bar, cafe, rank, page } = await world();
  await rank(me, bar, { bucket: "fine" });
  assert.equal((await page(me)).page.length, 1);
  await rank(friend, cafe, { tags: ["coffee"] });
  await rank(friend, bar, { caption: "the patio", photoStorageId: "_storage|1", tags: ["patio", "dive"] });

  const { page: items, isDone } = await page(me);
  assert.equal(isDone, true);
  assert.deepEqual(items.map((item) => [item.author.displayName, item.target.name]), [["Bryan", "Zeitgeist"], ["Bryan", "Sightglass"], ["ethan", "Zeitgeist"]]);
  const top = items[0];
  assert.deepEqual(top.target, { kind: "place", id: bar, name: "Zeitgeist", category: "nightlife", imageUrl: undefined });
  // The place's picture travels with the post, for a post without a photo of its own.
  await t.db.patch(bar, { imageUrl: "https://files.test/zeitgeist.jpg" });
  assert.equal((await page(me)).page[0].target.imageUrl, "https://files.test/zeitgeist.jpg");
  assert.deepEqual([top.score, top.position, top.label], [8.4, 1, "#1 of their bars · 8.4"]);
  assert.deepEqual([top.caption, top.tags, top.photoUrls], ["the patio", ["patio", "dive"], ["https://files.test/_storage|1"]]);
  assert.deepEqual([top.myScoreForIt, top.reactionCount, top.myReaction, top.commentCount, top.visibility], [5.1, 0, undefined, 0, "friends"]);
  assert.equal(top.rankingId, t.all("rankings").find((row) => row.userId === friend && row.placeId === bar)._id);
  assert.equal(top.insightChips, undefined);
  assert.equal(typeof top.createdAt, "number");
  // My own post: "your", and no "my score for it".
  assert.deepEqual([items[2].label, items[2].myScoreForIt], ["#1 of your bars · 5.1", undefined]);
  assert.equal(items[1].myScoreForIt, undefined);
});

test("position in the label counts across buckets", async () => {
  const { t, me, friend, bar, f, rank } = await world();
  const other = await f.place("Toronado");
  await rank(friend, other);
  await rank(friend, bar, { bucket: "didnt" });
  const item = (await t.run(posts.friendsFeed, me))[0];
  assert.deepEqual([item.target.name, item.position, item.label], ["Zeitgeist", 2, "#2 of their bars · 1.7"]);
});

test("who can see a post: author always, public anyone signed in, friends only friends, private nobody else", async () => {
  const { t, me, friend, stranger, bar, cafe, rank, postOf, page } = await world();
  await rank(friend, bar);
  const post = postOf(friend, bar);
  const sees = async (userId) => (await t.run(posts.get, userId, { postId: post._id })) !== null;
  const everywhere = async (userId) => {
    const byUser = await t.run(posts.byUser, userId, { userId: friend, paginationOpts: { numItems: 10, cursor: null } });
    return [await sees(userId), byUser.page.length, (await t.run(posts.friendsFeed, userId)).length, (await page(userId)).page.length];
  };

  assert.deepEqual(await everywhere(me), [true, 1, 1, 1]);
  assert.deepEqual(await everywhere(stranger), [false, 0, 0, 0]);
  assert.deepEqual(await everywhere(null), [false, 0, 0, 0]);
  assert.deepEqual(await everywhere(friend), [true, 1, 1, 1]);

  await t.run(posts.update, friend, { postId: post._id, visibility: "public" });
  // Public: a stranger can open it and see it on the profile, but it is not in their friend feed.
  assert.deepEqual(await everywhere(stranger), [true, 1, 0, 0]);
  assert.equal(await sees(null), false);

  await t.run(posts.update, friend, { postId: post._id, visibility: "private" });
  assert.deepEqual(await everywhere(me), [false, 0, 0, 0]);
  assert.deepEqual(await everywhere(friend), [true, 1, 1, 1]);

  // A private post can't be reacted to, commented on or read through its comments by anyone else.
  await t.db.insert("comments", { postId: post._id, userId: friend, text: "note to self", createdAt: 1 });
  await assert.rejects(t.run(posts.react, me, { postId: post._id }), /isn't available/);
  await assert.rejects(t.run(posts.addComment, me, { postId: post._id, text: "hi" }), /isn't available/);
  assert.deepEqual(await t.run(posts.comments, me, { postId: post._id }), []);
  assert.equal((await t.run(posts.comments, friend, { postId: post._id })).length, 1);

  // Ranked as private from the start.
  await rank(friend, cafe, { visibility: "private" });
  assert.equal((await page(me)).page.length, 0);
});

test("feed pages newest first with a stable cursor, full pages, no strangers", async () => {
  const { t, f, me, friend, stranger, rank, page } = await world();
  const places = [];
  for (let i = 0; i < 7; i++) places.push(await f.place(`Bar ${i}`));
  for (const [index, place] of places.entries()) {
    await rank(index % 3 === 2 ? stranger : friend, place);
    await t.db.patch(t.all("posts").at(-1)._id, { createdAt: 1000 + index });
  }
  // Strangers' posts (Bar 5, Bar 2) don't use up the page: every page is full until the posts run out.
  const first = await page(me, 3);
  assert.deepEqual(first.page.map((item) => item.target.name), ["Bar 6", "Bar 4", "Bar 3"]);
  assert.equal(first.isDone, false);
  const second = await page(me, 3, first.continueCursor);
  assert.deepEqual([second.page.map((item) => item.target.name), second.isDone], [["Bar 1", "Bar 0"], true]);
  assert.deepEqual((await t.run(posts.friendsFeed, me)).map((item) => item.target.name), ["Bar 6", "Bar 4", "Bar 3", "Bar 1", "Bar 0"]);
  assert.equal((await page(me, 9999)).page.length, 5);
});

test("friendsFeed returns the newest 30 even when strangers fill the newest posts", async () => {
  const { t, f, me, friend, stranger } = await world();
  const place = await f.place("Somewhere");
  const add = (userId, createdAt) => t.db.insert("posts", { userId, targetKind: "place", targetId: place, createdAt, visibility: "friends" });
  for (let i = 0; i < 35; i++) await add(friend, i);
  for (let i = 0; i < 250; i++) await add(stranger, 1000 + i);
  const items = await t.run(posts.friendsFeed, me);
  assert.equal(items.length, 30);
  assert.deepEqual([items[0].createdAt, items[29].createdAt], [34, 5]);
  // A post without a ranking still renders.
  assert.deepEqual([items[0].score, items[0].position, items[0].label, items[0].tags], [0, 0, "Somewhere", []]);
});

test("under-21 viewers never get nightlife posts", async () => {
  const { t, me, friend, bar, cafe, rank } = await world();
  await rank(friend, bar);
  await rank(friend, cafe);
  await t.db.patch(me, { birthday: `${new Date().getUTCFullYear() - 19}-01-01` });
  assert.deepEqual((await t.run(posts.friendsFeed, me)).map((item) => item.target.category), ["food"]);
  await t.db.patch(me, { birthday: "1990-01-01" });
  assert.equal((await t.run(posts.friendsFeed, me)).length, 2);
});

test("photos: upload url, attach to my post only, four at most, no duplicates", async () => {
  const { t, me, friend, bar, rank, postOf } = await world();
  await rank(me, bar);
  const postId = postOf(me, bar)._id;
  assert.match(await t.run(posts.generateUploadUrl, me), /^https:\/\//);
  await assert.rejects(t.run(posts.generateUploadUrl, null), /Not signed in/);
  await assert.rejects(t.run(posts.attachPhoto, friend, { postId, storageId: "_storage|1" }), /your own posts/);
  for (const n of [1, 2, 2, 3, 4]) {
    await t.run(posts.attachPhoto, me, { postId, storageId: `_storage|${n}` });
  }
  await assert.rejects(t.run(posts.attachPhoto, me, { postId, storageId: "_storage|5" }), /at most 4/);
  const again = await t.run(posts.attachPhoto, me, { postId, storageId: "_storage|4" });
  assert.equal(again.photoUrls.length, 4);
  assert.equal((await t.run(posts.get, me, { postId })).photoUrls.length, 4);
});

test("update changes only what is passed; remove deletes the post, reactions and comments but keeps the ranking", async () => {
  const { t, me, friend, bar, rank, postOf } = await world();
  await rank(me, bar, { caption: "first", photoStorageId: "_storage|1" });
  const postId = postOf(me, bar)._id;
  await assert.rejects(t.run(posts.update, friend, { postId, caption: "hacked" }), /your own posts/);
  await t.run(posts.update, me, { postId, visibility: "public" });
  assert.deepEqual([postOf(me, bar).caption, postOf(me, bar).visibility], ["first", "public"]);
  await t.run(posts.update, me, { postId, caption: "  second " });
  assert.deepEqual([postOf(me, bar).caption, postOf(me, bar).visibility], ["second", "public"]);
  await t.run(posts.update, me, { postId, caption: " " });
  assert.equal(postOf(me, bar).caption, undefined);
  await assert.rejects(t.run(posts.update, me, { postId, caption: "x".repeat(501) }), /at most 500/);

  await t.run(posts.react, friend, { postId });
  await t.run(posts.addComment, friend, { postId, text: "nice" });
  await assert.rejects(t.run(posts.remove, friend, { postId }), /your own posts/);
  await t.run(posts.remove, me, { postId });
  assert.deepEqual([t.all("posts").length, t.all("reactions").length, t.all("comments").length, t.all("rankings").length], [0, 0, 0, 1]);
  assert.ok(t.deletedFiles.has("_storage|1"));
  assert.equal(await t.run(posts.remove, me, { postId }), null);
  assert.equal(await t.run(posts.get, me, { postId }), null);
});

test("react toggles, switches emoji, and notifies the author the first time only", async () => {
  const { t, me, friend, bar, rank, postOf } = await world();
  await rank(friend, bar);
  t.db.table("notifications").clear();
  const postId = postOf(friend, bar)._id;
  assert.deepEqual(await t.run(posts.react, me, { postId }), { reactionCount: 1, myReaction: "❤️" });
  assert.deepEqual(await t.run(posts.react, me, { postId, emoji: "🔥" }), { reactionCount: 1, myReaction: "🔥" });
  assert.deepEqual(await t.run(posts.react, me, { postId, emoji: "🔥" }), { reactionCount: 0, myReaction: undefined });
  assert.deepEqual(await t.run(posts.react, me, { postId, emoji: "🔥" }), { reactionCount: 1, myReaction: "🔥" });
  assert.deepEqual(await t.run(posts.react, friend, { postId }), { reactionCount: 2, myReaction: "❤️" });
  const sent = t.all("notifications");
  assert.deepEqual(sent.map((row) => [row.userId, row.type, row.link, row.title]), [[friend, "post_reaction", `/post/${postId}`, "ethan reacted ❤️ to your post"]]);
  const item = await t.run(posts.get, me, { postId });
  assert.deepEqual([item.reactionCount, item.myReaction], [2, "🔥"]);
  await assert.rejects(t.run(posts.react, me, { postId, emoji: "  " }), /one emoji/);
  await assert.rejects(t.run(posts.react, null, { postId }), /Not signed in/);
});

test("comments: trimmed, 1–500 characters, oldest first, removable by the commenter or the post's author", async () => {
  const { t, me, friend, stranger, bar, rank, postOf } = await world();
  await rank(friend, bar, { visibility: "public" });
  t.db.table("notifications").clear();
  const postId = postOf(friend, bar)._id;
  const mine = await t.run(posts.addComment, me, { postId, text: "  love this place  " });
  assert.deepEqual([mine.text, mine.mine, mine.author.username], ["love this place", true, "ethan"]);
  const theirs = await t.run(posts.addComment, stranger, { postId, text: "x".repeat(500) });
  await t.run(posts.addComment, friend, { postId, text: "thanks" });
  await assert.rejects(t.run(posts.addComment, me, { postId, text: "   " }), /Write something/);
  await assert.rejects(t.run(posts.addComment, me, { postId, text: "x".repeat(501) }), /at most 500/);
  await assert.rejects(t.run(posts.addComment, null, { postId, text: "hi" }), /Not signed in/);

  const list = await t.run(posts.comments, me, { postId });
  assert.deepEqual(list.map((row) => [row.author.username, row.mine]), [["ethan", true], ["sam", false], ["bryan", false]]);
  assert.equal((await t.run(posts.get, me, { postId })).commentCount, 3);
  // The author is told about other people's comments, not their own; long text is cut.
  const sent = t.all("notifications");
  assert.deepEqual(sent.map((row) => [row.userId, row.type, row.actorId]), [[friend, "post_comment", me], [friend, "post_comment", stranger]]);
  assert.equal(sent[0].body, "love this place");
  assert.equal(sent[1].body.length, 80);

  await assert.rejects(t.run(posts.removeComment, me, { commentId: theirs.id }), /your own comments/);
  await t.run(posts.removeComment, friend, { commentId: theirs.id });
  await t.run(posts.removeComment, me, { commentId: mine.id });
  assert.equal(await t.run(posts.removeComment, me, { commentId: mine.id }), null);
  assert.deepEqual((await t.run(posts.comments, me, { postId })).map((row) => row.text), ["thanks"]);
});

test("the first feed page is full even when strangers posted more recently than my friends", async () => {
  const { t, f, me, friend, stranger } = await world();
  const place = await f.place("Somewhere", { category: "food" });
  const add = (userId, createdAt, visibility = "friends") => t.db.insert("posts", { userId, targetKind: "place", targetId: place, createdAt, visibility });
  for (let i = 0; i < 20; i++) await add(friend, i);
  await add(friend, 20, "private");
  await add(me, 21);
  for (let i = 0; i < 60; i++) await add(stranger, 1000 + i);

  const first = await t.run(posts.feed, me, { paginationOpts: { numItems: 15, cursor: null } });
  assert.equal(first.page.length, 15);
  assert.deepEqual(first.page.slice(0, 3).map((item) => item.createdAt), [21, 19, 18]);
  const second = await t.run(posts.feed, me, { paginationOpts: { numItems: 15, cursor: first.continueCursor } });
  assert.deepEqual([second.page.length, second.isDone], [6, true]);
  const all = [...first.page, ...second.page].map((item) => item.createdAt);
  assert.deepEqual(all, [21, ...Array.from({ length: 20 }, (_, k) => 19 - k)]);
  // A stranger to everyone still gets an empty, finished feed.
  const none = await t.run(posts.feed, stranger, { paginationOpts: { numItems: 15, cursor: null } });
  assert.equal(none.page.length, 15);
  assert.ok(none.page.every((item) => item.author.userId === stranger));
});

test("counts on a post leave out people the viewer has blocked", async () => {
  const { t, f, me, friend, bar, rank, postOf } = await world();
  const troll = await f.user("troll");
  await rank(friend, bar, { visibility: "public" });
  const postId = postOf(friend, bar)._id;
  await t.run(posts.addComment, troll, { postId, text: "first" });
  await t.run(posts.addComment, me, { postId, text: "second" });
  await t.run(posts.react, troll, { postId });
  await t.db.insert("blocks", { blockerId: me, blockedId: troll, createdAt: 1 });
  const mine = await t.run(posts.get, me, { postId });
  assert.deepEqual([mine.commentCount, mine.reactionCount], [1, 0]);
  const theirs = await t.run(posts.get, friend, { postId });
  assert.deepEqual([theirs.commentCount, theirs.reactionCount], [2, 1]);
});
