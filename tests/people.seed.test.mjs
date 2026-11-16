import assert from "node:assert/strict";
import { test } from "node:test";
import { backend, fixtures, load } from "./people.harness.mjs";

const seedPlaces = await load("seedPlaces");
const seedSocial = await load("seedSocial");
const posts = await load("posts");
const friends = await load("friends");
const trips = await load("trips");
const profile = await load("profile");
const { bucketScore, BUCKET_RANGE } = await load("lib/social");

async function seeded() {
  const t = backend();
  const me = await fixtures(t).user("ethan", { homeCity: "San Francisco" });
  await t.run(seedPlaces.run, null);
  const made = await t.run(seedSocial.run, null, { forUsername: "ethan" });
  return { t, me, made };
}

test("the seed needs places first and a real user when one is named", async () => {
  const t = backend();
  await assert.rejects(t.run(seedSocial.run, null, {}), /seedPlaces:run first/);
  await t.run(seedPlaces.run, null);
  await assert.rejects(t.run(seedSocial.run, null, { forUsername: "nobody" }), /No user named nobody/);
});

test("eight demo users with distinct tastes, 8–15 valid rankings each and a friends-only post per ranking", async () => {
  const { t, made } = await seeded();
  const demo = t.all("users").filter((user) => user.username.startsWith("demo_"));
  assert.equal(demo.length, 8);
  assert.equal(new Set(demo.map((user) => JSON.stringify(user.tasteVector))).size, 8);
  assert.equal(demo.filter((user) => user.homeCity === "San Francisco").length, 5);
  assert.ok(demo.every((user) => user.bio && user.displayName && user.tasteVector.length === 13 && user.tastePrior));
  assert.deepEqual([made.users, made.rankings, made.posts], [8, t.all("rankings").length, t.all("posts").length]);

  const now = Date.now();
  for (const user of demo) {
    const mine = t.all("rankings").filter((row) => row.userId === user._id);
    assert.ok(mine.length >= 8 && mine.length <= 15, `${user.username} has ${mine.length}`);
    assert.equal(new Set(mine.map((row) => row.placeId)).size, mine.length);
    // Positions are 1..n with no gaps in every (category, bucket), with exactly the scores rank would give.
    const groups = Map.groupBy(mine, (row) => `${row.category}|${row.bucket}`);
    for (const rows of groups.values()) {
      assert.deepEqual(rows.map((row) => row.position).sort((a, b) => a - b), rows.map((_, k) => k + 1));
      for (const row of rows) {
        assert.equal(row.score, bucketScore(row.bucket, row.position, rows.length));
        assert.ok(row.score >= BUCKET_RANGE[row.bucket][0] && row.score <= BUCKET_RANGE[row.bucket][1]);
      }
    }
    assert.ok(new Set(mine.map((row) => row.bucket)).size >= 2, `${user.username} uses one bucket only`);
    const theirPosts = t.all("posts").filter((post) => post.userId === user._id);
    assert.equal(theirPosts.length, mine.length);
    assert.ok(theirPosts.every((post) => post.visibility === "friends" && post.caption && mine.some((row) => row._id === post.rankingId)));
    assert.ok(theirPosts.every((post) => post.createdAt < now && post.createdAt > now - 10 * 86_400_000 - 3_600_000));
    assert.ok(new Set(theirPosts.map((post) => post.createdAt)).size > 1);
  }
  // The rankings follow from taste: the techno night owl loves the warehouse club, the hiker does not.
  const midway = t.all("places").find((place) => place.sourceId === "the-midway")._id;
  const bucketOf = (username) => t.all("rankings").find((row) => row.placeId === midway && row.userId === demo.find((user) => user.username === username)._id)?.bucket;
  assert.equal(bucketOf("demo_maya"), "loved");
  assert.notEqual(bucketOf("demo_jonas"), "loved");
  assert.ok(t.all("comparisons").length > 20);
  assert.ok(t.all("places").every((place) => (place.elo ?? 0) === 0));
  assert.equal(t.all("notifications").length, 0);
});

test("for a real user: 4 friends, 2 incoming requests, a live feed, suggestions and one trip", async () => {
  const { t, me } = await seeded();
  const overview = await t.run(friends.list, me);
  assert.deepEqual([overview.friends.length, overview.incoming.length, overview.outgoing.length], [4, 2, 0]);
  assert.ok(overview.friends.every((friend) => friend.rankedCount >= 8 && friend.tasteMatchPct >= 0));

  const feed = await t.run(posts.friendsFeed, me);
  assert.equal(feed.length, 30);
  assert.ok(feed.every((item, k) => k === 0 || feed[k - 1].createdAt >= item.createdAt));
  assert.ok(feed.every((item) => /^#\d+ of their .+ · \d+\.\d$/.test(item.label) && item.score > 0));
  const friendIds = new Set(overview.friends.map((friend) => friend.userId));
  assert.ok(feed.every((item) => friendIds.has(item.author.userId)));

  const suggested = await t.run(friends.suggestions, me, {});
  assert.deepEqual(suggested.map((row) => row.username).sort(), ["demo_kenji", "demo_sofia"]);
  assert.ok(suggested.every((row) => row.mutualCount >= 1 && /mutual friends|Friends with/.test(row.reason)));

  const mine = await t.run(trips.list, me);
  assert.deepEqual(mine.map((trip) => [trip.name, trip.myStatus, trip.memberCount, trip.city]), [["Saturday in the Mission", "joined", 3, "San Francisco"]]);
  const detail = await t.run(trips.get, me, { tripId: mine[0].tripId });
  assert.equal(detail.members.length, 3);
  assert.equal(detail.shortlist.length, 3);
  assert.deepEqual([detail.shortlist[0].votesUp, detail.shortlist[1].votesUp], [2, 1]);

  const theirs = await t.run(profile.get, me, { userId: overview.friends[0].userId });
  assert.ok(theirs.canSee && theirs.lists.length > 0 && theirs.recentPosts.length > 0);
});

test("run is safe to run twice, and clear removes everything the seed created and nothing else", async () => {
  const { t, me } = await seeded();
  await t.db.insert("rankings", { userId: me, placeId: t.all("places")[0]._id, category: "nightlife", bucket: "loved", position: 1, score: 8.4 });
  const count = () => Object.fromEntries(["users", "rankings", "posts", "comparisons", "friendships", "trips", "tripMembers", "tripVotes"].map((table) => [table, t.all(table).length]));
  const before = count();
  const again = await t.run(seedSocial.run, null, { forUsername: "ethan" });
  assert.deepEqual(again, { users: 0, rankings: 0, posts: 0, comparisons: 0, friendships: 0, requests: 0, trips: 0 });
  assert.deepEqual(count(), before);

  let result = await t.run(seedSocial.clear, null);
  for (let run = 0; run < 5 && result.continuing; run++) result = await t.run(seedSocial.clear, null);
  assert.deepEqual(count(), { users: 1, rankings: 1, posts: 0, comparisons: 0, friendships: 0, trips: 0, tripMembers: 0, tripVotes: 0 });
  assert.equal(t.all("places").length, 28);
  assert.equal((await t.db.get(me)).username, "ethan");
  // And it can be seeded again afterwards.
  assert.equal((await t.run(seedSocial.run, null, {})).users, 8);
});
