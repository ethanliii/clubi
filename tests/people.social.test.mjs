import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AA_FULL, BIO_MAX, COMMENT_MAX, FEED_TAU_MS, FRIEND_W, NOTIF_PREF_FOR_TYPE, TRIP_W,
  adamicAdar, agreePct, bucketScore, canSeePost, centroid, cleanBio, cleanBirthday, cleanCaption, cleanComment,
  cleanDisplayName, coRankAgreement, compareSummary, feedScore, friendStatus, friendSuggestionScore, fullNotifPrefs,
  parseDay, rankLabel, renumber, shortlistOrder, shouldNotify, suggestionReason, tallyVotes, tasteMatchPct, tripFit,
  unseenComparisons,
} from "../convex/lib/social.ts";

// ── Ranking ─────────────────────────────────────────────────────────────────────────────────────────

test("bucketScore stays inside the bucket's range and falls with position", () => {
  assert.equal(bucketScore("loved", 1, 1), 8.4);
  assert.equal(bucketScore("loved", 1, 2), 9.2);
  assert.equal(bucketScore("loved", 2, 2), 7.5);
  for (const [bucket, low, high] of [["loved", 6.7, 10], ["fine", 3.4, 6.7], ["didnt", 0, 3.3]]) {
    for (const count of [1, 2, 7, 40]) {
      let previous = Infinity;
      for (let position = 1; position <= count; position++) {
        const score = bucketScore(bucket, position, count);
        assert.ok(score >= low && score <= high, `${bucket} ${position}/${count} = ${score}`);
        assert.ok(score <= previous);
        previous = score;
      }
    }
  }
});

test("renumber closes gaps, keeps order and counts overall position across buckets", () => {
  const placed = renumber([
    { id: "c", bucket: "fine", position: 7 },
    { id: "a", bucket: "loved", position: 2 },
    { id: "b", bucket: "loved", position: 5 },
    { id: "d", bucket: "didnt", position: 1 },
  ]);
  assert.deepEqual(placed.map((row) => [row.id, row.position, row.overall]), [["a", 1, 1], ["b", 2, 2], ["c", 1, 3], ["d", 1, 4]]);
  assert.deepEqual(placed.map((row) => row.score), [9.2, 7.5, 5.1, 1.7]);
  assert.deepEqual(renumber([]), []);
});

test("renumber inserts at a 1-based position, clamps it, and moves an item that is already there", () => {
  const rows = [{ id: "a", bucket: "loved", position: 1 }, { id: "b", bucket: "loved", position: 2 }];
  const ids = (position, bucket = "loved") => renumber(rows, { id: "x", bucket, position }).map((row) => row.id);
  assert.deepEqual(ids(1), ["x", "a", "b"]);
  assert.deepEqual(ids(2), ["a", "x", "b"]);
  assert.deepEqual(ids(3), ["a", "b", "x"]);
  assert.deepEqual(ids(99), ["a", "b", "x"]);
  assert.deepEqual(ids(0), ["x", "a", "b"]);
  assert.deepEqual(ids(-4), ["x", "a", "b"]);
  assert.deepEqual(ids(1.6), ["a", "x", "b"]);
  assert.deepEqual(ids(NaN), ["a", "b", "x"]);
  assert.deepEqual(ids(1, "didnt"), ["a", "b", "x"]);
  // Re-ranking "a" into another bucket takes it out of the old one: no duplicate, no gap.
  const moved = renumber(rows, { id: "a", bucket: "fine", position: 1 });
  assert.deepEqual(moved.map((row) => [row.id, row.bucket, row.position, row.overall]), [["b", "loved", 1, 1], ["a", "fine", 1, 2]]);
  assert.equal(moved[0].score, bucketScore("loved", 1, 1));
});

test("renumber keeps the stored order for equal positions", () => {
  const placed = renumber([{ id: "first", bucket: "fine", position: 1 }, { id: "second", bucket: "fine", position: 1 }]);
  assert.deepEqual(placed.map((row) => row.id), ["first", "second"]);
});

