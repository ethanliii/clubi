import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AFFINITY_NEUTRAL, ELO_TERM_CAP, EXPLORE_C, FEATURES, FOLLOW_FLOOR, LOVED_STEP, LOVED_STEP_NO_QUIZ, MEASURED_SUFFIX,
  NEUTRAL_TASTE, NEW_ITEM_MAX_RATINGS, NEW_SLOT_MIN_CONTENT, PERFORMER_TERM_MAX, PERFORMER_TERM_MIN, SAVE_BUMP,
  TOP_MAX_PER_CATEGORY, WHY_RATED_MIN_RANKINGS,
  contentScore, effectiveAffinity, eloTerm, exploreBonus, friendMaySee, isNeutralTaste, learnedAffinity, lovedStepFor, mapRank,
  mapRankV4, mmrPick, newSlotPick, nudgeTaste, performerAffinity, performerTerm, predict, quizToVector, shareOf, shownScore,
  similarValue, socialBump, takeAcross, whyFromFeatures,
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

test("learnedAffinity shrinks a rated affinity toward neutral by the rankings behind it", () => {
  // One ranking counts half: a lone 1.65 ("didn't like", mostly the venue's fault) is 3.3, not 1.65.
  close(learnedAffinity(1.65, 1), 3.325);
  close(learnedAffinity(8.35, 1), 6.675);
  close(learnedAffinity(9.4, 2), AFFINITY_NEUTRAL + (4.4 * 2) / 3);
  // No rankings: no evidence. Many: nearly the score itself. No count (an older caller): taken as it is.
  assert.equal(learnedAffinity(9, 0), AFFINITY_NEUTRAL);
  assert.ok(learnedAffinity(9, 50) > 8.9 && learnedAffinity(9, 50) < 9);
  assert.equal(learnedAffinity(9), 9);
  assert.equal(learnedAffinity(AFFINITY_NEUTRAL, 3), AFFINITY_NEUTRAL);
  // It moves monotonically with the count and never past the score.
  for (const score of [0, 2.5, 7, 10]) {
    for (let n = 0; n < 6; n++) {
      const a = learnedAffinity(score, n), b = learnedAffinity(score, n + 1);
      assert.ok(Math.abs(b - AFFINITY_NEUTRAL) >= Math.abs(a - AFFINITY_NEUTRAL));
      assert.ok(Math.abs(b - AFFINITY_NEUTRAL) <= Math.abs(score - AFFINITY_NEUTRAL));
    }
  }
});

test("effectiveAffinity uses the shrunk affinity, and a follow still lifts it to the floor", () => {
  close(effectiveAffinity({ score: 1.65, following: false, nRankings: 1 }), 3.325);
  assert.equal(effectiveAffinity({ score: 5, following: true, nRankings: 0 }), FOLLOW_FLOOR);
  assert.equal(effectiveAffinity({ score: 2, following: true, nRankings: 1 }), FOLLOW_FLOOR);
  // Followed and rated high many times: the rating wins over the floor.
  assert.ok(effectiveAffinity({ score: 9.8, following: true, nRankings: 9 }) > 9);
});

test("performerAffinity picks the best performer on the bill and words the reason", () => {
  assert.deepEqual(performerAffinity([]), { term: 0 });
  const rated = performerAffinity([
    { name: "Opener", score: 6, following: false, nRankings: 1 },
    { name: "Calvin Harris", score: 9.4, following: false, nRankings: 2 },
  ]);
  assert.equal(rated.best.name, "Calvin Harris");
  // 9.4 from two rankings counts as 7.93: 1.5 * 2.93 / 5.
  close(rated.term, 0.88);
  close(rated.affinity, 5 + (4.4 * 2) / 3);
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
  close(mild.term, 0.15);
  assert.equal(mild.why, undefined);
  const disliked = performerAffinity([{ name: "No", score: 0.5, following: false, nRankings: 9 }]);
  assert.equal(disliked.term, PERFORMER_TERM_MIN);
  assert.equal(disliked.why, undefined);
});

test("performerAffinity: one rated night moves the score a little and is never the stated reason", () => {
  // The only "didn't like" in a list scores 1.65: every other event by that headliner loses 0.5, not 0.75.
  const oneBad = performerAffinity([{ name: "Headliner", score: 1.65, following: false, nRankings: 1 }]);
  close(oneBad.term, (1.5 * (3.325 - 5)) / 5);
  assert.ok(oneBad.term > PERFORMER_TERM_MIN);
  // One "loved" (8.35) adds 0.5, where the unshrunk score added a full point, and gives no "You rated" line.
  const oneGood = performerAffinity([{ name: "Headliner", score: 8.35, following: false, nRankings: 1 }]);
  close(oneGood.term, (1.5 * 1.675) / 5);
  assert.equal(oneGood.why, undefined);
  // Even a perfect single night: the term is big enough to be a reason, but one night is not "You rated X".
  const perfect = performerAffinity([{ name: "Headliner", score: 10, following: false, nRankings: 1 }]);
  close(perfect.term, 0.75);
  assert.equal(perfect.why, undefined);
  // The second ranking is what earns the line.
  assert.equal(WHY_RATED_MIN_RANKINGS, 2);
  assert.equal(performerAffinity([{ name: "Headliner", score: 10, following: false, nRankings: 2 }]).why, "You rated Headliner 10.0");
  // Followed and rated high once: the follow is the reason, not the single rating.
  assert.equal(performerAffinity([{ name: "Headliner", score: 9.5, following: true, nRankings: 1 }]).why, "You follow Headliner");
});

