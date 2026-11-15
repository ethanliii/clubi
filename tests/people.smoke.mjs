// Owner: People session. NOT run by `npm test`. An end-to-end check of the People functions against a
// real Convex runtime, with real sign-ups, uploads, the scheduler and the cron function.
//
// It only ever talks to a LOCAL backend: it creates and purges test users and runs seedSocial:clear,
// which must never happen on the shared deployment. To run it, from a scratch copy of the repo that has
// no .env.local (so the CLI cannot pick the shared deployment):
//
//   CONVEX_AGENT_MODE=anonymous npx convex dev --typecheck disable      (leave running)
//   node tests/people.smoke.mjs
//
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { anyApi as api } from "convex/server";

const URL = "http://127.0.0.1:3210";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL)) throw new Error("This script only runs against a local Convex backend");
const ROOT = path.resolve(import.meta.dirname, "..");
const RUN = `smk${Date.now() % 100000}_`;
const PASSWORD = "correct horse battery 9!";
const env = { ...process.env, CONVEX_AGENT_MODE: "anonymous" };
for (const k of ["CONVEX_DEPLOYMENT", "CONVEX_DEPLOY_KEY", "CONVEX_SELF_HOSTED_URL", "CONVEX_SELF_HOSTED_ADMIN_KEY"]) delete env[k];
const run = (name, args = {}) => {
  const out = execFileSync("npx", ["convex", "run", name, JSON.stringify(args)], { cwd: ROOT, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try { return JSON.parse(out); } catch { return out.trim(); }
};

const results = [];
async function step(name, fn) {
  try { await fn(); results.push([name, null]); console.log(`PASS  ${name}`); }
  catch (error) { results.push([name, error]); console.log(`FAIL  ${name}\n      ${String(error?.message ?? error).split("\n").slice(0, 6).join("\n      ")}`); }
}
const rejects = async (promise, pattern) => {
  try { await promise; } catch (error) { assert.match(String(error.message), pattern); return; }
  assert.fail(`expected an error matching ${pattern}`);
};

async function signUp(name, extra = {}) {
  const client = new ConvexHttpClient(URL);
  const username = RUN + name;
  const result = await client.mutation(api.auth.signUpWithUsernamePassword, { username, password: PASSWORD, displayName: name[0].toUpperCase() + name.slice(1), homeCity: "San Francisco", birthday: "1995-05-05", ...extra });
  assert.equal(result.status, "complete");
  client.setAuth(result.tokens.accessToken);
  return { client, username, userId: result.tokens.userId, q: (f, a = {}) => client.query(f, a), m: (f, a = {}) => client.mutation(f, a) };
}
const page = (numItems = 15, cursor = null) => ({ paginationOpts: { numItems, cursor } });
const SF = { lat: 37.7587, lng: -122.3885 };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
async function upload(user, generate) {
  const url = await user.m(generate);
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "image/png" }, body: PNG });
  assert.equal(response.status, 200);
  return (await response.json()).storageId;
}

console.log("seedPlaces:", JSON.stringify(run("seedPlaces:run")));
let ethan, bryan, cara, sam, teen, bars, foods, parks;

await step("sign up five users, take the quiz", async () => {
  ethan = await signUp("ethan");
  bryan = await signUp("bryan", { homeCity: "New York" });
  cara = await signUp("cara");
  sam = await signUp("sam");
  teen = await signUp("teen", { birthday: `${new Date().getUTCFullYear() - 19}-01-01` });
  for (const [user, answers] of [[ethan, [[3, 0], [2], [0], [3], [3], [0, 3]]], [bryan, [[3], [2], [1], [3], [2], [0]]], [cara, [[5], [0], [2], [0], [0], [1]]], [sam, [[1], [1], [1], [1], [1], [1]]], [teen, [[2], [1], [1], [1], [1], [1]]]]) {
    const saved = await user.m(api.users.saveQuiz, { answers });
    assert.equal(saved.tasteSummary.length, 4);
  }
  const me = await ethan.q(api.users.me);
  assert.deepEqual([me.username, me.onboarded, me.unreadCount, me.bio], [ethan.username, true, 0, undefined]);
});