test("unseenComparisons drops pairs already learned and repeats, keeps a flipped outcome", () => {
  const incoming = [
    { winnerId: "x", loserId: "a" },
    { winnerId: "b", loserId: "x" },
    { winnerId: "x", loserId: "a" },
    { winnerId: "x", loserId: "c" },
  ];
  assert.deepEqual(unseenComparisons(incoming, ["x>a"]), [{ winnerId: "b", loserId: "x" }, { winnerId: "x", loserId: "c" }]);
  assert.deepEqual(unseenComparisons(incoming, []).length, 3);
  assert.deepEqual(unseenComparisons([{ winnerId: "a", loserId: "x" }], ["x>a"]), [{ winnerId: "a", loserId: "x" }]);
  assert.deepEqual(unseenComparisons([], ["x>a"]), []);
});

test("rankLabel reads like the feed", () => {
  assert.equal(rankLabel("their", 2, "nightlife", 8.9), "#2 of their bars · 8.9");
  assert.equal(rankLabel("your", 1, "food", 9), "#1 of your food spots · 9.0");
});

// ── Notifications ───────────────────────────────────────────────────────────────────────────────────

test("every notification type maps to a pref, and a missing pref means on", () => {
  const types = ["friend_posted", "friend_ranked_same", "event_tonight", "friend_request", "friend_accepted",
    "artist_event", "trip_invite", "trip_update", "post_reaction", "post_comment"];
  assert.deepEqual(Object.keys(NOTIF_PREF_FOR_TYPE).sort(), [...types].sort());
  for (const type of types) {
    assert.equal(shouldNotify({ receiverId: "u", actorId: "v", type }), true);
    assert.equal(shouldNotify({ receiverId: "u", actorId: "v", type, prefs: {} }), true);
    assert.equal(shouldNotify({ receiverId: "u", actorId: "v", type, prefs: { [NOTIF_PREF_FOR_TYPE[type]]: false } }), false);
    assert.equal(shouldNotify({ receiverId: "u", actorId: "v", type, prefs: { [NOTIF_PREF_FOR_TYPE[type]]: true } }), true);
  }
});

test("shouldNotify groups types and never notifies about your own action", () => {
  const prefs = { friendPosts: false, reactions: false };
  assert.equal(shouldNotify({ receiverId: "u", actorId: "v", type: "friend_ranked_same", prefs }), false);
  assert.equal(shouldNotify({ receiverId: "u", actorId: "v", type: "post_comment", prefs }), false);
  assert.equal(shouldNotify({ receiverId: "u", actorId: "v", type: "friend_request", prefs }), true);
  assert.equal(shouldNotify({ receiverId: "u", actorId: "u", type: "friend_request" }), false);
  assert.equal(shouldNotify({ receiverId: "u", type: "event_tonight" }), true);
  assert.equal(shouldNotify({ receiverId: "u", type: "event_tonight", prefs: { eventsTonight: false } }), false);
});

test("fullNotifPrefs fills every switch", () => {
  assert.deepEqual(fullNotifPrefs(), {
    friendPosts: true, friendRequests: true, eventsTonight: true, artistAlerts: true, tripUpdates: true, reactions: true,
  });
  assert.equal(fullNotifPrefs({ artistAlerts: false }).artistAlerts, false);
  assert.equal(fullNotifPrefs({ artistAlerts: false }).reactions, true);
});

// ── Visibility ──────────────────────────────────────────────────────────────────────────────────────

test("canSeePost: author always, public when signed in, friends-only by default, private nobody else", () => {
  const see = (viewerId, visibility, isFriend) => canSeePost({ viewerId, authorId: "author", visibility, isFriend });
  for (const visibility of ["friends", "public", "private", undefined]) {
    assert.equal(see("author", visibility, false), true);
    assert.equal(see(null, visibility, true), false);
  }
  assert.equal(see("stranger", "public", false), true);
  assert.equal(see("stranger", "friends", false), false);
  assert.equal(see("stranger", undefined, false), false);
  assert.equal(see("friend", "friends", true), true);
  assert.equal(see("friend", undefined, true), true);
  assert.equal(see("friend", "private", true), false);
});

// ── Friends ─────────────────────────────────────────────────────────────────────────────────────────

test("friendStatus reads the row from my side", () => {
  const row = (status) => ({ userA: "asker", userB: "asked", status });
  assert.equal(friendStatus(null, "asker"), "none");
  assert.equal(friendStatus(undefined, "asker"), "none");
  assert.equal(friendStatus(row("pending"), "asker"), "outgoing");
  assert.equal(friendStatus(row("pending"), "asked"), "incoming");
  assert.equal(friendStatus(row("accepted"), "asked"), "friends");
  assert.equal(friendStatus(row("declined"), "asker"), "none");
});

