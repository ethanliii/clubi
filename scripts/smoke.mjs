// End-to-end check of the backend against a real deployment, as a real signed-in user.
// Usage: node scripts/smoke.mjs [username] [password]     (reads EXPO_PUBLIC_CONVEX_URL from .env.local)
import { ConvexHttpClient } from "convex/browser";
import { anyApi as api } from "convex/server";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const url = process.env.CONVEX_URL ?? env.EXPO_PUBLIC_CONVEX_URL;
const [username = "ethan_test", password = "clubi-test-2026"] = process.argv.slice(2);
const LAT = 37.7608, LNG = -122.3861;
const client = new ConvexHttpClient(url);
let pass = 0, fail = 0;
const short = (v) => { const s = JSON.stringify(v); return s === undefined ? "undefined" : s.length > 220 ? s.slice(0, 220) + "…" : s; };
async function step(name, fn, check) {
  try {
    const out = await fn();
    const problem = check ? check(out) : null;
    if (problem) { fail++; console.log(`✖ ${name}: ${problem}\n    got ${short(out)}`); } else { pass++; console.log(`✔ ${name}  ${short(out)}`); }
    return out;
  } catch (e) { fail++; console.log(`✖ ${name}: threw ${String(e.message ?? e).split("\n").slice(0, 3).join(" | ")}`); return undefined; }
}
const q = (f, a = {}) => client.query(f, a), m = (f, a = {}) => client.mutation(f, a);
const nonEmpty = (label) => (x) => (Array.isArray(x) && x.length > 0 ? null : `${label} is empty`);

const signedIn = await step("sign in", () => m(api.auth.signInWithUsernamePassword, { username, password }), (r) => (r?.tokens?.accessToken ? null : "no token"));
client.setAuth(signedIn.tokens.accessToken);

const me = await step("users.me", () => q(api.users.me), (r) => (r?.userId ? null : "null"));
await step("users.saveQuiz", () => m(api.users.saveQuiz, { answers: [[0, 3], [2], [1], [2], [2], [0, 3]] }), (r) => (r?.tasteSummary?.length ? null : "no tasteSummary"));
const nearby = await step("discover.nearby", () => q(api.discover.nearby, { lat: LAT, lng: LNG, limit: 40 }), (r) => (r?.items?.length && r.items.every((i) => i.why && i.score >= 1 && i.score <= 10) ? null : "bad items"));
await step("discover.nearby bars", () => q(api.discover.nearby, { lat: LAT, lng: LNG, filter: "bars", limit: 10 }), (r) => (r?.items?.length ? null : "empty"));
await step("discover.tonight", () => q(api.discover.tonight, { lat: LAT, lng: LNG }), (r) => (r?.topPicks ? null : "no topPicks"));
await step("discover.upcoming", () => q(api.discover.upcoming, { lat: LAT, lng: LNG }), nonEmpty("upcoming"));
const places = nearby.items.filter((i) => i.kind === "place" && i.category === "nightlife").slice(0, 3);
const bars = places.length >= 3 ? places : nearby.items.filter((i) => i.kind === "place").slice(0, 3);
const [a, b, c] = bars;
await step("places.get", () => q(api.places.get, { kind: "place", id: a.id }), (r) => (r?.name ? null : "null"));
await step("places.search", () => q(api.places.search, { text: a.name.split(" ")[0], lat: LAT, lng: LNG }), nonEmpty("search"));
await step("discover.similar", () => q(api.discover.similar, { kind: "place", id: a.id, lat: LAT, lng: LNG }), nonEmpty("similar"));
await step("debug.explain", () => q(api.debug.explain, { kind: "place", id: a.id, lat: LAT, lng: LNG }), (r) => (r ? null : "null"));

const sameCat = bars.filter((x) => x.category === a.category);
const r1 = await step("rankings.rank #1", () => m(api.rankings.rank, { kind: "place", id: a.id, bucket: "loved", position: 1, comparisons: [], tags: ["smoke"], caption: "Smoke test ranking" }), (r) => (r?.label ? null : "no label"));
if (sameCat.length > 1) {
  await step("rankings.listInBucket", () => q(api.rankings.listInBucket, { category: a.category, bucket: "loved" }), nonEmpty("bucket"));
  await step("rankings.rank #2 with comparison", () => m(api.rankings.rank, { kind: "place", id: sameCat[1].id, bucket: "loved", position: 1, comparisons: [{ winnerId: sameCat[1].id, loserId: a.id }], tags: [] }), (r) => (r?.position === 1 ? null : "not position 1"));
}
await step("rankings.mine", () => q(api.rankings.mine, {}), nonEmpty("mine"));
const questions = await step("insights.questionsFor", () => q(api.insights.questionsFor, { kind: "place", id: a.id }), (r) => (r?.length >= 3 && r.every((x) => x.options.length >= 2) ? null : "fewer than 3 questions"));
await step("insights.submit", () => m(api.insights.submit, { kind: "place", id: a.id, rankingId: r1?.rankingId, answers: (questions ?? []).map((x) => ({ questionId: x.id, optionIds: [x.options[0].id] })) }), (r) => (r?.saved > 0 ? null : "saved 0"));
await step("insights.venue", () => q(api.insights.venue, { kind: "place", id: a.id }), (r) => (r?.nAnswers > 0 ? null : "nAnswers 0"));
await step("insights.dashboard", () => q(api.insights.dashboard, { kind: "place", id: a.id }), (r) => (r?.buckets ? null : "no buckets"));

