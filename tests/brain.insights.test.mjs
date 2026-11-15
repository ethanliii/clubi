import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALSO_MIN_SUPPORT, BESTFOR_SHARE, DASHBOARD_QUESTION_WEIGHT, INSIGHT_FEATURES, INSIGHT_N0, LOCAL_ANSWER_WEIGHT, MIN_SHOW,
  QUESTION_BANK, QUESTIONS_PER_VISIT, RESPONDENTS_KEY, WEEK_MS,
  addAnswers, answerChips, answerEntropy, audienceProfile, averageGroupSize, bestFor, blendVector, bucketCounts,
  chooseQuestions, cleanAnswers, coLoved, confidenceOf, distributions, feedsFeatures, hasObservations, highlights,
  histogram, isMeasured, isUniversal, lift, measuredVector, observedVector, pickQuestions, questionValue, questionsForCategory,
  removeAnswers, respondentsOf, summarize, weekStartOf, weeklyTrend, winRecord,
} from "../convex/lib/insights.ts";
import { FEATURES } from "../convex/lib/recs.ts";

const CATEGORIES = ["nightlife", "food", "culture", "outdoors", "live", "popup"];
const F = (name) => FEATURES.indexOf(name);
const ans = (questionId, ...optionIds) => ({ questionId, optionIds });
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);
/** n people giving the same answers. */
const times = (n, answers, counts = {}) => {
  for (let i = 0; i < n; i++) counts = addAnswers(counts, answers);
  return counts;
};
const bank = (id) => QUESTION_BANK.find((q) => q.id === id);

// ───────────── the bank ─────────────

test("the bank uses the same 13 features, in the same order, as recs.ts", () => {
  assert.deepEqual([...INSIGHT_FEATURES], [...FEATURES]);
});

test("the bank is well formed: unique ids, valid targets, every option reachable", () => {
  const ids = QUESTION_BANK.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, ["packed", "price", "company", "return", "loud", "crowdage", "music", "dancefloor", "line", "foodq",
    "artq", "timeneeded", "setting", "effort", "sound", "worth", "popuptype", "bestfor"]);
  for (const q of QUESTION_BANK) {
    assert.ok(q.text.length > 0 && q.options.length >= 2, q.id);
    assert.equal(new Set(q.options.map((o) => o.id)).size, q.options.length, `${q.id} option ids`);
    assert.ok(q.categories === "all" || q.categories.every((c) => CATEGORIES.includes(c)), q.id);
    for (const o of q.options) {
      assert.notEqual(o.id, RESPONDENTS_KEY);
      assert.ok(o.label.length > 0);
      for (const targets of [o.targets, o.unselected]) {
        for (const [feature, value] of Object.entries(targets ?? {})) {
          assert.ok(FEATURES.includes(feature), `${q.id}.${o.id} targets ${feature}`);
          assert.ok(value >= 0 && value <= 1);
        }
      }
      if (o.unselected !== undefined) assert.ok(q.multi, "only a multi-select can say something by omission");
    }
  }
});

test("the bank matches the spec: universal questions, analytics-only questions, option targets", () => {
  assert.deepEqual(QUESTION_BANK.filter(isUniversal).map((q) => q.id), ["packed", "price", "company", "return", "bestfor"]);
  for (const id of ["company", "return", "line", "timeneeded", "sound", "worth"]) assert.equal(feedsFeatures(bank(id)), false, id);
  for (const id of ["packed", "price", "loud", "crowdage", "music", "dancefloor", "foodq", "artq", "setting", "effort", "popuptype"]) {
    assert.equal(feedsFeatures(bank(id)), true, id);
  }
  assert.deepEqual(QUESTION_BANK.filter((q) => q.multi).map((q) => q.id), ["music", "popuptype", "bestfor"]);
  assert.deepEqual(bank("packed").options.map((o) => o.targets.energy), [0.15, 0.4, 0.7, 0.95]);
  assert.deepEqual(bank("price").options.map((o) => o.targets.price), [0, 0.2, 0.45, 0.75, 0.95]);
  assert.deepEqual(bank("crowdage").options.map((o) => o.targets.crowdAge), [0.95, 0.65, 0.35, 0.1, 0.5]);
  assert.deepEqual(bank("company").options.map((o) => o.groupSize), [1, 2, 4, 7, 4]);
  assert.deepEqual(bank("music").options.find((o) => o.id === "latin").targets, { pop: 0.5, dancing: 0.8 });
});

test("questionsForCategory gives each category its own questions and its own best-for options", () => {
  const idsOf = (c) => questionsForCategory(c).map((q) => q.id);
  assert.deepEqual(idsOf("nightlife"), ["packed", "price", "company", "return", "loud", "crowdage", "music", "dancefloor", "line", "bestfor"]);
  assert.deepEqual(idsOf("culture"), ["packed", "price", "company", "return", "artq", "timeneeded", "worth", "bestfor"]);
  assert.deepEqual(idsOf("outdoors"), ["packed", "price", "company", "return", "timeneeded", "setting", "effort", "bestfor"]);
  assert.ok(idsOf("food").includes("foodq") && !idsOf("food").includes("music"));
  assert.ok(idsOf("live").includes("sound") && idsOf("popup").includes("popuptype"));
  const bestForOf = (c) => questionsForCategory(c).find((q) => q.id === "bestfor").options.map((o) => o.label);
  assert.deepEqual(bestForOf("nightlife"), ["Date night", "Big groups", "Dancing", "Conversation", "Pregame", "Late night"]);
  assert.deepEqual(bestForOf("outdoors"), ["Picnic", "Views", "Workout", "Dogs", "Sunset"]);
  assert.deepEqual(bestForOf("live"), bestForOf("popup"));
  // "Date night" says something about loudness at a bar, nothing at a restaurant.
  const dateNight = (c) => questionsForCategory(c).find((q) => q.id === "bestfor").options.find((o) => o.id === "date_night");
  assert.deepEqual(dateNight("nightlife").targets, { loudness: 0.3 });
  assert.equal(dateNight("food").targets, undefined);
  assert.deepEqual(questionsForCategory("not-a-category"), []);
});

