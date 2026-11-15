import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AGREEMENT_SD_MAX, FAIRNESS_ETA, GROUP_BETA, GROUP_PSI, GROUP_VETO_SCORE, GROUP_VOTE_NU,
  agreement, fairWeights, groupScoreV2, groupScoreV4, groupWhy, nextWeights, spread, tallyVotes,
} from "../convex/lib/group.ts";
import * as recs from "../convex/lib/recs.ts";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);
const sum = (xs) => xs.reduce((s, x) => s + x, 0);

test("group constants match the ones the old groupScore uses", () => {
  assert.equal(GROUP_BETA, recs.GROUP_BETA);
  assert.equal(GROUP_VETO_SCORE, recs.GROUP_VETO_SCORE);
  assert.equal(groupScoreV4, groupScoreV2);
});

test("groupScoreV2 drops an empty group", () => {
  assert.equal(groupScoreV2([]), null);
  assert.equal(groupScoreV2([NaN]), null);
  assert.equal(groupScoreV2([], { votes: { up: 3, down: 0 } }), null);
});

test("groupScoreV2 with one member is that member's own score", () => {
  const solo = groupScoreV2([7.3]);
  assert.equal(solo.score, 7.3);
  assert.equal(solo.agreement, 1);
  assert.equal(solo.sd, 0);
  assert.equal(solo.min, 7.3);
});

test("groupScoreV2 mixes the average with the least happy member and takes off the disagreement penalty", () => {
  const g = groupScoreV2([8, 6]);
  near(g.mean, 7);
  near(g.sd, 1);
  near(g.score, 0.5 * 7 + 0.5 * 6 - GROUP_PSI * 1);
  near(g.score, recs.groupScore([8, 6]) - GROUP_PSI * 1);
  assert.equal(groupScoreV2([8, 8, 8]).score, 8);
});

test("of two places with the same average, the one everyone agrees on wins", () => {
  const calm = groupScoreV2([7, 7, 7]);
  const split = groupScoreV2([9.5, 7, 4.5]);
  near(calm.mean, split.mean);
  assert.ok(calm.score > split.score);
  assert.ok(calm.agreement > split.agreement);
});

test("veto: anyone below the veto score drops the item, and votes cannot rescue it", () => {
  assert.equal(groupScoreV2([9, 3.9]), null);
  assert.equal(groupScoreV2([9.8, 9.8, 9.8, 3.99], { votes: { up: 4, down: 0 } }), null);
  assert.notEqual(groupScoreV2([9, GROUP_VETO_SCORE]), null);
});

test("votes: everyone up adds nu, everyone down removes it, a split cancels", () => {
  const base = groupScoreV2([7, 7, 7]).score;
  near(groupScoreV2([7, 7, 7], { votes: { up: 3, down: 0 } }).score, base + GROUP_VOTE_NU);
  near(groupScoreV2([7, 7, 7], { votes: { up: 0, down: 3 } }).score, base - GROUP_VOTE_NU);
  near(groupScoreV2([7, 7, 7], { votes: { up: 1, down: 0 } }).score, base + GROUP_VOTE_NU / 3);
  near(groupScoreV2([7, 7, 7, 7], { votes: { up: 2, down: 2 } }).score, 7);
  near(groupScoreV2([7, 7], { votes: { up: 9, down: 0 } }).voteTerm, GROUP_VOTE_NU);
});

test("the group score stays within 1-10", () => {
  assert.equal(groupScoreV2([10, 10], { votes: { up: 2, down: 0 } }).score, 10);
  const low = groupScoreV2([4, 4], { votes: { up: 0, down: 2 } }).score;
  assert.ok(low >= 1 && low <= 10);
});

test("agreement is 1 when everyone matches and 0 at a spread of 3 or more", () => {
  assert.equal(agreement([]), 1);
  assert.equal(agreement([6.2]), 1);
  assert.equal(agreement([8, 8, 8]), 1);
  near(agreement([8, 6]), 1 - 1 / AGREEMENT_SD_MAX);
  assert.equal(agreement([10, 4]), 0);
  assert.equal(agreement([10, 1]), 0);
  near(spread([8, 6]), 1);
  near(groupScoreV2([8, 6]).agreement, agreement([8, 6]));
});