await step("find seeded places through discover.nearby", async () => {
  const nearby = await ethan.q(api.discover.nearby, { ...SF, radiusMeters: 3000, limit: 60 });
  const places = nearby.items.filter((item) => item.kind === "place");
  bars = places.filter((item) => item.category === "nightlife");
  foods = places.filter((item) => item.category === "food");
  parks = places.filter((item) => item.category === "outdoors");
  assert.ok(bars.length >= 4 && foods.length >= 3 && parks.length >= 1, `bars ${bars.length} foods ${foods.length} parks ${parks.length}`);
});

await step("settings: get, update, validation, prefs merge", async () => {
  const before = await ethan.q(api.settings.get);
  assert.deepEqual([before.username, before.defaultVisibility, before.discoverable, before.birthday], [ethan.username, "friends", true, "1995-05-05"]);
  const after = await ethan.m(api.settings.update, { displayName: "  Ethan   Li ", bio: " building clubi ", notifPrefs: { artistAlerts: false } });
  assert.deepEqual([after.displayName, after.bio, after.notifPrefs.artistAlerts, after.notifPrefs.reactions, after.homeCity], ["Ethan Li", "building clubi", false, true, "San Francisco"]);
  await rejects(ethan.m(api.settings.update, { bio: "x".repeat(161) }), /160/);
  await rejects(ethan.m(api.settings.update, { birthday: "05/05/1995" }), /YYYY-MM-DD/);
  await rejects(ethan.m(api.settings.update, { defaultVisibility: "everyone" }), /Validator|ArgumentValidationError/i);
  assert.equal((await ethan.q(api.users.me)).bio, "building clubi");
  assert.equal(await new ConvexHttpClient(URL).query(api.settings.get, {}), null);
});