// ───────────── which questions to ask ─────────────

test("pickQuestions returns valid, distinct questions in the contract shape for every category", () => {
  for (const category of CATEGORIES) {
    const allowed = new Map(questionsForCategory(category).map((q) => [q.id, q]));
    for (const seed of ["user-a", "user-b", ""]) {
      const picked = pickQuestions(category, {}, { seed });
      assert.equal(picked.length, QUESTIONS_PER_VISIT, category);
      assert.equal(new Set(picked.map((q) => q.id)).size, picked.length, "distinct");
      assert.ok(picked.some((q) => isUniversal(bank(q.id))), "at least one universal question");
      for (const q of picked) {
        assert.deepEqual(Object.keys(q).sort(), ["id", "multi", "options", "text"]);
        const source = allowed.get(q.id);
        assert.ok(source, `${q.id} applies to ${category}`);
        assert.deepEqual(q.options, source.options.map((o) => ({ id: o.id, label: o.label })));
      }
    }
  }
});

test("pickQuestions is stable for a seed, differs between seeds, and respects n", () => {
  assert.deepEqual(pickQuestions("nightlife", {}, { seed: "ethan" }), pickQuestions("nightlife", {}, { seed: "ethan" }));
  const sets = new Set(Array.from({ length: 30 }, (_, i) => pickQuestions("nightlife", {}, { seed: `user-${i}` }).map((q) => q.id).join()));
  assert.ok(sets.size > 3, "different people get different questions at a new venue");
  assert.equal(pickQuestions("nightlife", {}, { n: 3, seed: "x" }).length, 3);
  assert.equal(pickQuestions("nightlife", {}, { n: 1, seed: "x" }).length, 1);
  assert.ok(isUniversal(bank(pickQuestions("nightlife", {}, { n: 1, seed: "x" })[0].id)));
  assert.equal(pickQuestions("culture", {}, { n: 99, seed: "x" }).length, questionsForCategory("culture").length);
  assert.equal(pickQuestions("nightlife", {}, { n: 0, seed: "x" }).length, 1);
  assert.equal(pickQuestions("nightlife", {}, { n: NaN, seed: "x" }).length, QUESTIONS_PER_VISIT);
  assert.equal(pickQuestions("nightlife", undefined).length, QUESTIONS_PER_VISIT);
  assert.deepEqual(pickQuestions("not-a-category", {}, { seed: "x" }), []);
  assert.deepEqual(chooseQuestions("food", {}, "ethan"), pickQuestions("food", {}, { seed: "ethan" }));
  assert.equal(chooseQuestions("food", {}, "ethan", 3).length, 3);
});

test("pickQuestions asks where we know least and puts feature questions first", () => {
  // Fifty people agree on how loud and how busy it is: those two are settled.
  const counts = times(50, [ans("loud", "loud"), ans("packed", "packed")]);
  for (let i = 0; i < 20; i++) {
    const ids = pickQuestions("nightlife", counts, { seed: `u${i}` }).map((q) => q.id);
    assert.ok(!ids.includes("loud") && !ids.includes("packed"), ids.join());
    const feeds = ids.map((id) => feedsFeatures(questionsForCategory("nightlife").find((q) => q.id === id)));
    assert.deepEqual(feeds, [...feeds].sort((a, b) => +b - +a), "feature questions come first");
  }
  // On a new venue the three feature slots never go to an analytics-only question.
  for (let i = 0; i < 20; i++) {
    const picked = pickQuestions("nightlife", {}, { seed: `u${i}` });
    assert.ok(picked.slice(0, 3).every((q) => feedsFeatures(questionsForCategory("nightlife").find((b) => b.id === q.id))));
  }
});

test("the universal floor goes to the universal question with the fewest answers", () => {
  // Everything universal is well covered except "return".
  const counts = times(40, [ans("packed", "busy"), ans("price", "20_50"), ans("company", "date"), ans("bestfor", "dancing")]);
  for (let i = 0; i < 10; i++) {
    assert.ok(pickQuestions("nightlife", counts, { seed: `u${i}` }).some((q) => q.id === "return"));
  }
});

test("questionValue: fewer answers, more disagreement and feature questions are worth more", () => {
  const loud = bank("loud"), line = bank("line");
  near(questionValue({}, loud), 1 / Math.sqrt(INSIGHT_N0));
  near(questionValue({}, line), DASHBOARD_QUESTION_WEIGHT / Math.sqrt(INSIGHT_N0));
  const agreed = times(8, [ans("loud", "loud")]);
  const split = times(4, [ans("loud", "quiet")], times(4, [ans("loud", "deafening")]));
  assert.equal(answerEntropy(agreed, loud), 0);
  near(answerEntropy(split, loud), Math.log(2) / Math.log(4));
  assert.equal(answerEntropy({}, loud), 1);
  near(questionValue(agreed, loud), 0.5 / Math.sqrt(INSIGHT_N0 + 8));
  assert.ok(questionValue(split, loud) > questionValue(agreed, loud));
  assert.ok(questionValue(agreed, loud) < questionValue({}, loud));
  const even = ["quiet", "buzzing", "loud", "deafening"].reduce((c, o) => times(3, [ans("loud", o)], c), {});
  near(answerEntropy(even, loud), 1);
});

// ───────────── totals ─────────────

