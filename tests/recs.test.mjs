import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FEATURES, NEUTRAL_TASTE, contentScore, matchPct, nudgeTaste, predict, quizToVector, updateElo, updateTaste,
} from "../convex/lib/recs.ts";

const loudPop = FEATURES.map((k) => (["energy", "loudness", "pop", "dancing"].includes(k) ? 0.9 : 0.1));
const quietWine = FEATURES.map((k) => (["price", "food"].includes(k) ? 0.8 : 0.1));

test("updateTaste moves taste toward the winner and stays in [0, 1]", () => {
  let taste = [...NEUTRAL_TASTE];
  for (let i = 0; i < 50; i++) taste = updateTaste(taste, NEUTRAL_TASTE, loudPop, quietWine);
  assert.ok(taste[FEATURES.indexOf("loudness")] > 0.5);
  assert.ok(taste[FEATURES.indexOf("price")] < 0.5);
  assert.ok(taste.every((x) => x >= 0 && x <= 1));
  assert.ok(contentScore(taste, loudPop) > contentScore(NEUTRAL_TASTE, loudPop));
});

test("updateElo rewards the winner and shrinks with more comparisons", () => {
  const [w, l] = updateElo(0, 0, 0, 0);
  assert.equal(w, 0.25);
  assert.equal(l, -0.25);
  const [settled] = updateElo(0, 0, 99, 99);
  assert.ok(settled < w && settled > 0);
});

test("predict is the content score alone, then shifts toward similar locals", () => {
  const alone = predict(loudPop, quietWine, 0, [], false);
  assert.equal(alone.lam, 0);
  assert.equal(alone.score, contentScore(loudPop, quietWine));
  const local = { taste: loudPop, score: 9.8, local: true, friend: false, name: "Local" };
  const crowd = predict(loudPop, quietWine, 0, [local, local], false);
  assert.ok(crowd.lam > 0.5);
  assert.ok(crowd.score > alone.score && crowd.score <= 10);
  const visitor = { ...local, local: false };
  assert.ok(predict(loudPop, quietWine, 0, [visitor], false).lam < predict(loudPop, quietWine, 0, [local], false).lam);
});

test("quizToVector returns 13 values in [0, 1] and matchPct is clamped", () => {
  const taste = quizToVector([[3, 0], [2], [0], [3], [3], [0, 3]]);
  assert.equal(taste.length, FEATURES.length);
  assert.ok(taste.every((x) => x >= 0 && x <= 1));
  assert.ok(taste[FEATURES.indexOf("electronic")] > 0.9);
  assert.deepEqual(quizToVector([]), FEATURES.map(() => 0.3));
  assert.ok(contentScore(taste, loudPop) - contentScore(taste, quietWine) > 2);
  assert.equal(matchPct(0.8), 0);
  assert.equal(matchPct(10), 100);
});

test("nudgeTaste pulls toward loved items, pushes away from disliked ones and ignores fine", () => {
  const loud = FEATURES.indexOf("loudness");
  assert.ok(nudgeTaste(NEUTRAL_TASTE, loudPop, "loved")[loud] > 0.5);
  assert.ok(nudgeTaste(NEUTRAL_TASTE, loudPop, "didnt")[loud] < 0.5);
  assert.deepEqual(nudgeTaste(NEUTRAL_TASTE, loudPop, "fine"), NEUTRAL_TASTE);
});
