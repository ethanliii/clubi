import assert from "node:assert/strict";
import { test } from "node:test";
import { backend, fixtures, load, taste } from "./people.harness.mjs";

const trips = await load("trips");

async function world() {
  const t = backend();
  const f = fixtures(t);
  const me = await f.user("ethan", { displayName: "Ethan", homeCity: "San Francisco" });
  const bryan = await f.user("bryan", { displayName: "Bryan", homeCity: "New York" });
  const cara = await f.user("cara", { displayName: "Cara" });
  const stranger = await f.user("sam");
  await f.friends(me, bryan);
  await f.friends(cara, me);
  const bar = await f.place("Zeitgeist");
  const cafe = await f.place("Sightglass", { category: "food" });
  const park = await f.place("Dolores Park", { category: "outdoors" });
  const create = (extra = {}) => t.run(trips.create, me, { name: "NYC in March", city: "New York", ...extra });
  const vote = (userId, tripId, id, value) => t.run(trips.vote, userId, { tripId, kind: "place", id, vote: value });
  return { t, f, me, bryan, cara, stranger, bar, cafe, park, create, vote };
}

test("create validates its fields and invites friends only", async () => {
  const { t, me, bryan, stranger, create } = await world();
  await assert.rejects(t.run(trips.create, null, { name: "x" }), /Not signed in/);
  await assert.rejects(create({ name: "   " }), /1 to 60/);
  await assert.rejects(create({ lat: 40.7 }), /both a latitude and a longitude/);
  await assert.rejects(create({ lat: 140, lng: 0 }), /on the map/);
  await assert.rejects(create({ startDate: 2000, endDate: 1000 }), /before the start/);
  await assert.rejects(create({ vibe: "feral" }), /Vibe must be/);
  await assert.rejects(create({ memberIds: [stranger] }), /only invite your friends/);

  const { tripId } = await create({ name: "  NYC   in March ", lat: 40.7, lng: -74, startDate: 1000, endDate: 2000, vibe: "wild", memberIds: [bryan, bryan, me] });
  const trip = await t.db.get(tripId);
  assert.deepEqual([trip.name, trip.ownerId, trip.city, trip.vibe], ["NYC in March", me, "New York", "wild"]);
  assert.deepEqual(t.all("tripMembers").map((row) => [row.tripId, row.userId, row.status, row.invitedBy]), [[tripId, bryan, "invited", me]]);
  const sent = t.all("notifications");
  assert.deepEqual(sent.map((row) => [row.userId, row.type, row.link, row.title]), [[bryan, "trip_invite", `/trip/${tripId}`, "Ethan invited you to NYC in March"]]);
});

test("list and get: the owner, invited and joined members see it; strangers and people who declined don't", async () => {
  const { t, me, bryan, cara, stranger, create } = await world();
  const { tripId } = await create({ memberIds: [bryan, cara] });
  const status = async (userId) => (await t.run(trips.list, userId)).map((trip) => [trip.name, trip.myStatus, trip.memberCount, trip.ownerName]);
  assert.deepEqual(await status(me), [["NYC in March", "owner", 1, "Ethan"]]);
  assert.deepEqual(await status(bryan), [["NYC in March", "invited", 1, "Ethan"]]);
  assert.deepEqual(await status(stranger), []);
  assert.deepEqual(await status(null), []);
  assert.equal(await t.run(trips.get, stranger, { tripId }), null);
  assert.equal(await t.run(trips.get, null, { tripId }), null);

  await assert.rejects(t.run(trips.respond, stranger, { tripId, accept: true }), /open invite/);
  await t.run(trips.respond, bryan, { tripId, accept: true });
  await t.run(trips.respond, cara, { tripId, accept: false });
  await assert.rejects(t.run(trips.respond, bryan, { tripId, accept: true }), /open invite/);
  assert.deepEqual(await status(bryan), [["NYC in March", "joined", 2, "Ethan"]]);
  assert.deepEqual(await status(cara), []);
  assert.equal(await t.run(trips.get, cara, { tripId }), null);

  const detail = await t.run(trips.get, bryan, { tripId });
  assert.deepEqual([detail.myStatus, detail.memberCount, detail.city], ["joined", 2, "New York"]);
  assert.deepEqual(detail.members.map((member) => [member.username, member.status, member.isOwner, member.isLocal]),
    [["ethan", "joined", true, false], ["bryan", "joined", false, true], ["cara", "declined", false, false]]);
  assert.deepEqual(detail.shortlist, []);
  // The owner hears that Bryan joined.
  const update = t.all("notifications").filter((row) => row.type === "trip_update");
  assert.deepEqual(update.map((row) => [row.userId, row.title]), [[me, "Bryan joined NYC in March"]]);
});

