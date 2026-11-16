import assert from "node:assert/strict";
import { test } from "node:test";
import { backend, fixtures, load } from "./people.harness.mjs";

const rankings = await load("rankings");
const posts = await load("posts");

test("went with: only friends can be tagged, and the feed shows them", async () => {
  const t = backend();
  const f = fixtures(t);
  const me = await f.user("bryan");
  const maya = await f.user("maya");
  const alex = await f.user("alex");
  const stranger = await f.user("stranger");
  await f.friends(me, maya);
  await f.friends(me, alex);
  const bar = await f.place("Zeitgeist");
  const base = { kind: "place", id: bar, bucket: "loved", position: 1, comparisons: [], tags: [], visibility: "friends" };

  await assert.rejects(t.run(rankings.rank, me, { ...base, withUserIds: [stranger] }), /only tag your friends/);
  await t.run(rankings.rank, me, { ...base, withUserIds: [maya, alex, maya, me] });
  const post = t.all("posts")[0];
  assert.deepEqual(post.withUserIds, [maya, alex]);

  const page = await t.run(posts.feed, maya, { paginationOpts: { numItems: 15, cursor: null } });
  assert.deepEqual(page.page[0].with.map((w) => w.userId), [maya, alex]);
});
