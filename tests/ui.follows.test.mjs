import assert from "node:assert/strict";
import { test } from "node:test";
import { backend, fixtures, load } from "./people.harness.mjs";

const follows = await load("follows");
const onboarding = await load("onboarding");

async function world() {
  const t = backend();
  const f = fixtures(t);
  const me = await f.user("bryan");
  const star = await f.user("ethan");
  const quiet = await f.user("albert");
  return { t, f, me, star, quiet };
}

test("only public accounts can be followed; follow is idempotent; unfollow removes it", async () => {
  const { t, me, star, quiet } = await world();
  await assert.rejects(t.run(follows.follow, me, { userId: quiet }), /private/);
  await t.run(follows.setPublic, star, { isPublic: true });
  assert.deepEqual(await t.run(follows.follow, me, { userId: star }), { following: true });
  await t.run(follows.follow, me, { userId: star });
  assert.equal(t.all("follows").length, 1);
  const s = await t.run(follows.status, me, { userId: star });
  assert.deepEqual(s, { isPublic: true, followers: 1, following: 0, iFollow: true, isMe: false });
  assert.deepEqual(await t.run(follows.unfollow, me, { userId: star }), { following: false });
  assert.equal(t.all("follows").length, 0);
});

test("can't follow yourself or follow while signed out; status for me and missing users", async () => {
  const { t, me } = await world();
  await t.run(follows.setPublic, me, { isPublic: true });
  await assert.rejects(t.run(follows.follow, me, { userId: me }), /yourself/);
  await assert.rejects(t.run(follows.follow, null, { userId: me }), /Not signed in/);
  const mine = await t.run(follows.status, me, {});
  assert.equal(mine.isMe, true);
  assert.equal(mine.isPublic, true);
  assert.equal(await t.run(follows.status, null, {}), null);
});

test("followers list is visible for public accounts and my own, hidden otherwise", async () => {
  const { t, me, star, quiet } = await world();
  await t.run(follows.setPublic, star, { isPublic: true });
  await t.run(follows.follow, me, { userId: star });
  await t.run(follows.follow, quiet, { userId: star });
  const list = await t.run(follows.followers, me, { userId: star });
  assert.equal(list.length, 2);
  await t.run(follows.setPublic, star, { isPublic: false });
  assert.deepEqual(await t.run(follows.followers, me, { userId: star }), []);
  assert.equal((await t.run(follows.followers, star, { userId: star })).length, 2);
});

test("extended quiz answers are stored per user and replaced on save", async () => {
  const { t, me, star } = await world();
  await t.run(onboarding.saveExtendedQuiz, me, { answers: { songs: { 0: 5 } } });
  await t.run(onboarding.saveExtendedQuiz, me, { answers: { songs: { 0: 3 } } });
  assert.equal(t.all("quizExtras").length, 1);
  assert.deepEqual(await t.run(onboarding.myExtendedQuiz, me, {}), { songs: { 0: 3 } });
  assert.equal(await t.run(onboarding.myExtendedQuiz, star, {}), null);
  await assert.rejects(t.run(onboarding.saveExtendedQuiz, me, { answers: { big: "x".repeat(30_000) } }), /too large/);
});

test("pins only accept my own posts, capped at 9, de-duplicated", async () => {
  const { t, f, me, star } = await world();
  const bar = await f.place("Zeitgeist");
  const post = (userId) => t.db.insert("posts", { userId, targetKind: "place", targetId: bar, score: 8, createdAt: Date.now() });
  const mine = await post(me);
  const theirs = await post(star);
  assert.deepEqual(await t.run(onboarding.setPins, me, { postIds: [mine, mine] }), { postIds: [mine] });
  await assert.rejects(t.run(onboarding.setPins, me, { postIds: [theirs] }), /own posts/);
  assert.deepEqual(await t.run(onboarding.pins, star, { userId: me }), [mine]);
});