let requestId;
await step("friends: request by username, lists, respond, search, mutual request accepts", async () => {
  const sent = await ethan.m(api.friends.request, { username: bryan.username });
  requestId = sent.requestId;
  assert.equal(sent.status, "outgoing");
  assert.deepEqual(await ethan.m(api.friends.request, { userId: bryan.userId }), sent);
  const incoming = (await bryan.q(api.friends.list)).incoming;
  assert.deepEqual([incoming.length, incoming[0].user.displayName, incoming[0].requestId], [1, "Ethan Li", requestId]);
  assert.equal((await bryan.q(api.users.me)).unreadCount, 1);
  await rejects(ethan.m(api.friends.respond, { requestId, accept: true }), /no longer open/);
  await bryan.m(api.friends.respond, { requestId, accept: true });
  const mine = await ethan.q(api.friends.list);
  assert.deepEqual(mine.friends.map((f) => [f.username, f.rankedCount]), [[bryan.username, 0]]);
  assert.ok(mine.friends[0].tasteMatchPct >= 0 && mine.friends[0].tasteMatchPct <= 100);
  // cara asks ethan, ethan asks back = accepted
  await cara.m(api.friends.request, { userId: ethan.userId });
  assert.equal((await ethan.m(api.friends.request, { username: "@" + cara.username })).status, "friends");
  // cara and bryan are friends too, sam is a stranger to everyone
  const cb = await cara.m(api.friends.request, { userId: bryan.userId });
  await bryan.m(api.friends.respond, { requestId: cb.requestId, accept: true });
  await rejects(ethan.m(api.friends.request, { userId: ethan.userId }), /can't add yourself/);
  await rejects(ethan.m(api.friends.request, { username: "no_such_user_zz" }), /couldn't find/);
});

await step("friends.search: real username prefix and real text search on display names", async () => {
  const byPrefix = await ethan.q(api.friends.search, { text: RUN + "br" });
  assert.deepEqual(byPrefix.map((r) => [r.username, r.status]), [[bryan.username, "friends"]]);
  const byName = await ethan.q(api.friends.search, { text: "Sam" });
  const hit = byName.find((r) => r.username === sam.username);
  assert.ok(hit, `display-name search did not find sam: ${JSON.stringify(byName.map((r) => r.username))}`);
  assert.equal(hit.status, "none");
  assert.ok(!(await ethan.q(api.friends.search, { text: RUN })).some((r) => r.userId === ethan.userId));
  await sam.m(api.settings.update, { discoverable: false });
  assert.ok(!(await ethan.q(api.friends.search, { text: RUN + "sam" })).some((r) => r.username === sam.username));
  await sam.m(api.settings.update, { discoverable: true });
});

let firstRank;
await step("rank: positions, scores, comparisons, re-rank teaches nothing twice", async () => {
  const base = { kind: "place", bucket: "loved", tags: ["patio"], comparisons: [] };
  firstRank = await bryan.m(api.rankings.rank, { ...base, id: bars[0].id, position: 1, caption: "  the one  " });
  assert.deepEqual([firstRank.score, firstRank.position, firstRank.outOf, firstRank.label], [8.4, 1, 1, "#1 of your bars · 8.4"]);
  const second = await bryan.m(api.rankings.rank, { ...base, id: bars[1].id, position: 1, comparisons: [{ winnerId: bars[1].id, loserId: bars[0].id }], groupSize: 3 });
  assert.deepEqual([second.score, second.position, second.outOf], [9.2, 1, 2]);
  const explainBefore = await bryan.q(api.debug.explain, { kind: "place", id: bars[1].id, ...SF });
  const again = await bryan.m(api.rankings.rank, { ...base, id: bars[1].id, position: 1, comparisons: [{ winnerId: bars[1].id, loserId: bars[0].id }] });
  assert.equal(again.rankingId, second.rankingId);
  const explainAfter = await bryan.q(api.debug.explain, { kind: "place", id: bars[1].id, ...SF });
  assert.deepEqual(explainAfter.terms?.elo ?? explainAfter.elo, explainBefore.terms?.elo ?? explainBefore.elo, "Elo moved on an identical re-rank");
  await bryan.m(api.rankings.rank, { ...base, id: foods[0].id, position: 1, bucket: "fine" });
  await bryan.m(api.rankings.rank, { ...base, id: bars[2].id, position: 5, bucket: "didnt", visibility: "private" });
  const list = await bryan.q(api.rankings.listInBucket, { category: "nightlife", bucket: "loved" });
  assert.deepEqual(list.map((i) => [i.id, i.position, i.score]), [[bars[1].id, 1, 9.2], [bars[0].id, 2, 7.5]]);
  const mine = await bryan.q(api.rankings.mine, { category: "nightlife" });
  assert.deepEqual(mine.map((i) => [i.id, i.position, i.bucket]), [[bars[1].id, 1, "loved"], [bars[0].id, 2, "loved"], [bars[2].id, 3, "didnt"]]);
  assert.equal((await bryan.q(api.rankings.mine)).length, 4);
  await rejects(bryan.m(api.rankings.rank, { ...base, id: bars[3].id, position: 1, comparisons: [{ winnerId: bars[3].id, loserId: foods[1].id }] }), /already ranked/);
  await rejects(bryan.m(api.rankings.rank, { ...base, id: bars[3].id, position: 1, groupSize: 0 }), /Group size/);
  await rejects(bryan.m(api.rankings.rank, { ...base, id: bars[3].id, position: 1, visibility: "nobody" }), /Validator|ArgumentValidationError/i);
});

let feedPost;
await step("feed: a friend's post is there at once, full FeedItem, private stays hidden, paging works", async () => {
  const first = await ethan.q(api.posts.feed, page(15));
  assert.deepEqual(first.page.map((i) => i.target.id), [foods[0].id, bars[1].id, bars[0].id]);
  feedPost = first.page[2];
  assert.deepEqual([feedPost.author.userId, feedPost.caption, feedPost.label, feedPost.position, feedPost.score, feedPost.visibility], [bryan.userId, "the one", "#2 of their bars · 7.5", 2, 7.5, "friends"]);
  assert.deepEqual([feedPost.tags, feedPost.photoUrls, feedPost.reactionCount, feedPost.commentCount, feedPost.myScoreForIt], [["patio"], [], 0, 0, undefined]);
  assert.equal((await bryan.q(api.posts.feed, page(15))).page.length, 4);
  assert.equal((await sam.q(api.posts.feed, page(15))).page.length, 0);
  // real cursors
  const p1 = await ethan.q(api.posts.feed, page(2));
  assert.equal(p1.isDone, false);
  const p2 = await ethan.q(api.posts.feed, page(2, p1.continueCursor));
  const seen = [...p1.page, ...p2.page].map((i) => i.postId);
  assert.equal(new Set(seen).size, seen.length);
  assert.deepEqual((await ethan.q(api.posts.friendsFeed)).map((i) => i.postId), first.page.map((i) => i.postId));
  const theirs = await ethan.q(api.posts.byUser, { userId: bryan.userId, ...page(10) });
  assert.equal(theirs.page.length, 3);
  assert.equal((await sam.q(api.posts.byUser, { userId: bryan.userId, ...page(10) })).page.length, 0);
  assert.equal(await sam.q(api.posts.get, { postId: feedPost.postId }), null);
  assert.equal((await ethan.q(api.posts.get, { postId: feedPost.postId })).postId, feedPost.postId);
  // ethan ranks the same bar: bryan hears "…and you gave it"
  await ethan.m(api.rankings.rank, { kind: "place", id: bars[0].id, bucket: "fine", position: 1, comparisons: [], tags: [] });
  const note = (await bryan.q(api.notifications.list))[0];
  assert.deepEqual([note.type, note.body, note.actor.userId, note.link], ["friend_ranked_same", "…and you gave it 7.5", ethan.userId, `/venue/place/${bars[0].id}`]);
  assert.equal((await ethan.q(api.posts.get, { postId: feedPost.postId })).myScoreForIt, 5.1);
});

await step("under-21 friend never gets nightlife posts", async () => {
  const r = await teen.m(api.friends.request, { userId: bryan.userId });
  await bryan.m(api.friends.respond, { requestId: r.requestId, accept: true });
  const items = await teen.q(api.posts.friendsFeed);
  assert.deepEqual(items.map((i) => i.target.category), ["food"]);
  const prof = await teen.q(api.profile.get, { userId: bryan.userId });
  assert.deepEqual(prof.lists.map((l) => l.category), ["food"]);
});

await step("photos: real upload, attach (max 4), served URL, rank with a photo", async () => {
  const mine = (await bryan.q(api.posts.feed, page(15))).page.find((i) => i.target.id === bars[0].id && i.author.userId === bryan.userId);
  let urls;
  for (let n = 0; n < 4; n++) {
    const storageId = await upload(bryan, api.posts.generateUploadUrl);
    urls = (await bryan.m(api.posts.attachPhoto, { postId: mine.postId, storageId })).photoUrls;
  }
  assert.equal(urls.length, 4);
  const got = await fetch(urls[0]);
  assert.deepEqual([got.status, got.headers.get("content-type")], [200, "image/png"]);
  const fifth = await upload(bryan, api.posts.generateUploadUrl);
  await rejects(bryan.m(api.posts.attachPhoto, { postId: mine.postId, storageId: fifth }), /at most 4/);
  await rejects(ethan.m(api.posts.attachPhoto, { postId: mine.postId, storageId: fifth }), /your own posts/);
  assert.equal((await ethan.q(api.posts.get, { postId: mine.postId })).photoUrls.length, 4);
  const withPhoto = await upload(cara, api.posts.generateUploadUrl);
  await cara.m(api.rankings.rank, { kind: "place", id: foods[1].id, bucket: "loved", position: 1, comparisons: [], tags: [], photoStorageId: withPhoto });
  const caraPost = (await ethan.q(api.posts.friendsFeed)).find((i) => i.author.userId === cara.userId);
  assert.equal(caraPost.photoUrls.length, 1);
});

await step("reactions and comments, with notifications and markRead", async () => {
  const postId = feedPost.postId;
  await ethan.m(api.notifications.markAllRead);
  await bryan.m(api.notifications.markAllRead);
  assert.deepEqual(await ethan.m(api.posts.react, { postId }), { reactionCount: 1, myReaction: "❤️" });
  assert.deepEqual(await ethan.m(api.posts.react, { postId, emoji: "🔥" }), { reactionCount: 1, myReaction: "🔥" });
  const off = await ethan.m(api.posts.react, { postId, emoji: "🔥" });
  assert.deepEqual([off.reactionCount, off.myReaction ?? null], [0, null]);
  await ethan.m(api.posts.react, { postId, emoji: "🔥" });
  const comment = await ethan.m(api.posts.addComment, { postId, text: "  going friday  " });
  assert.deepEqual([comment.text, comment.mine, comment.author.username], ["going friday", true, ethan.username]);
  await rejects(ethan.m(api.posts.addComment, { postId, text: "  " }), /Write something/);
  await rejects(sam.m(api.posts.addComment, { postId, text: "hi" }), /isn't available/);
  await rejects(sam.m(api.posts.react, { postId }), /isn't available/);
  const list = await bryan.q(api.posts.comments, { postId });
  assert.deepEqual(list.map((c) => [c.text, c.mine]), [["going friday", false]]);
  const item = await bryan.q(api.posts.get, { postId });
  assert.deepEqual([item.reactionCount, item.commentCount, item.myReaction ?? null], [1, 1, null]);
  const notes = await bryan.q(api.notifications.list);
  assert.deepEqual(notes.slice(0, 2).map((n) => n.type), ["post_comment", "post_reaction"]);
  assert.equal(notes.filter((n) => n.type === "post_reaction" && !n.read).length, 1, "reaction toggling notified more than once");
  assert.equal(await bryan.q(api.notifications.unreadCount), 2);
  await bryan.m(api.notifications.markRead, { id: notes[0].id });
  await ethan.m(api.notifications.markRead, { id: notes[1].id });   // not his: ignored
  assert.equal(await bryan.q(api.notifications.unreadCount), 1);
  await bryan.m(api.posts.removeComment, { commentId: comment.id });
  assert.equal((await bryan.q(api.posts.comments, { postId })).length, 0);
  // switch reactions off: no notification
  await bryan.m(api.settings.update, { notifPrefs: { reactions: false } });
  await cara.m(api.posts.react, { postId });
  assert.equal(await bryan.q(api.notifications.unreadCount), 1);
  await bryan.m(api.settings.update, { notifPrefs: { reactions: true } });
});

await step("post update and remove; ranking remove closes the gap", async () => {
  const mine = (await bryan.q(api.posts.feed, page(15))).page;
  const foodPost = mine.find((i) => i.target.id === foods[0].id);
  await bryan.m(api.posts.update, { postId: foodPost.postId, caption: "lunch spot", visibility: "public" });
  const asSam = await sam.q(api.posts.get, { postId: foodPost.postId });
  assert.deepEqual([asSam.caption, asSam.visibility], ["lunch spot", "public"]);
  await rejects(ethan.m(api.posts.update, { postId: foodPost.postId, caption: "x" }), /your own posts/);
  await bryan.m(api.posts.remove, { postId: foodPost.postId });
  assert.equal(await bryan.q(api.posts.get, { postId: foodPost.postId }), null);
  assert.equal((await bryan.q(api.rankings.mine, { category: "food" })).length, 1);
  await rejects(ethan.m(api.rankings.remove, { rankingId: firstRank.rankingId }), /your own/);
  const top = (await bryan.q(api.rankings.mine, { category: "nightlife" }))[0];
  await bryan.m(api.rankings.remove, { rankingId: top.rankingId });
  const left = await bryan.q(api.rankings.listInBucket, { category: "nightlife", bucket: "loved" });
  assert.deepEqual(left.map((i) => [i.id, i.position, i.score]), [[bars[0].id, 1, 8.4]]);
  assert.ok(!(await ethan.q(api.posts.friendsFeed)).some((i) => i.target.id === bars[1].id));
});

await step("profile.get and profile.compare", async () => {
  const mine = await bryan.q(api.profile.get, {});
  assert.deepEqual([mine.user.isMe, mine.user.status, mine.canSee, mine.tasteSummary.length], [true, "self", true, 4]);
  const theirs = await ethan.q(api.profile.get, { userId: bryan.userId });
  assert.deepEqual([theirs.user.status, theirs.canSee, theirs.counts.friends], ["friends", true, 3]);
  assert.deepEqual(theirs.lists.map((l) => [l.category, l.noun, l.items.length]), [["nightlife", "bars", 1], ["food", "food spots", 1]]);
  assert.ok(theirs.recentPosts.length >= 1);
  const closed = await sam.q(api.profile.get, { userId: bryan.userId });
  assert.deepEqual([closed.canSee, closed.user.status, closed.lists.length, closed.recentPosts.length, closed.tasteSummary.length], [false, "none", 0, 0, 0]);
  const cmp = await ethan.q(api.profile.compare, { userId: bryan.userId });
  assert.deepEqual(cmp.shared.map((s) => [s.id, s.myScore, s.theirScore]), [[bars[0].id, 5.1, 8.4]]);
  assert.deepEqual([cmp.agreePct, cmp.dims.length, cmp.me.username, cmp.them.username], [0, 4, ethan.username, bryan.username]);
  assert.ok(cmp.summary.length > 0 && cmp.tasteMatchPct >= 0 && cmp.tasteMatchPct <= 100);
  assert.equal(await sam.q(api.profile.compare, { userId: bryan.userId }), null);
});

await step("avatar: real upload, shown on every card", async () => {
  const storageId = await upload(ethan, api.settings.generateAvatarUploadUrl);
  const { avatarUrl } = await ethan.m(api.settings.setAvatar, { storageId });
  assert.equal((await fetch(avatarUrl)).status, 200);
  assert.equal((await ethan.q(api.settings.get)).avatarUrl, avatarUrl);
  assert.equal((await ethan.q(api.users.me)).avatarUrl, avatarUrl);
  assert.equal((await bryan.q(api.friends.list)).friends.find((f) => f.userId === ethan.userId).avatarUrl, avatarUrl);
  const second = await upload(ethan, api.settings.generateAvatarUploadUrl);
  const next = await ethan.m(api.settings.setAvatar, { storageId: second });
  assert.notEqual(next.avatarUrl, avatarUrl);
  assert.equal((await fetch(avatarUrl)).status, 404, "the old avatar file is still served");
});

let tripId;
await step("trips: create, invite, respond, vote, shortlist, suggestMembers, leave, remove", async () => {
  await rejects(ethan.m(api.trips.create, { name: "x", memberIds: [sam.userId] }), /only invite your friends/);
  ({ tripId } = await ethan.m(api.trips.create, { name: "NYC in March", city: "New York", lat: 40.72, lng: -74, vibe: "wild", startDate: Date.UTC(2027, 2, 12), memberIds: [bryan.userId] }));
  assert.deepEqual((await bryan.q(api.trips.list)).map((t) => [t.name, t.myStatus, t.memberCount, t.ownerName]), [["NYC in March", "invited", 1, "Ethan Li"]]);
  assert.equal((await bryan.q(api.notifications.list))[0].type, "trip_invite");
  await rejects(bryan.m(api.trips.vote, { tripId, kind: "place", id: foods[0].id, vote: 1 }), /Join the trip/);
  await bryan.m(api.trips.respond, { tripId, accept: true });
  const suggestions = await ethan.q(api.trips.suggestMembers, { tripId });
  assert.deepEqual(suggestions.map((s) => s.username), [cara.username]);
  assert.ok(suggestions[0].reason.length > 0 && suggestions[0].fitPct >= 0);
  const item = await ethan.m(api.trips.vote, { tripId, kind: "place", id: foods[0].id, vote: 1 });
  assert.deepEqual([item.votesUp, item.votesDown, item.myVote, item.addedBy.username], [1, 0, 1, ethan.username]);
  await bryan.m(api.trips.vote, { tripId, kind: "place", id: foods[0].id, vote: -1 });
  await bryan.m(api.trips.vote, { tripId, kind: "place", id: parks[0].id, vote: 1 });
  await ethan.m(api.trips.vote, { tripId, kind: "place", id: parks[0].id, vote: 1 });
  await rejects(ethan.m(api.trips.vote, { tripId, kind: "place", id: parks[0].id, vote: 3 }), /1, -1, or 0/);
  const detail = await bryan.q(api.trips.get, { tripId });
  assert.deepEqual(detail.shortlist.map((s) => [s.id, s.votesUp, s.votesDown, s.myVote]), [[parks[0].id, 2, 0, 1], [foods[0].id, 1, 1, -1]]);
  assert.deepEqual(detail.members.map((m) => [m.username, m.status, m.isOwner, m.isLocal]), [[ethan.username, "joined", true, false], [bryan.username, "joined", false, true]]);
  assert.deepEqual([detail.myStatus, detail.memberCount, detail.vibe, detail.lat], ["joined", 2, "wild", 40.72]);
  assert.equal(await sam.q(api.trips.get, { tripId }), null);
  await rejects(bryan.m(api.trips.update, { tripId, name: "mine" }), /Only the person who made/);
  await ethan.m(api.trips.update, { tripId, name: "NYC in spring" });
  // Brain's queries can read the trip tables
  const plan = await ethan.q(api.discover.plan, { ...SF, tripId }).catch((e) => `ERR ${e.message}`);
  console.log(`      discover.plan with tripId (Brain's side): ${typeof plan === "string" ? plan.split("\n")[1] ?? plan : "ok"}`);
  await bryan.m(api.trips.leave, { tripId });
  assert.equal((await ethan.q(api.trips.get, { tripId })).shortlist.find((s) => s.id === parks[0].id).votesUp, 1);
  await ethan.m(api.trips.remove, { tripId });
  assert.deepEqual(await ethan.q(api.trips.list), []);
});

await step("saves: toggle and list", async () => {
  assert.deepEqual(await ethan.m(api.saves.toggle, { kind: "place", id: foods[2].id, type: "want" }), { saved: true });
  await rejects(ethan.m(api.saves.toggle, { kind: "place", id: foods[2].id, type: "going" }), /only mark events/);
  const list = await ethan.q(api.saves.list, {});
  assert.deepEqual(list.map((s) => [s.id, s.type, s.category]), [[foods[2].id, "want", "food"]]);
  assert.ok(typeof list[0].lat === "number" && typeof list[0].name === "string");
  await rejects(teen.m(api.saves.toggle, { kind: "place", id: bars[3].id, type: "want" }), /isn't available/);
  assert.deepEqual(await ethan.m(api.saves.toggle, { kind: "place", id: foods[2].id, type: "want" }), { saved: false });
  assert.deepEqual(await ethan.q(api.saves.list, { type: "want" }), []);
});

await step("block and unblock", async () => {
  await ethan.m(api.friends.block, { userId: cara.userId });
  assert.ok(!(await ethan.q(api.friends.list)).friends.some((f) => f.userId === cara.userId));
  assert.deepEqual(await cara.q(api.friends.search, { text: ethan.username }), []);
  assert.equal(await cara.q(api.profile.get, { userId: ethan.userId }), null);
  assert.deepEqual((await ethan.q(api.friends.blocked)).map((c) => c.username), [cara.username]);
  await rejects(cara.m(api.friends.request, { userId: ethan.userId }), /couldn't find/);
  await ethan.m(api.friends.unblock, { userId: cara.userId });
  assert.equal((await cara.m(api.friends.request, { userId: ethan.userId })).status, "outgoing");
  await ethan.m(api.friends.cancel, { requestId: (await cara.q(api.friends.list)).outgoing[0].requestId }).then(() => assert.fail("cancel by the wrong person worked"), (e) => assert.match(e.message, /you sent/));
  await cara.m(api.friends.cancel, { requestId: (await cara.q(api.friends.list)).outgoing[0].requestId });
});

await step("friend suggestions on real data", async () => {
  // ethan – bryan – cara: cara is two hops from ethan now
  const list = await ethan.q(api.friends.suggestions, { limit: 5 });
  const hit = list.find((s) => s.username === cara.username);
  assert.ok(hit, JSON.stringify(list.map((s) => s.username)));
  assert.deepEqual([hit.mutualCount, hit.reason.startsWith("Friends with Bryan")], [1, true]);
  assert.ok(list.every((s) => s.reason.length > 0 && s.score >= 0 && s.score <= 1 && s.userId !== ethan.userId));
});

await step("demo seed: run for a real user, run twice, feed and suggestions, clear", async () => {
  const made = run("seedSocial:run", { forUsername: ethan.username });
  assert.deepEqual([made.users, made.trips, made.requests], [8, 1, 2]);
  assert.ok(made.rankings >= 64 && made.posts === made.rankings);
  const again = run("seedSocial:run", { forUsername: ethan.username });
  assert.deepEqual(again, { users: 0, rankings: 0, posts: 0, comparisons: 0, friendships: 0, requests: 0, trips: 0 });
  const overview = await ethan.q(api.friends.list);
  assert.deepEqual([overview.friends.length, overview.incoming.length], [5, 2]);
  const feed = await ethan.q(api.posts.friendsFeed);
  assert.equal(feed.length, 30);
  assert.ok(feed.every((i, k) => k === 0 || feed[k - 1].createdAt >= i.createdAt), "friendsFeed is not newest first");
  const first = await ethan.q(api.posts.feed, page(15));
  console.log(`      first feed page of 15 returned ${first.page.length} items`);
  const trip = (await ethan.q(api.trips.list))[0];
  assert.deepEqual([trip.name, trip.myStatus, trip.memberCount], ["Saturday in the Mission", "joined", 3]);
  assert.equal((await ethan.q(api.trips.get, { tripId: trip.tripId })).shortlist.length, 3);
  const group = await ethan.q(api.discover.forGroup, { ...SF, tripId: trip.tripId }).catch((e) => `ERR ${e.message}`);
  console.log(`      discover.forGroup with the seeded trip: ${typeof group === "string" ? group.slice(0, 120) : "ok"}`);
  const suggested = await ethan.q(api.friends.suggestions, {});
  assert.ok(suggested.some((s) => s.username.startsWith("demo_")), JSON.stringify(suggested.map((s) => s.username)));
  const nearby = await ethan.q(api.discover.nearby, { ...SF, radiusMeters: 3000, limit: 60 });
  assert.ok(nearby.items.some((i) => i.friends.length > 0), "no friend scores on any nearby card after seeding");
  let cleared = run("seedSocial:clear");
  for (let k = 0; k < 5 && cleared.continuing; k++) cleared = run("seedSocial:clear");
  assert.equal((await ethan.q(api.friends.list)).friends.length, 1);
  assert.deepEqual(await ethan.q(api.trips.list), []);
  assert.ok(!(await ethan.q(api.posts.friendsFeed)).some((i) => i.author.displayName.includes("Okafor")));
});

await step("event-tonight cron runs", async () => {
  run("notificationsCron:eventTonight");
});

await step("deleteAccount: wrong name refused, then gone everywhere, cannot sign in, username is free again", async () => {
  await rejects(bryan.m(api.settings.deleteAccount, { confirmUsername: "nope" }), /username exactly/);
  assert.equal(await bryan.m(api.settings.deleteAccount, { confirmUsername: bryan.username }), null);
  assert.equal(await bryan.q(api.users.me), null);
  assert.deepEqual((await ethan.q(api.friends.list)).friends, []);
  assert.ok(!(await ethan.q(api.posts.friendsFeed)).some((i) => i.author.userId === bryan.userId));
  assert.ok(!(await ethan.q(api.notifications.list)).some((n) => n.actor?.userId === bryan.userId));
  assert.equal(await ethan.q(api.profile.get, { userId: bryan.userId }), null);
  const fresh = new ConvexHttpClient(URL);
  const signIn = await fresh.mutation(api.auth.signInWithUsernamePassword, { username: bryan.username, password: PASSWORD }).then((r) => r, (e) => ({ error: e.message }));
  assert.ok(signIn.error !== undefined || signIn.status !== "complete", `a deleted account could still sign in: ${JSON.stringify(signIn).slice(0, 200)}`);
  const reborn = await signUp("bryan");
  assert.notEqual(reborn.userId, bryan.userId);
  assert.deepEqual((await reborn.q(api.friends.list)).friends, []);
});

await step("purgeTestUsers removes this run's accounts, and demo users that never had a sign-in", async () => {
  run("seedSocial:run", {});
  let result = run("users:purgeTestUsers", { prefixes: [RUN, "demo_"] });
  console.log(`      purge: ${JSON.stringify(result)}`);
  for (let k = 0; k < 20; k++) {
    await new Promise((r) => setTimeout(r, 500));
    if ((await new ConvexHttpClient(URL).query(api.users.me, {})) === null && k > 4) break;
  }
  assert.equal(await ethan.q(api.users.me), null);
  const check = await signUp("checker");
  assert.deepEqual(await check.q(api.friends.search, { text: "demo_" }), []);
  assert.deepEqual(await check.q(api.friends.search, { text: RUN + "ethan" }), []);
  run("users:purgeTestUsers", { prefixes: [RUN] });
});

const failed = results.filter(([, error]) => error !== null);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length === 0 ? 0 : 1);
