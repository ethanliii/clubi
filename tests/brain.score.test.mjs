import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ELO_TERM_CAP, EXPLORE_C, FEATURES, FOLLOW_FLOOR, NEW_ITEM_MAX_RATINGS, NEW_SLOT_MIN_CONTENT, PERFORMER_TERM_MAX,
  PERFORMER_TERM_MIN, SAVE_BUMP, TOP_MAX_PER_CATEGORY,
  contentScore, effectiveAffinity, eloTerm, exploreBonus, mapRank, mapRankV4, mmrPick, newSlotPick, performerAffinity,
  performerTerm, predict, similarValue, socialBump,
} from "../convex/lib/recs.ts";

const vec = (...on) => FEATURES.map((k) => (on.includes(k) ? 0.9 : 0.1));
const loudPop = vec("energy", "loudness", "pop", "dancing");
const quietWine = vec("price", "food");
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("eloTerm is gamma * elo, capped at one point either way", () => {
  close(eloTerm(1), 0.3);
  assert.equal(eloTerm(50), ELO_TERM_CAP);
  assert.equal(eloTerm(-50), -ELO_TERM_CAP);
  assert.equal(eloTerm(0), 0);
});

test("predict without extras is unchanged, and returns the v4 terms", () => {
  const p = predict(loudPop, quietWine, 1, [], false);
  close(p.base, contentScore(loudPop, quietWine));
  close(p.score, p.base + 0.3);
  assert.equal(p.performer, 0);
  assert.equal(p.also, 0);
  // A hot streak adds at most one point.
  close(predict(loudPop, quietWine, 99, [], false).score, p.base + ELO_TERM_CAP);
});

test("predict adds the performer and also-loved terms, clips each, and clips the total to 1-10", () => {
  const plain = predict(loudPop, quietWine, 0, [], false);
  const withP = predict(loudPop, quietWine, 0, [], false, { performer: 1.2, also: 0.3 });
  close(withP.score, plain.score + 1.5);
  assert.equal(predict(loudPop, quietWine, 0, [], false, { performer: 9 }).performer, PERFORMER_TERM_MAX);
  assert.equal(predict(loudPop, quietWine, 0, [], false, { performer: -9 }).performer, PERFORMER_TERM_MIN);
  assert.equal(predict(loudPop, quietWine, 0, [], false, { also: 5 }).also, 0.6);
  assert.equal(predict(loudPop, loudPop, 99, [], false, { performer: 1.5, also: 0.6 }).score, 10);
  assert.ok(predict(loudPop, quietWine, -99, [], false, { performer: -0.75, also: -0.6 }).score >= 1);
});

test("performerTerm: neutral is zero, a 9.4 adds about 1.3, a disliked performer drags less than a loved one lifts", () => {
  assert.equal(performerTerm(undefined), 0);
  assert.equal(performerTerm(5), 0);
  close(performerTerm(9.4), 1.32);
  assert.equal(performerTerm(10), PERFORMER_TERM_MAX);
  assert.equal(performerTerm(0), PERFORMER_TERM_MIN);
  assert.ok(Math.abs(performerTerm(0)) < performerTerm(10));
});

test("effectiveAffinity lifts a followed performer to the floor and never lowers a higher score", () => {
  assert.equal(effectiveAffinity({ score: 3, following: true }), FOLLOW_FLOOR);
  assert.equal(effectiveAffinity({ score: 9.5, following: true }), 9.5);
  assert.equal(effectiveAffinity({ score: 3, following: false }), 3);
  assert.equal(effectiveAffinity({ score: 14, following: false }), 10);
});

test("performerAffinity picks the best performer on the bill and words the reason", () => {
  assert.deepEqual(performerAffinity([]), { term: 0 });
  const rated = performerAffinity([
    { name: "Opener", score: 6, following: false, nRankings: 1 },
    { name: "Calvin Harris", score: 9.4, following: false, nRankings: 2 },
  ]);
  assert.equal(rated.best.name, "Calvin Harris");
  close(rated.term, 1.32);
  assert.equal(rated.why, "You rated Calvin Harris 9.4");
  const followed = performerAffinity([{ name: "Fred again..", score: 5, following: true, nRankings: 0 }]);
  close(followed.term, 0.9);
  assert.equal(followed.why, "You follow Fred again..");
  // Followed and rated high: the rating is the stronger reason.
  assert.equal(performerAffinity([{ name: "Peggy Gou", score: 9, following: true, nRankings: 3 }]).why, "You rated Peggy Gou 9.0");
  // Followed but rated low: the follow floor carries the term, so the reason is the follow.
  assert.equal(performerAffinity([{ name: "X", score: 4, following: true, nRankings: 1 }]).why, "You follow X");
  // A mild or negative affinity moves the score but is never the reason.
  const mild = performerAffinity([{ name: "Meh", score: 6, following: false, nRankings: 1 }]);
  close(mild.term, 0.3);
  assert.equal(mild.why, undefined);
  const disliked = performerAffinity([{ name: "No", score: 1, following: false, nRankings: 1 }]);
  assert.equal(disliked.term, PERFORMER_TERM_MIN);
  assert.equal(disliked.why, undefined);
});