test("adamicAdar counts a mutual friend who knows everyone for less", () => {
  assert.equal(adamicAdar([]), 0);
  assert.ok(Math.abs(adamicAdar([2]) - 1 / Math.log(3)) < 1e-12);
  assert.ok(adamicAdar([2]) > adamicAdar([200]));
  assert.ok(adamicAdar([5, 5]) > adamicAdar([5]));
  assert.ok(Number.isFinite(adamicAdar([0])));
});

test("tasteMatchPct maps similarity [-1, 1] to 0–100", () => {
  assert.equal(tasteMatchPct(1), 100);
  assert.equal(tasteMatchPct(-1), 0);
  assert.equal(tasteMatchPct(0), 50);
  assert.equal(tasteMatchPct(0.64), 82);
  assert.equal(tasteMatchPct(7), 100);
  assert.equal(tasteMatchPct(NaN), 50);
});

test("coRankAgreement is 0 with nothing shared, shrinks small samples and falls with the score gap", () => {
  assert.equal(coRankAgreement([]), 0);
  const same = (n) => Array.from({ length: n }, () => ({ mine: 8, theirs: 8 }));
  assert.ok(Math.abs(coRankAgreement(same(1)) - 1 / 3) < 1e-12);
  assert.ok(Math.abs(coRankAgreement(same(8)) - 0.8) < 1e-12);
  assert.ok(coRankAgreement(same(8)) > coRankAgreement(same(2)));
  assert.ok(coRankAgreement([{ mine: 9, theirs: 2 }, { mine: 8, theirs: 1 }]) < coRankAgreement(same(2)));
  assert.equal(coRankAgreement([{ mine: 10, theirs: 0 }]), 0);
});

test("friendSuggestionScore is the weighted sum, each part capped", () => {
  assert.equal(friendSuggestionScore({ aa: 0, taste: 0, coRank: 0, sameCity: false }), 0);
  assert.equal(friendSuggestionScore({ aa: 99, taste: 1, coRank: 1, sameCity: true }), 1);
  assert.equal(friendSuggestionScore({ aa: AA_FULL, taste: 0, coRank: 0, sameCity: false }), FRIEND_W.mutual);
  assert.equal(friendSuggestionScore({ aa: 0, taste: -0.8, coRank: 0, sameCity: true }), FRIEND_W.city);
  assert.equal(friendSuggestionScore({ aa: AA_FULL / 2, taste: 0.5, coRank: 0.5, sameCity: false }), 0.45);
  assert.ok(Math.abs(FRIEND_W.mutual + FRIEND_W.taste + FRIEND_W.coRank + FRIEND_W.city - 1) < 1e-12);
});

test("suggestionReason picks the first that applies and is never empty", () => {
  const base = { mutualCount: 0, sharedPlaces: 0, sameCity: false, tasteMatchPct: 40 };
  assert.equal(suggestionReason({ ...base, mutualCount: 3 }), "3 mutual friends");
  assert.equal(suggestionReason({ ...base, mutualCount: 3, tasteMatchPct: 82 }), "3 mutual friends · 82% taste match");
  assert.equal(suggestionReason({ ...base, mutualCount: 1, mutualName: "Bryan" }), "Friends with Bryan");
  assert.equal(suggestionReason({ ...base, mutualCount: 1 }), "1 mutual friend");
  assert.equal(suggestionReason({ ...base, sharedPlaces: 3, sharedPlaceName: "Zeitgeist" }), "You both ranked Zeitgeist and 2 more");
  assert.equal(suggestionReason({ ...base, sharedPlaces: 3 }), "You both ranked 3 of the same places");
  assert.equal(suggestionReason({ ...base, sharedPlaces: 1, sameCity: true, city: " San Francisco " }), "Also in San Francisco");
  assert.equal(suggestionReason({ ...base, sameCity: true, tasteMatchPct: 70 }), "Lives in your city · 70% taste match");
  assert.equal(suggestionReason(base), "40% taste match");
  assert.equal(suggestionReason({ ...base, tasteMatchPct: 91 }), "91% taste match");
});

// ── Trips ───────────────────────────────────────────────────────────────────────────────────────────