const feed = await step("posts.feed (page 1)", () => q(api.posts.feed, { paginationOpts: { numItems: 10, cursor: null } }), (r) => (r?.page?.length ? null : "empty page"));
await step("posts.friendsFeed", () => q(api.posts.friendsFeed), nonEmpty("feed"));
const post = feed?.page?.find((p) => p.author.userId !== me?.userId) ?? feed?.page?.[0];
if (post) {
  await step("posts.react", () => m(api.posts.react, { postId: post.postId }), (r) => (r?.reactionCount >= 1 ? null : "count 0"));
  await step("posts.addComment", () => m(api.posts.addComment, { postId: post.postId, text: "Smoke test comment" }), (r) => (r?.text ? null : "no comment"));
  await step("posts.comments", () => q(api.posts.comments, { postId: post.postId }), nonEmpty("comments"));
}
await step("posts.generateUploadUrl", () => m(api.posts.generateUploadUrl), (r) => (typeof r === "string" ? null : "not a url"));

const friends = await step("friends.list", () => q(api.friends.list), (r) => (r?.friends?.length ? null : "no friends"));
await step("friends.search", () => q(api.friends.search, { text: "demo" }), nonEmpty("search"));
await step("friends.suggestions", () => q(api.friends.suggestions, {}), (r) => (Array.isArray(r) && r.every((s) => s.reason) ? null : "missing reason"));
if (friends?.incoming?.[0]) await step("friends.respond (accept)", () => m(api.friends.respond, { requestId: friends.incoming[0].requestId, accept: true }));
const friend = friends?.friends?.[0];
await step("profile.get (me)", () => q(api.profile.get, {}), (r) => (r?.user?.isMe ? null : "not me"));
if (friend) {
  await step("profile.get (friend)", () => q(api.profile.get, { userId: friend.userId }), (r) => (r?.canSee ? null : "cannot see friend"));
  await step("profile.compare", () => q(api.profile.compare, { userId: friend.userId }), (r) => (r?.summary ? null : "no summary"));
}
await step("settings.get", () => q(api.settings.get), (r) => (r?.notifPrefs ? null : "no prefs"));
await step("settings.update", () => m(api.settings.update, { bio: "Smoke test bio" }), (r) => (r?.bio === "Smoke test bio" ? null : "bio not saved"));

const trip = await step("trips.create", () => m(api.trips.create, { name: "Smoke test night", city: "San Francisco", lat: LAT, lng: LNG, memberIds: friend ? [friend.userId] : [] }), (r) => (r?.tripId ? null : "no tripId"));
await step("trips.list", () => q(api.trips.list), nonEmpty("trips"));
if (trip?.tripId) {
  await step("trips.get", () => q(api.trips.get, { tripId: trip.tripId }), (r) => (r?.members?.length ? null : "no members"));
  await step("trips.suggestMembers", () => q(api.trips.suggestMembers, { tripId: trip.tripId }), (r) => (Array.isArray(r) ? null : "not a list"));
  await step("trips.vote", () => m(api.trips.vote, { tripId: trip.tripId, kind: "place", id: a.id, vote: 1 }), (r) => (r?.votesUp === 1 ? null : "votesUp != 1"));
  await step("discover.forGroup (trip)", () => q(api.discover.forGroup, { lat: LAT, lng: LNG, tripId: trip.tripId, limit: 5 }), (r) => (r?.items?.length ? null : "empty"));
  await step("discover.plan (trip)", () => q(api.discover.plan, { lat: LAT, lng: LNG, tripId: trip.tripId }), (r) => (r?.stops?.length ? null : "no stops"));
}
if (friend) await step("discover.forGroup (friend)", () => q(api.discover.forGroup, { lat: LAT, lng: LNG, memberIds: [friend.userId], limit: 5 }), (r) => (r?.items?.[0]?.memberScores?.length >= 2 ? null : "memberScores < 2"));
await step("saves.toggle", () => m(api.saves.toggle, { kind: "place", id: (c ?? a).id, type: "want" }), (r) => (r?.saved === true ? null : "not saved"));
await step("saves.list", () => q(api.saves.list, {}), nonEmpty("saves"));
await step("notifications.list", () => q(api.notifications.list), (r) => (Array.isArray(r) ? null : "not a list"));
await step("notifications.unreadCount", () => q(api.notifications.unreadCount), (r) => (typeof r === "number" ? null : "not a number"));
const perf = await step("performers.search", () => q(api.performers.search, { text: "a" }), (r) => (Array.isArray(r) ? null : "not a list"));
await step("performers.following", () => q(api.performers.following), (r) => (Array.isArray(r) ? null : "not a list"));
if (perf?.[0]) await step("performers.follow", () => m(api.performers.follow, { performerId: perf[0].performerId, follow: true }));

console.log(`\n${pass} passed, ${fail} failed against ${url} as ${username}`);
process.exit(fail ? 1 : 0);