test("addAnswers counts picks and respondents and never changes its input", () => {
  const empty = {};
  const one = addAnswers(empty, [ans("packed", "packed"), ans("music", "pop", "electronic")]);
  assert.deepEqual(empty, {});
  assert.deepEqual(one, { packed: { packed: 1, _n: 1 }, music: { pop: 1, electronic: 1, _n: 1 } });
  const two = addAnswers(one, [ans("packed", "busy"), ans("music", "pop")]);
  assert.deepEqual(two, { packed: { packed: 1, busy: 1, _n: 2 }, music: { pop: 2, electronic: 1, _n: 2 } });
  assert.deepEqual(one.packed, { packed: 1, _n: 1 });
  assert.equal(respondentsOf(two, bank("music")), 2);
  assert.deepEqual(addAnswers(undefined, [ans("return", "no")], 1.5), { return: { no: 1.5, _n: 1.5 } });
});

test("addAnswers ignores unknown ids, extra single-choice options and repeats instead of throwing", () => {
  assert.deepEqual(addAnswers({}, [ans("nope", "x"), ans("packed", "nope"), ans("packed"), ans("loud", "loud")]), { loud: { loud: 1, _n: 1 } });
  assert.deepEqual(addAnswers({}, [ans("packed", "busy", "packed")]), { packed: { busy: 1, _n: 1 } }, "single choice keeps the first");
  assert.deepEqual(addAnswers({}, [ans("music", "pop", "pop", "bogus")]), { music: { pop: 1, _n: 1 } });
  assert.deepEqual(addAnswers({}, [ans("packed", "busy"), ans("packed", "packed")]), { packed: { busy: 1, _n: 1 } }, "one answer per question");
  assert.deepEqual(addAnswers({}, [ans("packed", RESPONDENTS_KEY)]), {});
  for (const junk of [undefined, null, "x", 3, [null], [{}], [{ questionId: 5 }], [{ questionId: "packed" }], [{ questionId: "packed", optionIds: "busy" }]]) {
    assert.deepEqual(addAnswers({}, junk), {});
  }
  // Damaged stored totals are cleaned, not propagated.
  assert.deepEqual(addAnswers({ packed: { busy: 2, _n: 2, odd: -1, bad: "x" }, junk: 4, gone: {} }, []), { packed: { busy: 2, _n: 2 } });
  assert.deepEqual(addAnswers({ packed: { busy: 1, _n: 1 } }, [ans("packed", "busy")], NaN), { packed: { busy: 1, _n: 1 } });
});

test("removing answers restores the totals exactly", () => {
  const before = times(3, [ans("packed", "busy"), ans("music", "hiphop", "latin"), ans("bestfor", "dancing", "late_night")]);
  const mine = [ans("packed", "packed"), ans("music", "pop", "electronic"), ans("crowdage", "25_34"), ans("return", "definitely")];
  const after = addAnswers(before, mine);
  assert.notDeepEqual(after, before);
  assert.deepEqual(removeAnswers(after, mine), before);
  assert.deepEqual(removeAnswers(addAnswers({}, mine), mine), {});
  // Also with a local's 1.5 weight, and in any order.
  let c = {};
  const people = [mine, [ans("packed", "busy")], [ans("music", "pop")], [ans("loud", "loud"), ans("line", "over_30")]];
  for (const p of people) c = addAnswers(c, p, LOCAL_ANSWER_WEIGHT);
  for (const p of [people[2], people[0], people[3], people[1]]) c = removeAnswers(c, p, LOCAL_ANSWER_WEIGHT);
  assert.deepEqual(c, {});
  // Replacing an answer = remove the old one, add the new one.
  const replaced = addAnswers(removeAnswers(after, mine), [ans("packed", "empty")]);
  assert.deepEqual(replaced.packed, { busy: 3, empty: 1, _n: 4 });
});

test("removeAnswers never goes below zero", () => {
  assert.deepEqual(removeAnswers({}, [ans("packed", "busy")]), {});
  assert.deepEqual(removeAnswers({ packed: { busy: 1, _n: 1 } }, [ans("packed", "busy"), ans("loud", "loud")]), {});
  assert.deepEqual(removeAnswers({ packed: { busy: 1, packed: 2, _n: 3 } }, [ans("packed", "busy")]), { packed: { packed: 2, _n: 2 } });
});

test("cleanAnswers keeps only what applies to the category, capped", () => {
  const raw = [ans("music", "pop", "bogus", "pop"), ans("artq", "great"), ans("packed", "busy", "packed"), ans("packed", "empty"),
    ans("bestfor", "picnic", "dancing"), ans("nope", "x"), ans("loud")];
  assert.deepEqual(cleanAnswers("nightlife", raw), [ans("music", "pop"), ans("packed", "busy"), ans("bestfor", "dancing")]);
  assert.deepEqual(cleanAnswers("outdoors", raw), [ans("packed", "busy"), ans("bestfor", "picnic")]);
  assert.deepEqual(cleanAnswers("culture", raw), [ans("artq", "great"), ans("packed", "busy")]);
  assert.deepEqual(cleanAnswers("nightlife", raw, 2), [ans("music", "pop"), ans("packed", "busy")]);
  assert.deepEqual(cleanAnswers("nightlife", undefined), []);
  assert.deepEqual(cleanAnswers("not-a-category", raw), []);
  const all = questionsForCategory("nightlife").map((q) => ans(q.id, q.options[0].id));
  assert.equal(cleanAnswers("nightlife", all).length, 8);
  // Multi-select options come back in bank order whatever order the app sent.
  assert.deepEqual(cleanAnswers("nightlife", [ans("music", "latin", "pop")]), [ans("music", "pop", "latin")]);
});

// ───────────── measured vector ─────────────