test("shownScore is the score a ranking really has, one decimal, from 0", () => {
  // The second "didn't like" in a list scores 0.8: text says 0.8, not the 1.0 the math clips to.
  assert.equal(shownScore(0.8), 0.8);
  assert.equal(shownScore(0.84), 0.8);
  assert.notEqual(shownScore(0.8), shownScore(0.2));
  assert.equal(shownScore(9.16), 9.2);
  assert.equal(shownScore(-3), 0);
  assert.equal(shownScore(14), 10);
});

test("friendMaySee: a ranking is as visible to friends as its post", () => {
  // Albert ranks a bar 9.1 as "Only me": Bryan's cards must not name him.
  assert.equal(friendMaySee("private"), false);
  assert.equal(friendMaySee("friends"), true);
  assert.equal(friendMaySee("public"), true);
  // The post was deleted and the ranking stayed: People's rule shows it to friends.
  assert.equal(friendMaySee(undefined), true);
});

test("predict says which rater weighed most, so the caller can read that row's real score", () => {
  const raters = [
    { taste: quietWine, score: 9, local: false, friend: false, name: "Stranger" },
    { taste: loudPop, score: 1, local: true, friend: true, name: "Albert" },
    { taste: loudPop, score: 8, local: false, friend: false, name: "Maya" },
  ];
  const p = predict(loudPop, loudPop, 0, raters, true);
  assert.equal(p.topRater.index, 1);
  assert.equal(raters[p.topRater.index].name, p.topRater.name);
  assert.equal(predict(loudPop, loudPop, 0, [], true).topRater, null);
});

test("whyFromFeatures marks a measured top feature and is never empty", () => {
  assert.equal(whyFromFeatures(["loudness", "crowdAge"]), "Loud + young crowd");
  assert.equal(whyFromFeatures(["loudness", "crowdAge"], true), `Loud + young crowd${MEASURED_SUFFIX}`);
  assert.equal(whyFromFeatures(["loudness", "crowdAge"], true), "Loud + young crowd, say people who went");
  // Nothing to say about features: the fallback line is not dressed up as measured.
  assert.equal(whyFromFeatures([], true), "Worth a look nearby");
});

test("lovedStepFor: someone who skipped the quiz learns faster from a loved place", () => {
  assert.equal(lovedStepFor(NEUTRAL_TASTE), LOVED_STEP_NO_QUIZ);
  assert.equal(lovedStepFor(undefined), LOVED_STEP_NO_QUIZ);
  const quiz = quizToVector([[0], [2], [1], [2], [2], [0]]);
  assert.equal(lovedStepFor(quiz), LOVED_STEP);
  assert.ok(LOVED_STEP_NO_QUIZ > LOVED_STEP);
  assert.equal(isNeutralTaste([...NEUTRAL_TASTE]), true);
  assert.equal(isNeutralTaste(NEUTRAL_TASTE.map((x, k) => (k === 3 ? 0.51 : x))), false);
  // The step is what nudgeTaste moves by; "didn't like" and "fine" do not depend on it.
  const energy = FEATURES.indexOf("energy");
  close(nudgeTaste(NEUTRAL_TASTE, loudPop, "loved")[energy], 0.5 + LOVED_STEP * 0.4);
  close(nudgeTaste(NEUTRAL_TASTE, loudPop, "loved", lovedStepFor(NEUTRAL_TASTE))[energy], 0.5 + LOVED_STEP_NO_QUIZ * 0.4);
  assert.deepEqual(nudgeTaste(NEUTRAL_TASTE, loudPop, "didnt", 0.9), nudgeTaste(NEUTRAL_TASTE, loudPop, "didnt"));
  assert.deepEqual(nudgeTaste(NEUTRAL_TASTE, loudPop, "fine", 0.9), NEUTRAL_TASTE);
});

test("takeAcross gives every list a turn before any list a second one", () => {
  // 250 events in the first five days and one on day 9: the late one is among the first few taken.
  const early = Array.from({ length: 250 }, (_, k) => `early${k}`);
  const picked = takeAcross([early, [], ["day9"]], 200);
  assert.equal(picked.length, 200);
  assert.equal(picked[1], "day9");
  assert.deepEqual(takeAcross([["a1", "a2", "a3"], ["b1"], ["c1", "c2"]], 10), ["a1", "b1", "c1", "a2", "c2", "a3"]);
  assert.deepEqual(takeAcross([["a1", "a2", "a3"], ["b1"], ["c1", "c2"]], 4), ["a1", "b1", "c1", "a2"]);
  assert.deepEqual(takeAcross([], 5), []);
  assert.deepEqual(takeAcross([["a"]], 0), []);
  assert.deepEqual(takeAcross([["a"]], -3), []);
});

test("shareOf splits a read budget evenly and stays inside its bounds", () => {
  // 50 friends, 6 categories, 1,200 rows: 4 each. One friend: capped at the maximum, not 200.
  assert.equal(shareOf(1200, 50 * 6, 4, 50), 4);
  assert.equal(shareOf(1200, 6, 4, 50), 50);
  assert.equal(shareOf(1200, 10 * 6, 4, 50), 20);
  assert.equal(shareOf(1200, 500 * 6, 4, 50), 4);
  assert.equal(shareOf(1200, 0, 4, 50), 50);
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