test("update is the owner's; invite needs to be in the trip; a declined friend can be invited again", async () => {
  const { t, me, bryan, cara, stranger, create } = await world();
  const { tripId } = await create({ memberIds: [bryan], startDate: 5000 });
  await assert.rejects(t.run(trips.update, bryan, { tripId, name: "Mine now" }), /Only the person who made/);
  await assert.rejects(t.run(trips.update, stranger, { tripId, name: "x" }), /isn't available/);
  await assert.rejects(t.run(trips.update, me, { tripId, endDate: 4000 }), /before the start/);
  await t.run(trips.update, me, { tripId, name: "Spring in NYC", city: "", vibe: "chill" });
  const trip = await t.db.get(tripId);
  assert.deepEqual([trip.name, trip.city, trip.vibe, trip.startDate], ["Spring in NYC", undefined, "chill", 5000]);

  await assert.rejects(t.run(trips.invite, bryan, { tripId, userIds: [cara] }), /Join the trip/);
  await t.run(trips.respond, bryan, { tripId, accept: false });
  assert.deepEqual(await t.run(trips.invite, me, { tripId, userIds: [bryan, cara, me] }), { invited: 2 });
  assert.deepEqual(await t.run(trips.invite, me, { tripId, userIds: [bryan, cara] }), { invited: 0 });
  assert.deepEqual(t.all("tripMembers").map((row) => row.status), ["invited", "invited"]);
  // A joined member invites their own friends, not the owner's.
  await t.run(trips.respond, bryan, { tripId, accept: true });
  await assert.rejects(t.run(trips.invite, bryan, { tripId, userIds: [stranger] }), /only invite your friends/);
});

test("vote: members only, 1 / -1 / 0, the shortlist is every item with a +1, most net votes first", async () => {
  const { t, me, bryan, cara, stranger, bar, cafe, park, create, vote } = await world();
  const { tripId } = await create({ memberIds: [bryan, cara] });
  await assert.rejects(vote(bryan, tripId, bar, 1), /Join the trip to vote/);
  await assert.rejects(vote(stranger, tripId, bar, 1), /isn't available/);
  await t.run(trips.respond, bryan, { tripId, accept: true });
  await t.run(trips.respond, cara, { tripId, accept: true });
  await assert.rejects(vote(me, tripId, bar, 2), /1, -1, or 0/);

  const first = await vote(me, tripId, bar, 1);
  assert.deepEqual([first.name, first.category, first.votesUp, first.votesDown, first.myVote, first.addedBy.username], ["Zeitgeist", "nightlife", 1, 0, 1, "ethan"]);
  await vote(bryan, tripId, bar, -1);
  await vote(cara, tripId, cafe, 1);
  await vote(bryan, tripId, cafe, 1);
  await vote(bryan, tripId, park, -1);
  const names = async (userId = me) => (await t.run(trips.get, userId, { tripId })).shortlist.map((item) => [item.name, item.votesUp, item.votesDown, item.myVote]);
  assert.deepEqual(await names(), [["Sightglass", 2, 0, undefined], ["Zeitgeist", 1, 1, 1]]);
  assert.deepEqual((await names(bryan)).map((row) => row[3]), [1, -1]);

  // Changing and clearing a vote: one row per person per item.
  const changed = await vote(bryan, tripId, bar, 1);
  assert.deepEqual([changed.votesUp, changed.votesDown, changed.myVote, changed.addedBy.username], [2, 0, 1, "ethan"]);
  const cleared = await vote(me, tripId, bar, 0);
  assert.deepEqual([cleared.votesUp, cleared.myVote, cleared.addedBy.username], [1, undefined, "bryan"]);
  await vote(bryan, tripId, bar, 0);
  const gone = await vote(bryan, tripId, bar, 0);
  assert.deepEqual([gone.votesUp, gone.votesDown, gone.addedBy], [0, 0, undefined]);
  assert.deepEqual(await names(), [["Sightglass", 2, 0, undefined]]);
  assert.equal(t.all("tripVotes").length, 3);
});

test("trip_update: a new shortlist item or a join notifies the others at most once an hour per trip", async () => {
  const { t, me, bryan, cara, bar, cafe, park, create, vote } = await world();
  const { tripId } = await create({ memberIds: [bryan, cara] });
  const updates = () => t.all("notifications").filter((row) => row.type === "trip_update").map((row) => [row.userId, row.title]);
  await t.run(trips.respond, bryan, { tripId, accept: true });
  assert.deepEqual(updates(), [[me, "Bryan joined NYC in March"]]);
  // Within the hour: the owner is not told again, Bryan (who has heard nothing yet) is told once.
  await t.run(trips.respond, cara, { tripId, accept: true });
  await vote(cara, tripId, bar, 1);
  await vote(cara, tripId, cafe, 1);
  assert.deepEqual(updates(), [[me, "Bryan joined NYC in March"], [bryan, "Cara joined NYC in March"]]);

  // More than an hour later a new item notifies everyone but the voter; a second +1 on it notifies nobody.
  for (const row of t.all("notifications")) await t.db.patch(row._id, { createdAt: row.createdAt - 2 * 3_600_000 });
  await vote(me, tripId, park, 1);
  await vote(bryan, tripId, park, 1);
  assert.deepEqual(updates().slice(2), [[bryan, "Ethan added Dolores Park to NYC in March"], [cara, "Ethan added Dolores Park to NYC in March"]]);
  // Someone with trip updates switched off hears nothing.
  await t.db.patch(cara, { notifPrefs: { tripUpdates: false } });
  for (const row of t.all("notifications")) await t.db.patch(row._id, { createdAt: row.createdAt - 2 * 3_600_000 });
  const before = updates().length;
  await vote(me, tripId, bar, -1);
  await vote(me, tripId, cafe, -1);
  assert.equal(updates().length, before);
});

test("leave removes my membership and votes; the owner removes the trip with members and votes", async () => {
  const { t, me, bryan, cara, bar, create, vote } = await world();
  const { tripId } = await create({ memberIds: [bryan, cara] });
  await t.run(trips.respond, bryan, { tripId, accept: true });
  await vote(bryan, tripId, bar, 1);
  await vote(me, tripId, bar, 1);
  await assert.rejects(t.run(trips.leave, me, { tripId }), /Delete it instead/);
  await t.run(trips.leave, bryan, { tripId });
  assert.deepEqual(t.all("tripMembers").map((row) => row.userId), [cara]);
  assert.deepEqual(t.all("tripVotes").map((row) => row.userId), [me]);
  assert.equal(await t.run(trips.get, bryan, { tripId }), null);
  assert.equal(await t.run(trips.leave, bryan, { tripId }), null);

  await assert.rejects(t.run(trips.remove, cara, { tripId }), /Only the person who made/);
  await t.run(trips.remove, me, { tripId });
  assert.deepEqual([t.all("trips").length, t.all("tripMembers").length, t.all("tripVotes").length], [0, 0, 0]);
  assert.equal(await t.run(trips.remove, me, { tripId }), null);
});

test("under-21 members can't shortlist nightlife and never see it on the shortlist", async () => {
  const { t, me, bryan, bar, cafe, create, vote } = await world();
  const { tripId } = await create({ memberIds: [bryan] });
  await t.run(trips.respond, bryan, { tripId, accept: true });
  await t.db.patch(bryan, { birthday: `${new Date().getUTCFullYear() - 19}-01-01` });
  await vote(me, tripId, bar, 1);
  await vote(me, tripId, cafe, 1);
  await assert.rejects(vote(bryan, tripId, bar, 1), /isn't available/);
  assert.deepEqual((await t.run(trips.get, bryan, { tripId })).shortlist.map((item) => item.name), ["Sightglass"]);
  assert.equal((await t.run(trips.get, me, { tripId })).shortlist.length, 2);
});

test("suggestMembers: my friends who aren't on the trip, locals and good fits first, each with a reason", async () => {
  const { t, f, me, bryan, cara, stranger, bar, cafe, park, create } = await world();
  const groupTaste = taste({ 0: 0.9, 4: 0.9 });
  await t.db.patch(me, { tasteVector: groupTaste });
  await t.db.patch(bryan, { tasteVector: taste({ 7: 0.9 }) });           // local to New York, different taste
  await t.db.patch(cara, { tasteVector: groupTaste });                   // same taste, not local
  const dan = await f.user("dan", { displayName: "Dan", tasteVector: taste({ 9: 0.9 }) });
  const eve = await f.user("eve", { displayName: "Eve", tasteVector: taste({ 9: 0.9 }) });
  const joined = await f.user("joined", { displayName: "Joined", tasteVector: groupTaste });
  for (const friend of [dan, eve, joined]) await f.friends(me, friend);
  await f.friends(eve, joined);
  // dan ranked two places I ranked.
  for (const [userId, places] of [[me, [bar, cafe, park]], [dan, [bar, cafe]]]) {
    for (const placeId of places) {
      await t.db.insert("rankings", { userId, placeId, category: "food", bucket: "loved", position: 1, score: 8 });
    }
  }
  const { tripId } = await create({ memberIds: [joined] });
  await t.run(trips.respond, joined, { tripId, accept: true });

  const list = await t.run(trips.suggestMembers, me, { tripId });
  assert.deepEqual(list.map((row) => row.username), ["cara", "bryan", "dan", "eve"]);
  assert.deepEqual(list.map((row) => row.reason), [
    "100% taste match with the group",
    "Lives in New York, knows the city",
    "Ranked 2 of the same places as you",
    "Friends with 2 people on this trip",
  ]);
  assert.deepEqual(list.map((row) => row.isLocal), [false, true, false, false]);
  // The group is me and "joined". cara: 0.45 taste + 0.1 × 1/2 friends. bryan: 0.25 local + 0.05.
  // dan: 0.2 × 2/5 shared + 0.05. eve: 0.1 × 2/2 friends.
  assert.deepEqual(list.map((row) => row.fitPct), [50, 30, 13, 10]);
  assert.ok(list.every((row) => row.reason.length > 0 && row.userId !== joined && row.userId !== me));

  // Invited people are no longer suggested; outsiders get nothing.
  await t.run(trips.invite, me, { tripId, userIds: [cara] });
  assert.ok(!(await t.run(trips.suggestMembers, me, { tripId })).some((row) => row.username === "cara"));
  assert.deepEqual(await t.run(trips.suggestMembers, stranger, { tripId }), []);
  assert.deepEqual(await t.run(trips.suggestMembers, null, { tripId }), []);
});