test("observedVector: no answers means no weight anywhere", () => {
  for (const counts of [undefined, {}, { company: { date: 9, _n: 9 }, line: { no_wait: 4, _n: 4 } }]) {
    const { vector, weight } = observedVector(counts);
    assert.equal(vector.length, 13);
    assert.deepEqual(weight, FEATURES.map(() => 0));
    assert.deepEqual(vector, FEATURES.map(() => 0));
    assert.equal(hasObservations(weight), false);
  }
  assert.equal(hasObservations(undefined), false);
});

test("observedVector is the weighted mean of the answers' targets", () => {
  const counts = times(3, [ans("packed", "packed")], times(1, [ans("packed", "empty")]));
  const { vector, weight } = observedVector(counts);
  assert.equal(weight[F("energy")], 4);
  near(vector[F("energy")], (3 * 0.95 + 0.15) / 4);
  assert.equal(weight[F("loudness")], 0);
  assert.ok(hasObservations(weight));
  // Two questions feeding one feature add up.
  const both = observedVector(addAnswers(times(2, [ans("loud", "quiet")]), [ans("bestfor", "conversation")]));
  assert.equal(both.weight[F("loudness")], 3);
  near(both.vector[F("loudness")], (2 * 0.1 + 0.2) / 3);
  assert.ok(observedVector(times(30, [ans("loud", "deafening"), ans("price", "free")])).vector.every((x) => x >= 0 && x <= 1));
});

test("music: a picked genre counts 1 toward 0.9, an unpicked one counts 0.5 toward 0.1", () => {
  const { vector, weight } = observedVector(times(1, [ans("music", "electronic")]));
  assert.equal(weight[F("electronic")], 1);
  near(vector[F("electronic")], 0.9);
  for (const genre of ["pop", "hiphop", "indie"]) {
    assert.equal(weight[F(genre)], 0.5, genre);
    near(vector[F(genre)], 0.1);
  }
  assert.equal(weight[F("liveMusic")], 0, "not picking 'live band' says nothing");
  assert.equal(weight[F("dancing")], 0);
  // Four people: three heard house, one heard hip-hop.
  const mixed = observedVector(times(3, [ans("music", "electronic")], times(1, [ans("music", "hiphop")])));
  near(mixed.vector[F("electronic")], (3 * 0.9 + 0.5 * 0.1) / 3.5);
  near(mixed.vector[F("hiphop")], (0.9 + 1.5 * 0.1) / 2.5);
  assert.ok(mixed.vector[F("electronic")] > 0.75 && mixed.vector[F("hiphop")] < 0.5);
  // Latin: half pop, and people dance.
  const latin = observedVector(times(1, [ans("music", "latin")]));
  near(latin.vector[F("pop")], (0.5 + 0.5 * 0.1) / 1.5);
  near(latin.vector[F("dancing")], 0.8);
  // The by-omission rule is for music only.
  const popup = observedVector(times(1, [ans("popuptype", "food_drink")]));
  assert.equal(popup.weight[F("culture")], 0);
  near(popup.vector[F("food")], 0.8);
});

test("locals' answers weigh 1.5", () => {
  const visitor = [ans("packed", "empty")], local = [ans("packed", "packed")];
  const counts = addAnswers(addAnswers({}, visitor), local);
  const locals = addAnswers({}, local);
  const plain = observedVector(counts);
  const weighted = observedVector(counts, locals);
  near(plain.vector[F("energy")], (0.15 + 0.95) / 2);
  assert.equal(weighted.weight[F("energy")], 1 + LOCAL_ANSWER_WEIGHT);
  near(weighted.vector[F("energy")], (0.15 + LOCAL_ANSWER_WEIGHT * 0.95) / (1 + LOCAL_ANSWER_WEIGHT));
  assert.ok(weighted.vector[F("energy")] > plain.vector[F("energy")], "the local pulls harder");
  // All locals: the mean is unchanged, only the weight grows.
  const allLocal = observedVector(locals, locals);
  near(allLocal.vector[F("energy")], 0.95);
  assert.equal(allLocal.weight[F("energy")], LOCAL_ANSWER_WEIGHT);
  // Local totals can never count more people than there are.
  assert.equal(observedVector(locals, times(5, local)).weight[F("energy")], LOCAL_ANSWER_WEIGHT);
  // And a local's unpicked genres weigh 0.75.
  const m = addAnswers({}, [ans("music", "pop")]);
  assert.equal(observedVector(m, m).weight[F("indie")], 0.5 * LOCAL_ANSWER_WEIGHT);
});

test("observedVector reads an option's targets from the venue's own category", () => {
  // "Date night" says "a quiet room" about a bar and nothing about a restaurant (ALGORITHM.md 3a).
  const dateNight = times(10, [ans("bestfor", "date_night")]);
  const food = observedVector(dateNight, undefined, "food");
  assert.deepEqual(food.weight, FEATURES.map(() => 0), "food + date_night feeds no feature");
  assert.equal(hasObservations(food.weight), false);
  // So a loud restaurant stays as loud as the featurizer said: the blend is the prior exactly.
  const prior = FEATURES.map((k) => (k === "loudness" ? 0.8 : 0.3));
  assert.deepEqual(blendVector(prior, food.vector, food.weight), prior);
  const bar = observedVector(dateNight, undefined, "nightlife");
  assert.equal(bar.weight[F("loudness")], 10);
  near(bar.vector[F("loudness")], 0.3);
  near(blendVector(prior, bar.vector, bar.weight)[F("loudness")], (INSIGHT_N0 * 0.8 + 10 * 0.3) / (INSIGHT_N0 + 10));
  // Food's own option with a target still counts, and options another category owns do not.
  assert.equal(observedVector(times(4, [ans("bestfor", "special_occasion")]), undefined, "food").weight[F("price")], 4);
  assert.deepEqual(observedVector(times(4, [ans("bestfor", "dancing")]), undefined, "food").weight, FEATURES.map(() => 0));
  assert.equal(observedVector(times(4, [ans("bestfor", "dancing")]), undefined, "live").weight[F("dancing")], 4);
  // Questions the category does not ask are not read either: culture never asks how loud it was.
  assert.deepEqual(observedVector(times(4, [ans("loud", "deafening")]), undefined, "culture").weight, FEATURES.map(() => 0));
  // Every category's bestfor options carry exactly the targets its own definition has.
  for (const category of CATEGORIES) {
    const options = questionsForCategory(category).find((q) => q.id === "bestfor").options;
    for (const o of options) {
      const got = observedVector(times(3, [ans("bestfor", o.id)]), undefined, category);
      const fed = FEATURES.filter((_, k) => got.weight[k] > 0).sort();
      assert.deepEqual(fed, Object.keys(o.targets ?? {}).sort(), `${category} ${o.id}`);
    }
  }
});