test("centroid is the mean vector", () => {
  assert.deepEqual(centroid([[0, 1], [1, 0], [1, 1]]).map((x) => Math.round(x * 100)), [67, 67]);
  assert.deepEqual(centroid([]), []);
});

test("tripFit weighs taste, locals, shared places and friends on the trip", () => {
  assert.ok(Math.abs(TRIP_W.taste + TRIP_W.local + TRIP_W.shared + TRIP_W.friends - 1) < 1e-12);
  assert.equal(tripFit({ tasteSim: 1, isLocal: true, sharedPlaces: 9, friendShare: 1 }).fitPct, 100);
  assert.equal(tripFit({ tasteSim: -1, isLocal: false, sharedPlaces: 0, friendShare: 0 }).fitPct, 0);
  assert.equal(tripFit({ tasteSim: 0, isLocal: true, sharedPlaces: 0, friendShare: 0 }).fitPct, 25);
  assert.equal(tripFit({ tasteSim: 0.5, isLocal: false, sharedPlaces: 5, friendShare: 0.5 }).fitPct, 48);
  assert.equal(tripFit({ tasteSim: NaN, isLocal: false, sharedPlaces: -3, friendShare: 9 }).fitPct, 10);
  const local = tripFit({ tasteSim: 0.2, isLocal: true, sharedPlaces: 0, friendShare: 0 });
  const stranger = tripFit({ tasteSim: 0.2, isLocal: false, sharedPlaces: 0, friendShare: 0 });
  assert.ok(local.fitPct > stranger.fitPct);
});

test("tripFit reasons, first that applies", () => {
  const base = { tasteSim: 0, isLocal: false, sharedPlaces: 0, friendShare: 0 };
  assert.equal(tripFit({ ...base, isLocal: true, city: "Tokyo" }).reason, "Lives in Tokyo, knows the city");
  assert.equal(tripFit({ ...base, isLocal: true, city: "New York", tasteSim: 0.68 * 2 - 1 + 0.4 }).reason, "Lives in New York, knows the city · 88% match with the group");
  assert.equal(tripFit({ ...base, isLocal: true }).reason, "Lives there, knows the city");
  assert.equal(tripFit({ ...base, tasteSim: 0.72 }).reason, "86% taste match with the group");
  assert.equal(tripFit({ ...base, sharedPlaces: 4, sharedWithName: "Bryan" }).reason, "Ranked 4 of the same places as Bryan");
  assert.equal(tripFit({ ...base, sharedPlaces: 2 }).reason, "Ranked 2 of the same places as the group");
  assert.equal(tripFit({ ...base, friendShare: 0.75, friendsOnTrip: 3 }).reason, "Friends with 3 people on this trip");
  assert.equal(tripFit({ ...base, friendShare: 0.5, friendsOnTrip: 1 }).reason, "Friends with 1 person on this trip");
  assert.equal(tripFit(base).reason, "Your friend");
});

test("tallyVotes and shortlistOrder: only items with a +1, most net votes first", () => {
  const vote = (targetId, userId, value, createdAt) => ({ targetKind: "place", targetId, userId, vote: value, createdAt });
  const tallies = tallyVotes([
    vote("bar", "ann", 1, 10), vote("bar", "bob", 1, 5), vote("bar", "cat", -1, 7),
    vote("cafe", "ann", 1, 1),
    vote("club", "bob", -1, 2),
    vote("park", "ann", 1, 3), vote("park", "bob", 1, 4),
    vote("junk", "ann", 0, 1), vote("junk", "bob", 5, 1),
  ], "ann");
  const byId = Object.fromEntries(tallies.map((tally) => [tally.targetId, tally]));
  assert.deepEqual([byId.bar.votesUp, byId.bar.votesDown, byId.bar.myVote, byId.bar.addedBy], [2, 1, 1, "bob"]);
  assert.equal(byId.club.myVote, undefined);
  assert.equal(byId.junk, undefined);
  assert.deepEqual(shortlistOrder(tallies).map((tally) => tally.targetId), ["park", "bar", "cafe"]);
  assert.equal(tallyVotes([vote("club", "bob", -1, 2)], "bob")[0].myVote, -1);
  assert.deepEqual(shortlistOrder(tallyVotes([])), []);
});

