// Owner: People session. NOT run by `npm test`. An end-to-end check of the People functions against a
// real Convex runtime, with real sign-ups, uploads, the scheduler and the cron function.
//
// It only ever talks to a LOCAL backend: it creates and purges test users and runs seedSocial:clear,
// which must never happen on the shared deployment. To run it, from a scratch copy of the repo that has
// no .env.local (so the CLI cannot pick the shared deployment):
//
//   CONVEX_AGENT_MODE=anonymous npx convex dev --typecheck disable      (leave running)
//   node tests/people.probes.mjs
//
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import { ConvexHttpClient } from "convex/browser";
import { anyApi as api } from "convex/server";

const URL = "http://127.0.0.1:3210";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL)) throw new Error("This script only runs against a local Convex backend");
const ROOT = path.resolve(import.meta.dirname, "..");
const RUN = `prb${Date.now() % 100000}_`;
const PASSWORD = "correct horse battery 9!";
const env = { ...process.env, CONVEX_AGENT_MODE: "anonymous" };
for (const k of ["CONVEX_DEPLOYMENT", "CONVEX_DEPLOY_KEY", "CONVEX_SELF_HOSTED_URL", "CONVEX_SELF_HOSTED_ADMIN_KEY"]) delete env[k];
const cli = (...args) => execFileSync("npx", ["convex", ...args], { cwd: ROOT, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const run = (name, args = {}) => { const out = cli("run", name, JSON.stringify(args)); try { return JSON.parse(out); } catch { return out.trim(); } };
const results = [];
async function step(name, fn) {
  try { await fn(); results.push([name, null]); console.log(`PASS  ${name}`); }
  catch (error) { results.push([name, error]); console.log(`FAIL  ${name}\n      ${String(error?.message ?? error).split("\n").slice(0, 8).join("\n      ")}`); }
}
async function signUp(name, extra = {}) {
  const client = new ConvexHttpClient(URL);
  const username = RUN + name;
  const result = await client.mutation(api.auth.signUpWithUsernamePassword, { username, password: PASSWORD, displayName: name, homeCity: "San Francisco", birthday: "1995-05-05", ...extra });
  client.setAuth(result.tokens.accessToken);
  const user = { client, username, userId: result.tokens.userId, q: (f, a = {}) => client.query(f, a), m: (f, a = {}) => client.mutation(f, a) };
  await user.m(api.users.saveQuiz, { answers: [[3, 0], [2], [0], [3], [3], [0, 3]] });
  return user;
}
const befriend = async (a, b) => { const r = await a.m(api.friends.request, { userId: b.userId }); await b.m(api.friends.respond, { requestId: r.requestId, accept: true }); };
const page = (numItems = 15, cursor = null) => ({ paginationOpts: { numItems, cursor } });
const SF = { lat: 37.7587, lng: -122.3885 };
const rankArgs = (id, extra = {}) => ({ kind: "place", id, bucket: "loved", position: 1, comparisons: [], tags: [], ...extra });

const me = await signUp("me");
const places = (await me.q(api.discover.nearby, { ...SF, radiusMeters: 3000, limit: 60 })).items.filter((i) => i.kind === "place");
const food = places.filter((i) => i.category === "food");
const culture = places.filter((i) => i.category === "culture");
console.log(`places: ${places.length}, events already in the local db: ${(await me.q(api.discover.nearby, { ...SF, radiusMeters: 30000, limit: 60, filter: "events" })).items.length}`);

await step("six ranks sent at the same moment end with positions 1..6 and no gaps", async () => {
  const user = await signUp("racer");
  const targets = [...food.slice(0, 6)];
  const done = await Promise.allSettled(targets.map((t) => user.m(api.rankings.rank, rankArgs(t.id))));
  const failed = done.filter((d) => d.status === "rejected");
  assert.equal(failed.length, 0, failed.map((f) => f.reason.message.split("\n")[0]).join(" | "));
  const list = await user.q(api.rankings.listInBucket, { category: "food", bucket: "loved" });
  assert.deepEqual(list.map((i) => i.position), [1, 2, 3, 4, 5, 6]);
  assert.equal(new Set(list.map((i) => i.score)).size, 6);
  assert.equal((await user.q(api.rankings.mine)).length, 6);
});

await step("double-tapped friend request and reaction don't create duplicates", async () => {
  const a = await signUp("dbl_a"), b = await signUp("dbl_b");
  const sent = await Promise.all([1, 2, 3, 4].map(() => a.m(api.friends.request, { userId: b.userId })));
  assert.equal(new Set(sent.map((s) => s.requestId)).size, 1, "parallel requests made several rows");
  assert.equal((await b.q(api.friends.list)).incoming.length, 1);
  assert.equal(await b.q(api.notifications.unreadCount), 1);
  await b.m(api.friends.respond, { requestId: sent[0].requestId, accept: true });
  await a.m(api.rankings.rank, rankArgs(food[0].id));
  const postId = (await b.q(api.posts.friendsFeed))[0].postId;
  await Promise.all([1, 2, 3].map(() => b.m(api.posts.react, { postId, emoji: "🔥" })));
  const item = await a.q(api.posts.get, { postId });
  assert.ok(item.reactionCount <= 1, `one person ended with ${item.reactionCount} reactions`);
});

await step("feed first page when strangers posted more recently than my friend", async () => {
  const viewer = await signUp("viewer"), friend = await signUp("friend");
  await befriend(viewer, friend);
  for (const t of culture.slice(0, 3)) await friend.m(api.rankings.rank, rankArgs(t.id));
  const strangers = [];
  for (let k = 0; k < 4; k++) strangers.push(await signUp(`stranger${k}`));
  for (const s of strangers) for (const t of food.slice(0, 8)) await s.m(api.rankings.rank, rankArgs(t.id));
  const first = await viewer.q(api.posts.feed, page(15));
  console.log(`      32 newer posts by strangers, 3 by my friend: first page of 15 has ${first.page.length} item(s), isDone=${first.isDone}`);
  let all = [...first.page], cursor = first.continueCursor, done = first.isDone, calls = 1;
  while (!done && calls < 10) { const next = await viewer.q(api.posts.feed, page(15, cursor)); all.push(...next.page); cursor = next.continueCursor; done = next.isDone; calls++; }
  assert.equal(all.length, 3, `paging to the end found ${all.length} posts`);
  assert.equal(first.page.length, 3, `the friend's 3 posts only showed up after ${calls} page loads`);
  // What a client sees when the row limit is hit before anything matches (forced here with a tiny limit).
  const limited = await viewer.q(api.posts.feed, { paginationOpts: { numItems: 15, cursor: null, maximumRowsRead: 5 } });
  console.log(`      with a 5-row scan limit: ${limited.page.length} items, isDone=${limited.isDone}, pageStatus=${limited.pageStatus}, splitCursor=${limited.splitCursor ? "set" : limited.splitCursor}`);
  let got = [...limited.page], c = limited.continueCursor, d = limited.isDone, n = 1;
  while (!d && n < 30) { const next = await viewer.q(api.posts.feed, { paginationOpts: { numItems: 15, cursor: c, maximumRowsRead: 5 } }); got.push(...next.page); c = next.continueCursor; d = next.isDone; n++; }
  assert.equal(got.length, 3, `with the scan limit, paging to the end found ${got.length} posts in ${n} calls`);
  // under 21 cannot rank nightlife
  const kid = await signUp("kid", { birthday: `${new Date().getUTCFullYear() - 19}-01-01` });
  const bar = places.find((i) => i.category === "nightlife");
  await kid.m(api.rankings.rank, rankArgs(bar.id)).then(() => assert.fail("an under-21 user ranked a bar"), (e) => assert.match(e.message, /isn't available/));
  // profile counts hide private items from others
  await friend.m(api.rankings.rank, rankArgs(food[0].id, { visibility: "private" }));
  assert.deepEqual([(await friend.q(api.profile.get, {})).counts.ranked, (await viewer.q(api.profile.get, { userId: friend.userId })).counts.ranked], [4, 3]);
});

await step("a friend request to someone with requests switched off creates no notification, but still shows in their list", async () => {
  const a = await signUp("pref_a"), b = await signUp("pref_b");
  await b.m(api.settings.update, { notifPrefs: { friendRequests: false } });
  await a.m(api.friends.request, { userId: b.userId });
  assert.equal(await b.q(api.notifications.unreadCount), 0);
  assert.equal((await b.q(api.friends.list)).incoming.length, 1);
});

await step("an account with more rows than one batch is signed out at once and fully deleted in the background", async () => {
  const big = await signUp("big"), other = await signUp("other");
  await befriend(big, other);
  await other.m(api.rankings.rank, rankArgs(food[0].id));
  const postId = (await big.q(api.posts.friendsFeed))[0].postId;
  for (let k = 0; k < 170; k += 10) await Promise.all(Array.from({ length: 10 }, (_, j) => big.m(api.posts.addComment, { postId, text: `comment ${k + j}` })));
  assert.equal((await other.q(api.posts.get, { postId })).commentCount, 170);
  await big.m(api.settings.deleteAccount, { confirmUsername: big.username });
  assert.equal(await big.q(api.users.me), null, "still signed in right after deleteAccount");
  let left = -1;
  for (let k = 0; k < 20 && left !== 0; k++) { await new Promise((r) => setTimeout(r, 300)); left = (await other.q(api.posts.get, { postId })).commentCount; }
  assert.equal(left, 0, `${left} comments of the deleted user remain`);
  assert.deepEqual((await other.q(api.friends.list)).friends, []);
  assert.deepEqual(await other.q(api.friends.search, { text: big.username }), []);
  const again = await new ConvexHttpClient(URL).mutation(api.auth.signInWithUsernamePassword, { username: big.username, password: PASSWORD }).then((r) => r.status, (e) => "refused");
  assert.notEqual(again, "complete");
});

await step("events: rank an event, mark going, and the tonight cron notifies a matching user once", async () => {
  const likes = [0.9, 0.85, 0.7, 0.5, 0.9, 0.5, 0.3, 0.3, 0.95, 0.15, 0.15, 0.15, 0.15];
  const rows = [0, 1].map((k) => ({ title: `${RUN}Warehouse Night ${k}`, start: Date.now() + (2 + k) * 3_600_000, category: "live", lat: SF.lat, lng: SF.lng, city: "San Francisco", venueVector: likes, source: "manual", sourceId: `${RUN}${k}` }));
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "clubi-")), "events.jsonl");
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n"));
  cli("import", "--table", "events", "--append", file);
  const fan = await signUp("fan");
  const events = (await fan.q(api.discover.nearby, { ...SF, radiusMeters: 3000, limit: 60, filter: "events" })).items.filter((i) => i.name.startsWith(RUN));
  assert.equal(events.length, 2, "imported events are not in discover.nearby");
  assert.deepEqual(await fan.m(api.saves.toggle, { kind: "event", id: events[0].id, type: "going" }), { saved: true });
  const saved = await fan.q(api.saves.list, { type: "going" });
  assert.deepEqual([saved.length, saved[0].kind, typeof saved[0].startsAt], [1, "event", "number"]);
  const before = await fan.q(api.notifications.unreadCount);
  run("notificationsCron:eventTonight");
  run("notificationsCron:eventTonight");
  const notes = (await fan.q(api.notifications.list)).filter((n) => n.type === "event_tonight");
  console.log(`      tonight notifications for the fan after two cron runs: ${notes.length} (${notes.map((n) => n.title).join(" | ")})`);
  assert.ok(notes.length >= 1 && notes.length <= 3 && new Set(notes.map((n) => n.link)).size === notes.length);
  const ranked = await fan.m(api.rankings.rank, { kind: "event", id: events[0].id, bucket: "loved", position: 1, comparisons: [], tags: [] });
  assert.equal(ranked.label, "#1 of your shows · 8.4");
  const mine = await fan.q(api.rankings.mine, { category: "live" });
  assert.deepEqual([mine[0].kind, mine[0].id], ["event", events[0].id]);
  assert.ok(before >= 0);
});

await step("signed out: every query returns null or empty, every mutation says Not signed in", async () => {
  const anon = new ConvexHttpClient(URL);
  const id = { user: me.userId, place: food[0].id };
  const queries = { "users.me": [api.users.me, {}], "settings.get": [api.settings.get, {}], "friends.list": [api.friends.list, {}], "friends.search": [api.friends.search, { text: "a" }],
    "friends.suggestions": [api.friends.suggestions, {}], "friends.blocked": [api.friends.blocked, {}], "posts.feed": [api.posts.feed, page()], "posts.friendsFeed": [api.posts.friendsFeed, {}],
    "posts.byUser": [api.posts.byUser, { userId: id.user, ...page() }], "profile.get": [api.profile.get, {}], "profile.compare": [api.profile.compare, { userId: id.user }],
    "rankings.mine": [api.rankings.mine, {}], "rankings.listInBucket": [api.rankings.listInBucket, { category: "food", bucket: "loved" }], "trips.list": [api.trips.list, {}],
    "saves.list": [api.saves.list, {}], "notifications.list": [api.notifications.list, {}], "notifications.unreadCount": [api.notifications.unreadCount, {}] };
  for (const [name, [fn, args]] of Object.entries(queries)) {
    const value = await anon.query(fn, args);
    const empty = value === null || value === 0 || (Array.isArray(value) && value.length === 0) || (value.page?.length === 0) || (value.friends?.length === 0 && value.incoming?.length === 0);
    assert.ok(empty, `${name} returned data to a signed-out caller: ${JSON.stringify(value).slice(0, 120)}`);
  }
  const mutations = { "rankings.rank": [api.rankings.rank, rankArgs(id.place)], "friends.request": [api.friends.request, { userId: id.user }], "friends.block": [api.friends.block, { userId: id.user }],
    "posts.generateUploadUrl": [api.posts.generateUploadUrl, {}], "settings.update": [api.settings.update, { bio: "x" }], "settings.generateAvatarUploadUrl": [api.settings.generateAvatarUploadUrl, {}],
    "settings.deleteAccount": [api.settings.deleteAccount, { confirmUsername: "x" }], "trips.create": [api.trips.create, { name: "x" }], "saves.toggle": [api.saves.toggle, { kind: "place", id: id.place, type: "want" }] };
  for (const [name, [fn, args]] of Object.entries(mutations)) {
    await anon.mutation(fn, args).then(() => assert.fail(`${name} worked signed out`), (e) => assert.match(e.message, /Not signed in/, name));
  }
});

run("users:purgeTestUsers", { prefixes: [RUN] });
const failed = results.filter(([, error]) => error !== null);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