test("measuredVector: a question feeds the vector only once MIN_SHOW people answered it", () => {
  // One person at a bar: spent $100+, found it empty. Nothing may be readable back from the vector.
  const one = times(1, [ans("price", "100_plus"), ans("packed", "empty")]);
  const single = measuredVector("nightlife", one);
  assert.deepEqual(single.weight, FEATURES.map(() => 0));
  assert.equal(hasObservations(single.weight), false);
  const prior = FEATURES.map(() => 0.3);
  assert.deepEqual(blendVector(prior, single.vector, single.weight), prior);
  // The unguarded measurement is what gave it away: 6 * blend - 5 * prior was the "$100+" target.
  const open = observedVector(one, undefined, "nightlife");
  near((INSIGHT_N0 + 1) * blendVector(prior, open.vector, open.weight)[F("price")] - INSIGHT_N0 * 0.3, 0.95);
  // Four people: still nothing. The fifth makes the question count, all five at once.
  for (let n = 1; n < MIN_SHOW; n++) {
    assert.equal(hasObservations(measuredVector("nightlife", times(n, [ans("price", "100_plus")])).weight), false, `${n} respondents`);
  }
  const five = measuredVector("nightlife", times(MIN_SHOW, [ans("price", "100_plus")]));
  assert.equal(five.weight[F("price")], MIN_SHOW);
  near(five.vector[F("price")], 0.95);
  // The rule is per question: five answers about price do not carry one person's answer about the crowd in.
  const mixed = times(1, [ans("packed", "empty")], times(MIN_SHOW, [ans("price", "20_50")]));
  const gated = measuredVector("nightlife", mixed);
  assert.equal(gated.weight[F("price")], MIN_SHOW);
  assert.equal(gated.weight[F("energy")], 0);
  // Locals weigh more but are not more people: four locals (weight 6) are still four respondents.
  const fourLocals = times(4, [ans("packed", "packed")]);
  assert.equal(observedVector(fourLocals, fourLocals, "nightlife").weight[F("energy")], 4 * LOCAL_ANSWER_WEIGHT);
  assert.equal(measuredVector("nightlife", fourLocals, fourLocals).weight[F("energy")], 0);
  // Taking an answer back below the line removes the question again.
  const back = removeAnswers(times(MIN_SHOW, [ans("price", "100_plus")]), [ans("price", "100_plus")]);
  assert.equal(measuredVector("nightlife", back).weight[F("price")], 0);
  // It also reads the category's own options.
  assert.deepEqual(measuredVector("food", times(9, [ans("bestfor", "date_night")])).weight, FEATURES.map(() => 0));
});

test("isMeasured: a feature counts as measured from INSIGHT_N0 answers' weight", () => {
  const weight = FEATURES.map((k) => (k === "loudness" ? INSIGHT_N0 : k === "energy" ? INSIGHT_N0 - 0.5 : 0));
  assert.equal(isMeasured("loudness", weight), true);
  assert.equal(isMeasured("energy", weight), false);
  assert.equal(isMeasured("food", weight), false);
  assert.equal(isMeasured(undefined, weight), false);
  assert.equal(isMeasured("loudness", undefined), false);
  assert.equal(isMeasured("loudness", []), false);
});

test("blendVector equals the prior exactly with no answers", () => {
  const prior = [0.3, 0.1, 0.7, 0.33, 0.9, 0.05, 0.15, 0.3, 0.3, 0.3, 0.123456789, 1, 0];
  assert.deepEqual(blendVector(prior), prior);
  assert.notEqual(blendVector(prior), prior, "a copy, not the same array");
  const none = observedVector({});
  assert.deepEqual(blendVector(prior, none.vector, none.weight), prior);
  assert.deepEqual(blendVector(prior, FEATURES.map(() => 0.9), FEATURES.map(() => 0)), prior);
  assert.deepEqual(blendVector(prior, [0.9], [3]), prior, "wrong length is ignored");
  assert.deepEqual(blendVector(prior, FEATURES.map(() => 0.9), undefined), prior);
  assert.deepEqual(blendVector(prior, FEATURES.map(() => NaN), FEATURES.map(() => 4)), prior);
  assert.deepEqual(blendVector(prior, FEATURES.map(() => 0.9), FEATURES.map(() => -2)), prior);
});