test("parseDay accepts real dates only", () => {
  assert.equal(parseDay("2026-03-14"), Date.UTC(2026, 2, 14));
  for (const bad of ["2026-02-30", "2026-13-01", "26-03-14", "2026-3-14", "", "tomorrow", "2026-03-14T00:00"]) {
    assert.equal(parseDay(bad), undefined, bad);
  }
});

// ── Feed ────────────────────────────────────────────────────────────────────────────────────────────

test("feedScore: recency leads, bonuses can only nudge", () => {
  const plain = { closeness: 0, relevant: false, hasPhoto: false };
  assert.equal(feedScore({ ageMs: 0, ...plain }), 1);
  assert.ok(Math.abs(feedScore({ ageMs: FEED_TAU_MS, ...plain }) - Math.exp(-1)) < 1e-12);
  assert.equal(feedScore({ ageMs: -5000, ...plain }), 1);
  assert.ok(Math.abs(feedScore({ ageMs: 0, closeness: 5, relevant: true, hasPhoto: true }) - 1.6) < 1e-12);
  // A day-old post with every bonus still loses to a fresh plain one.
  assert.ok(feedScore({ ageMs: 24 * 3_600_000, closeness: 1, relevant: true, hasPhoto: true }) < feedScore({ ageMs: 0, ...plain }));
  assert.ok(feedScore({ ageMs: 1000, ...plain, hasPhoto: true }) > feedScore({ ageMs: 1000, ...plain }));
});

// ── Text ────────────────────────────────────────────────────────────────────────────────────────────

test("text people type is trimmed and limited", () => {
  assert.equal(cleanDisplayName("  Ethan   Li "), "Ethan Li");
  assert.throws(() => cleanDisplayName("   "), /1 to 40/);
  assert.throws(() => cleanDisplayName("x".repeat(41)), /1 to 40/);
  assert.equal(cleanDisplayName("x".repeat(40)).length, 40);
  assert.equal(cleanBio("  hi "), "hi");
  assert.equal(cleanBio(""), "");
  assert.equal(cleanBio("x".repeat(BIO_MAX)).length, BIO_MAX);
  assert.throws(() => cleanBio("x".repeat(BIO_MAX + 1)), /160/);
  assert.equal(cleanBirthday("2001-10-23"), "2001-10-23");
  assert.throws(() => cleanBirthday("10/23/2001"), /YYYY-MM-DD/);
  assert.throws(() => cleanBirthday("2001-02-31"), /real date/);
  assert.equal(cleanComment("  nice  "), "nice");
  assert.throws(() => cleanComment(" \n "), /Write something/);
  assert.throws(() => cleanComment("x".repeat(COMMENT_MAX + 1)), /500/);
  assert.equal(cleanComment("x".repeat(COMMENT_MAX)).length, COMMENT_MAX);
  assert.equal(cleanCaption(undefined), undefined);
  assert.equal(cleanCaption("   "), undefined);
  assert.equal(cleanCaption(" best night "), "best night");
  assert.throws(() => cleanCaption("x".repeat(501)), /500/);
});

// ── Compare ─────────────────────────────────────────────────────────────────────────────────────────

test("agreePct is the share of shared places in the same bucket", () => {
  assert.equal(agreePct([]), undefined);
  assert.equal(agreePct([{ mine: "loved", theirs: "loved" }]), 100);
  assert.equal(agreePct([{ mine: "loved", theirs: "loved" }, { mine: "loved", theirs: "fine" }, { mine: "didnt", theirs: "loved" }]), 33);
});

test("compareSummary names where two people agree and split, and is never empty", () => {
  const row = (category, myScore, theirScore) => ({ category, myScore, theirScore });
  assert.equal(compareSummary([row("nightlife", 9, 8.5), row("food", 9, 3)], 70), "You two agree on bars, split on food spots");
  assert.equal(compareSummary([row("nightlife", 9, 8.5), row("live", 7, 7)], 70), "You two agree on bars and shows");
  assert.equal(compareSummary([row("food", 9, 3)], 70), "You two split on food spots");
  assert.equal(compareSummary([], 82), "82% taste match · no places in common yet");
  assert.match(compareSummary([row("food", 8, 6)], 64), /^64% taste match · close but not identical on the place you both ranked$/);
  assert.match(compareSummary([row("food", 8, 6), row("food", 8, 5.9)], 64), /2 places/);
});