test("nextWeights raises whoever was least happy and keeps the sum at the group size", () => {
  const w = nextWeights([1, 1, 1], [9, 7, 5]);
  near(sum(w), 3);
  assert.ok(w[2] > w[1] && w[1] > w[0]);
  near(w[1], 3 / (Math.exp(-FAIRNESS_ETA * 0.2) + 1 + Math.exp(FAIRNESS_ETA * 0.2)));
  assert.deepEqual(nextWeights([1, 1], [8, 8]), [1, 1]);
  assert.deepEqual(nextWeights([], []), []);
  near(sum(nextWeights([1], [9, 5, 7])), 3);
});

test("fairWeights folds the stops already chosen and always sums to the group size", () => {
  assert.deepEqual(fairWeights([]), []);
  assert.deepEqual(fairWeights([[7.5]]), [1]);
  const afterOne = fairWeights([[9, 5]]);
  near(sum(afterOne), 2);
  assert.ok(afterOne[1] > 1 && afterOne[0] < 1);
  const afterTwo = fairWeights([[9, 5], [9, 5]]);
  near(sum(afterTwo), 2);
  assert.ok(afterTwo[1] > afterOne[1]);
  const evened = fairWeights([[9, 5], [5, 9]]);
  near(evened[0], 1);
  near(evened[1], 1);
  const big = fairWeights([[9, 8, 7, 6, 5, 4.2, 9.9, 6.6], [5, 9, 6, 8, 7, 9, 4, 8]]);
  near(sum(big), 8);
  assert.ok(big.every((x) => x > 0));
});

test("fairness weights give the next stop to the member who compromised", () => {
  const weights = fairWeights([[9.5, 5]]);
  const forFirst = [9, 6], forSecond = [6, 9];
  near(groupScoreV2(forFirst).score, groupScoreV2(forSecond).score);
  assert.ok(groupScoreV2(forSecond, { weights }).score > groupScoreV2(forFirst, { weights }).score);
  near(groupScoreV2(forFirst, { weights: [1, 1] }).score, groupScoreV2(forFirst).score);
  near(groupScoreV2(forFirst, { weights: [1, 1, 1] }).score, groupScoreV2(forFirst).score);
  near(groupScoreV2(forFirst, { weights: [] }).score, groupScoreV2(forFirst).score);
});

test("tallyVotes counts each member once per item and skips people outside the group", () => {
  const rows = [
    { targetId: "p1", userId: "a", vote: 1 },
    { targetId: "p1", userId: "b", vote: 1 },
    { targetId: "p1", userId: "c", vote: -1 },
    { targetId: "p1", userId: "z", vote: -1 },
    { targetId: "p2", userId: "a", vote: -1 },
    { targetId: "p2", userId: "a", vote: 1 },
    { targetId: "p3", userId: "b", vote: 0 },
  ];
  const tally = tallyVotes(rows, ["a", "b", "c"]);
  assert.deepEqual(tally.get("p1"), { up: 2, down: 1 });
  assert.deepEqual(tally.get("p2"), { up: 1, down: 0 });
  assert.deepEqual(tally.get("p3"), { up: 0, down: 0 });
  assert.equal(tally.get("nope"), undefined);
  assert.deepEqual(tallyVotes(rows).get("p1"), { up: 2, down: 2 });
  assert.equal(tallyVotes([]).size, 0);
  const voted = groupScoreV2([7, 7, 7], { votes: tally.get("p1") });
  near(voted.score, 7 + GROUP_VOTE_NU / 3);
});

test("groupWhy is never empty and names the highest and lowest member", () => {
  const members = [{ name: "Ethan", score: 9.14 }, { name: "Maya", score: 8.4 }, { name: "Bryan", score: 7.8 }];
  assert.equal(groupWhy(members), "Best overlap: Ethan 9.1, Bryan 7.8");
  assert.equal(groupWhy(members, "Loud and electronic"), "Best overlap: Ethan 9.1, Bryan 7.8 · Loud and electronic");
  assert.equal(groupWhy([{ name: "Ethan", score: 9.1 }, { name: "Bryan", score: 8 }]), "Everyone's at 8+ here");
  assert.equal(groupWhy([{ name: "Ethan", score: 6 }, { name: "Bryan", score: 6 }]), "Everyone's at 6.0 here");
  assert.equal(groupWhy([{ name: "Ethan", score: 9.1 }], "Quiet wine bar"), "Quiet wine bar");
  assert.ok(groupWhy([{ name: "Ethan", score: 9.1 }]).length > 0);
  assert.ok(groupWhy([]).length > 0);
});