test("blendVector shrinks toward the measurement: half at 5 answers, 80% at 20, all of it in the limit", () => {
  const prior = FEATURES.map(() => 0.2), observed = FEATURES.map(() => 0.8);
  const at = (n) => blendVector(prior, observed, FEATURES.map(() => n))[0];
  near(at(5), 0.5);
  near(at(20), 0.2 + 0.8 * 0.6);
  near(at(1), (5 * 0.2 + 0.8) / 6);
  let last = 0.2;
  for (const n of [1, 2, 5, 10, 20, 50, 200, 5000]) {
    assert.ok(at(n) > last && at(n) < 0.8, `monotone at ${n}`);
    last = at(n);
  }
  assert.ok(0.8 - at(5000) < 0.001);
  // Per feature: only the measured feature moves.
  const weight = FEATURES.map((_, k) => (k === F("loudness") ? 10 : 0));
  const blended = blendVector(prior, observed, weight);
  near(blended[F("loudness")], (5 * 0.2 + 10 * 0.8) / 15);
  assert.equal(blended.filter((x) => x === 0.2).length, 12);
  // n0 is the prior's strength.
  near(blendVector(prior, observed, FEATURES.map(() => 3), 3)[0], 0.5);
  near(blendVector(prior, observed, FEATURES.map(() => 3), 0)[0], 0.8);
  assert.ok(blendVector(FEATURES.map(() => 1), FEATURES.map(() => 1), FEATURES.map(() => 7)).every((x) => x <= 1));
});

test("end to end: answers pull a wrong keyword guess toward the truth, and undoing them gives the prior back", () => {
  const prior = FEATURES.map(() => 0.3);   // the featurizer thought "generic bar"
  let counts = {}, locals = {};
  const night = [ans("packed", "packed"), ans("loud", "deafening"), ans("music", "electronic"), ans("dancefloor", "most"), ans("crowdage", "under_25")];
  for (let i = 0; i < 20; i++) {
    counts = addAnswers(counts, night);
    if (i % 2 === 0) locals = addAnswers(locals, night);
  }
  const o = observedVector(counts, locals);
  const f = blendVector(prior, o.vector, o.weight);
  for (const k of ["energy", "loudness", "electronic", "dancing", "crowdAge"]) assert.ok(f[F(k)] > 0.75, `${k} ${f[F(k)]}`);
  assert.ok(f[F("pop")] < 0.2 && f[F("hiphop")] < 0.2);
  for (const k of ["price", "culture", "outdoors", "food"]) assert.equal(f[F(k)], 0.3, `${k} was never asked about`);
  for (let i = 0; i < 20; i++) {
    counts = removeAnswers(counts, night);
    if (i % 2 === 0) locals = removeAnswers(locals, night);
  }
  assert.deepEqual(counts, {});
  const back = observedVector(counts, locals);
  assert.deepEqual(blendVector(prior, back.vector, back.weight), prior);
});

// ───────────── what a venue page states ─────────────

test("distributions: one per question of the category, totals always, the split only from 5 respondents", () => {
  const four = times(4, [ans("packed", "packed")]);
  const d4 = distributions("nightlife", four);
  assert.deepEqual(d4.map((d) => d.questionId), questionsForCategory("nightlife").map((q) => q.id));
  const packed4 = d4.find((d) => d.questionId === "packed");
  assert.equal(packed4.total, 4);
  assert.equal(packed4.top, undefined);
  assert.ok(!("top" in packed4));
  assert.ok(packed4.options.every((o) => o.count === 0 && o.pct === 0), "four people's answers are not shown");
  assert.deepEqual(packed4.options.map((o) => o.label), ["Empty", "Comfortable", "Busy", "Packed"]);

  const five = addAnswers(four, [ans("packed", "busy")]);
  const packed5 = distributions("nightlife", five).find((d) => d.questionId === "packed");
  assert.equal(packed5.total, MIN_SHOW);
  assert.equal(packed5.top, "Packed");
  assert.deepEqual(packed5.options.map((o) => [o.id, o.count, o.pct]), [["empty", 0, 0], ["comfortable", 0, 0], ["busy", 1, 20], ["packed", 4, 80]]);
  assert.equal(packed5.text, "How busy was it?");
  const unanswered = distributions("nightlife", five).find((d) => d.questionId === "loud");
  assert.equal(unanswered.total, 0);
  assert.equal(unanswered.top, undefined);
  assert.ok(distributions("food", undefined).every((d) => d.total === 0 && d.top === undefined));
  assert.deepEqual(distributions("not-a-category", five), []);
});

test("distributions of a multi-select are shares of people, not of picks", () => {
  const counts = times(6, [ans("music", "pop", "hiphop")], times(2, [ans("music", "electronic")]));
  const music = distributions("nightlife", counts).find((d) => d.questionId === "music");
  assert.equal(music.total, 8);
  assert.equal(music.options.find((o) => o.id === "pop").pct, 75);
  assert.equal(music.options.find((o) => o.id === "hiphop").pct, 75);
  assert.equal(music.options.find((o) => o.id === "electronic").pct, 25);
  assert.equal(music.top, "Pop / Top 40");
  // Totals written before the respondent count existed still read sensibly.
  const legacy = { music: { pop: 6, hiphop: 3 }, packed: { busy: 3, packed: 4 } };
  assert.equal(respondentsOf(legacy, bank("music")), 6);
  assert.equal(respondentsOf(legacy, bank("packed")), 7);
  assert.ok(distributions("nightlife", legacy).every((d) => d.options.every((o) => o.pct <= 100)));
});

test("highlights stay empty below the minimum", () => {
  assert.deepEqual(highlights("nightlife", {}), []);
  assert.deepEqual(highlights("nightlife", undefined), []);
  for (let n = 1; n < MIN_SHOW; n++) {
    const counts = times(n, [ans("packed", "packed"), ans("loud", "loud"), ans("return", "definitely"), ans("bestfor", "dancing")]);
    assert.deepEqual(highlights("nightlife", counts), [], `${n} respondents`);
    assert.deepEqual(bestFor("nightlife", counts), [], `${n} respondents`);
    const s = summarize("nightlife", counts, n);
    assert.equal(s.confidence, "low");
    assert.deepEqual([s.highlights, s.bestFor], [[], []]);
  }
  const enough = times(MIN_SHOW, [ans("packed", "packed"), ans("bestfor", "dancing")]);
  assert.deepEqual(highlights("nightlife", enough), ["Packed"]);
  assert.deepEqual(bestFor("nightlife", enough), ["Dancing"]);
});