test("exploreBonus starts at cE, fades like 1/sqrt(1 + n) and survives bad input", () => {
  assert.equal(exploreBonus(0), EXPLORE_C);
  close(exploreBonus(3), EXPLORE_C / 2);
  assert.ok(exploreBonus(100) < 0.06 && exploreBonus(100) > 0);
  assert.equal(exploreBonus(-5), EXPLORE_C);
});

test("socialBump counts at most two friends", () => {
  assert.equal(socialBump(0), 0);
  assert.equal(socialBump(1), SAVE_BUMP);
  assert.equal(socialBump(2), 2 * SAVE_BUMP);
  assert.equal(socialBump(9), 2 * SAVE_BUMP);
  assert.equal(socialBump(-1), 0);
});

test("mapRankV4 only adds the order-only terms on top of the v3 order", () => {
  close(mapRankV4(8, 400, 1, 0, 0), mapRank(8, 400, 1) + EXPLORE_C);
  close(mapRankV4(8, 400, 1, 3, 2), mapRank(8, 400, 1) + EXPLORE_C / 2 + 2 * SAVE_BUMP);
  // An unrated place can pass a slightly better, well-rated one in the order.
  assert.ok(mapRankV4(8.0, 400, 0, 0, 0) > mapRankV4(8.3, 400, 0, 99, 0));
});

test("mmrPick takes the best first, then prefers something different over a near-duplicate", () => {
  const pool = [
    { id: "club1", order: 9.0, vector: loudPop, category: "nightlife" },
    { id: "club2", order: 8.9, vector: loudPop, category: "nightlife" },
    { id: "wine", order: 8.0, vector: quietWine, category: "food" },
    { id: "park", order: 5.0, vector: vec("outdoors"), category: "outdoors" },
  ];
  assert.deepEqual(mmrPick(pool, 2).map((p) => p.id), ["club1", "wine"]);
  assert.deepEqual(mmrPick(pool, 10).map((p) => p.id).sort(), ["club1", "club2", "park", "wine"]);
  assert.deepEqual(mmrPick([], 5), []);
  assert.deepEqual(mmrPick(pool, 0), []);
  // mu = 1 is plain order.
  assert.deepEqual(mmrPick(pool, 3, 1).map((p) => p.id), ["club1", "club2", "wine"]);
  assert.equal(pool[0].id, "club1", "the pool is not reordered");
});

test("mmrPick allows at most three of one category while another is available, and fills up when it is not", () => {
  const bars = [1, 2, 3, 4, 5].map((i) => ({ id: `bar${i}`, order: 9 - i * 0.1, vector: vec("energy", "loudness"), category: "nightlife" }));
  const cafe = { id: "cafe", order: 2, vector: vec("energy", "loudness"), category: "food" };
  const mixed = mmrPick([...bars, cafe], 5);
  assert.equal(mixed.filter((p) => p.category === "nightlife").length, TOP_MAX_PER_CATEGORY + 1);
  assert.ok(mixed.some((p) => p.id === "cafe"));
  assert.equal(mixed.indexOf(cafe), TOP_MAX_PER_CATEGORY);
  assert.deepEqual(mmrPick(bars, 5).map((p) => p.id), ["bar1", "bar2", "bar3", "bar4", "bar5"]);
});

test("newSlotPick gives the last top slot to the best new item only when the top has none", () => {
  const rated = (order) => ({ order, nRatings: 10, content: 8 });
  const top = [rated(9), rated(8.8), rated(8.6), rated(8.4), rated(8.2)];
  const fresh = { order: 7.5, nRatings: 0, content: 7.6 };
  const fresher = { order: 7.9, nRatings: NEW_ITEM_MAX_RATINGS - 1, content: NEW_SLOT_MIN_CONTENT };
  const weak = { order: 8.1, nRatings: 0, content: 6.9 };
  const known = { order: 8.15, nRatings: NEW_ITEM_MAX_RATINGS, content: 9 };
  assert.equal(newSlotPick(top, [weak, known, fresh, fresher], 5), fresher);
  assert.equal(newSlotPick(top, [weak, known], 5), null);
  assert.equal(newSlotPick(top, [], 5), null);
  // The top already holds a new item: leave the list alone.
  assert.equal(newSlotPick([...top.slice(0, 4), { order: 8, nRatings: 1, content: 8 }], [fresh], 5), null);
  // A short list shows everything anyway.
  assert.equal(newSlotPick(top.slice(0, 3), [fresh], 5), null);
});

test("similarValue mixes closeness and my score, and never rewards being opposite", () => {
  close(similarValue(1, 5), 0.6 * 10 + 0.4 * 5);
  close(similarValue(-1, 5), 0.4 * 5);
  assert.ok(similarValue(0.9, 6) > similarValue(0.5, 8));
  assert.ok(similarValue(0.8, 9) > similarValue(0.8, 6));
});