test("highlights: a majority answer per single-choice question, strongest first, at most four", () => {
  let counts = times(10, [ans("packed", "packed"), ans("crowdage", "25_34"), ans("price", "20_50"), ans("loud", "loud"), ans("line", "no_wait"), ans("music", "pop")]);
  counts = times(2, [ans("packed", "busy"), ans("crowdage", "under_25"), ans("crowdage", "mix"), ans("price", "50_100")], counts);
  counts = times(3, [ans("crowdage", "35_49"), ans("price", "50_100"), ans("price", "under_20")], counts);
  // loud and line 10/10, packed 10/12, crowdage 10/15, price 10/15
  const h = highlights("nightlife", counts);
  assert.equal(h.length, 4);
  assert.deepEqual(h.slice(0, 3), ["Loud", "No wait", "Packed"]);
  assert.ok(["Mostly 25–34", "$20–50 a head"].includes(h[3]));
  assert.ok(!h.includes("Pop / Top 40"), "a multi-select is not a highlight");
  // Under half: nothing. Exactly half but tied for the lead: nothing.
  const split = times(4, [ans("loud", "loud")], times(3, [ans("loud", "quiet")], times(3, [ans("loud", "buzzing")])));
  assert.deepEqual(highlights("nightlife", split), []);
  const tie = times(3, [ans("loud", "loud")], times(3, [ans("loud", "quiet")]));
  assert.deepEqual(highlights("nightlife", tie), []);
  // An option with no phrase ("Maybe", "A few") never produces one.
  assert.deepEqual(highlights("nightlife", times(9, [ans("return", "maybe"), ans("dancefloor", "a_few")])), []);
  // Options carry their own phrase.
  assert.deepEqual(highlights("nightlife", times(6, [ans("packed", "comfortable")])), ["Easy to get a seat"]);
  assert.deepEqual(highlights("food", times(6, [ans("line", "over_30")])), ["30+ min line"]);
  // A question that does not apply to the category is not reported for it.
  assert.deepEqual(highlights("culture", times(6, [ans("loud", "loud")])), []);
});

test("'would go back' is always phrased as the share", () => {
  const counts = times(6, [ans("return", "definitely")], times(1, [ans("return", "maybe")]));
  assert.deepEqual(highlights("food", counts), ["86% would go back"]);
  assert.deepEqual(highlights("food", times(5, [ans("return", "no")], times(3, [ans("return", "maybe")]))), ["63% wouldn't go back"]);
});

test("bestFor: options picked by at least 30% of respondents, top three by share", () => {
  let counts = times(6, [ans("bestfor", "dancing", "late_night")]);
  counts = times(3, [ans("bestfor", "big_groups", "dancing", "pregame")], counts);
  counts = times(1, [ans("bestfor", "date_night")], counts);
  // 10 people: dancing 9, late night 6, big groups 3, pregame 3, date night 1
  const got = bestFor("nightlife", counts);
  assert.deepEqual(got.slice(0, 2), ["Dancing", "Late night"]);
  assert.equal(got.length, 3);
  assert.ok(["Big groups", "Pregame"].includes(got[2]));
  assert.ok(3 / 10 >= BESTFOR_SHARE);
  const thin = times(8, [ans("bestfor", "views")], times(2, [ans("bestfor", "dogs")]));
  assert.deepEqual(bestFor("outdoors", thin), ["Views"], "20% is not enough");
  assert.deepEqual(bestFor("outdoors", {}), []);
  // The same totals read through another category only show that category's options.
  assert.deepEqual(bestFor("nightlife", thin), []);
});

test("confidenceOf and summarize", () => {
  assert.deepEqual([0, 4, 5, 19, 20, 500].map(confidenceOf), ["low", "low", "medium", "medium", "high", "high"]);
  const counts = times(12, [ans("packed", "packed"), ans("bestfor", "dancing")]);
  const s = summarize("nightlife", counts, 12);
  assert.equal(s.confidence, "medium");
  assert.deepEqual(s.highlights, ["Packed"]);
  assert.deepEqual(s.bestFor, ["Dancing"]);
  assert.equal(s.distributions.length, questionsForCategory("nightlife").length);
  assert.equal(summarize("nightlife", counts, 25).confidence, "high");
  const empty = summarize("culture", undefined, 0);
  assert.deepEqual([empty.highlights, empty.bestFor, empty.confidence], [[], [], "low"]);
  assert.ok(empty.distributions.length > 0);
});

test("answerChips: short labels of one person's answers, nothing that names their company", () => {
  assert.deepEqual(answerChips([ans("crowdage", "25_34"), ans("packed", "packed")]), ["Packed", "Mostly 25–34"]);
  assert.deepEqual(answerChips([ans("company", "date")]), []);
  assert.deepEqual(answerChips([ans("return", "definitely"), ans("return", "maybe")]), ["Would go back"]);
  assert.deepEqual(answerChips([ans("return", "maybe"), ans("dancefloor", "a_few")]), []);
  assert.deepEqual(answerChips([ans("music", "electronic", "pop", "hiphop")]), ["Pop", "Hip-hop"]);
  assert.deepEqual(answerChips([ans("price", "20_50"), ans("foodq", "best")]), ["$20–50", "Best food in town"]);
  const many = [ans("packed", "packed"), ans("price", "free"), ans("return", "definitely"), ans("loud", "loud"), ans("crowdage", "mix"), ans("line", "no_wait")];
  assert.equal(answerChips(many).length, 4);
  assert.equal(answerChips(many, 2).length, 2);
  assert.deepEqual(answerChips(many, 0), []);
  for (const junk of [undefined, null, [], [null], [{}], [ans("nope", "x")], [ans("packed", "nope")], [{ questionId: "packed" }]]) {
    assert.deepEqual(answerChips(junk), []);
  }
  for (const q of QUESTION_BANK) for (const o of q.options) if (o.chip !== undefined) assert.ok(o.chip.length <= 20, o.chip);
});

test("averageGroupSize comes from 'who were you with'", () => {
  assert.equal(averageGroupSize({}), undefined);
  assert.equal(averageGroupSize(times(2, [ans("company", "solo")], times(2, [ans("company", "big_group")]))), 4);
});

// ───────────── dashboard math ─────────────

test("audienceProfile: what sets the lovers apart, and nothing from fewer than three of them", () => {
  const taste = (over) => FEATURES.map((k) => over[k] ?? 0.3);
  const raver = taste({ electronic: 0.9, dancing: 0.8, energy: 0.7 });
  const foodie = taste({ food: 0.9, price: 0.7 });
  assert.deepEqual(audienceProfile([raver, raver], [raver, raver, foodie]), []);
  const got = audienceProfile([raver, raver, raver], [raver, raver, raver, foodie, foodie, foodie]);
  assert.deepEqual(got, [
    { label: "Electronic music", pct: 90 }, { label: "Dancing", pct: 80 }, { label: "High energy", pct: 70 },
  ]);
  assert.deepEqual(audienceProfile([raver, raver, raver], [raver, raver, raver]), [], "no gap, nothing to say");
  assert.deepEqual(audienceProfile([raver, raver, raver, [0.5]], [raver, foodie, [1, 2]]).length, 3, "bad vectors are skipped");
  const wide = audienceProfile([1, 2, 3].map(() => FEATURES.map(() => 0.9)), [1, 2, 3].map(() => FEATURES.map(() => 0.1)).concat([FEATURES.map(() => 0.9)]));
  assert.equal(wide.length, 5);
});

test("histogram and bucketCounts", () => {
  assert.deepEqual(histogram([0, 6, 6, 7, -1, 2.5, undefined, NaN], 7), [1, 0, 0, 0, 0, 0, 2]);
  assert.equal(histogram([], 24).length, 24);
  assert.deepEqual(bucketCounts(["loved", "loved", "fine", "didnt", "other"]), { loved: 2, fine: 1, didnt: 1 });
});

test("winRecord: win rate and the tally per opponent", () => {
  const rows = [
    { winnerId: "a", loserId: "b" }, { winnerId: "a", loserId: "b" }, { winnerId: "b", loserId: "a" },
    { winnerId: "a", loserId: "c" }, { winnerId: "c", loserId: "d" }, { winnerId: "a", loserId: "a" },
  ];
  const r = winRecord("a", rows);
  assert.deepEqual([r.wins, r.losses, r.winRate], [3, 1, 0.75]);
  assert.deepEqual(r.opponents, [{ id: "b", wins: 2, losses: 1 }, { id: "c", wins: 1, losses: 0 }]);
  const none = winRecord("z", rows);
  assert.deepEqual([none.wins, none.losses, none.winRate, none.opponents], [0, 0, undefined, []]);
  assert.equal(winRecord("d", rows).winRate, 0);
});

test("coLoved and lift: 'people who loved this also loved'", () => {
  const lists = [["x", "a", "b"], ["x", "a", "a"], ["x", "b", "c"], ["a"]];
  assert.deepEqual(coLoved("x", lists, 2), [{ id: "a", both: 3 }, { id: "b", both: 2 }]);
  assert.deepEqual(coLoved("x", lists, 3), [{ id: "a", both: 3 }]);
  assert.deepEqual(coLoved("x", lists).length, 2, `default support is ${ALSO_MIN_SUPPORT}`);
  assert.deepEqual(coLoved("x", []), []);
  // 4 of 10 lovers of i also loved j; j is loved by 20 of 100 users: twice as likely as anyone.
  near(lift(4, 10, 20, 100), 2);
  near(lift(5, 10, 50, 100), 1);
  assert.ok(lift(2, 10, 80, 100) < 1, "everyone loves j, so it says little about i");
  assert.deepEqual([lift(0, 10, 20, 100), lift(4, 0, 20, 100), lift(4, 10, 0, 100), lift(4, 10, 20, 0)], [0, 0, 0, 0]);
});

test("weeklyTrend: weeks start on Monday UTC, oldest first, the last eight ending at the newest rating", () => {
  const monday = Date.UTC(2026, 10, 9);            // Monday 9 Nov 2026
  assert.equal(new Date(monday).getUTCDay(), 1);
  assert.equal(weekStartOf(monday), monday);
  assert.equal(weekStartOf(monday + WEEK_MS - 1), monday);
  assert.equal(weekStartOf(monday - 1), monday - WEEK_MS);
  const points = [
    { at: monday + 1000, score: 8 }, { at: monday + 3 * 86_400_000, score: 9 },
    { at: monday - WEEK_MS + 5, score: 6.04 },
    { at: monday - 7 * WEEK_MS, score: 5 },          // the 8th week back: kept
    { at: monday - 8 * WEEK_MS, score: 1 },          // older: dropped
    { at: NaN, score: 3 }, { at: monday, score: NaN },
  ];
  assert.deepEqual(weeklyTrend(points), [
    { weekStart: monday - 7 * WEEK_MS, avgScore: 5, n: 1 },
    { weekStart: monday - WEEK_MS, avgScore: 6, n: 1 },
    { weekStart: monday, avgScore: 8.5, n: 2 },
  ]);
  assert.deepEqual(weeklyTrend(points, 1), [{ weekStart: monday, avgScore: 8.5, n: 2 }]);
  assert.deepEqual(weeklyTrend([]), []);
});
