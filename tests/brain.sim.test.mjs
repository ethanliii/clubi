// Owner: Brain session. The offline simulator of docs/ALGORITHM.md section 9.
// There are no real users yet, so the scorer is checked against simulated ones whose true taste we know:
// 200 users, 300 venues, rankings made by binary insertion on the true enjoyment, insight answers read off
// the true venue vector, and the real update functions run in time order. Fixed seeds, no Math.random().
// Five worlds are simulated and averaged: one world has only about 340 held-out pairs, too few to read.
// SIM_SEED and SIM_WORLDS print the same report for other worlds (the numbers quoted as "12 more worlds" in
// section 9 are SIM_SEED=20261120 SIM_WORLDS=12); the assertions are written for the default five.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as group from "../convex/lib/group.ts";
import * as insights from "../convex/lib/insights.ts";
import * as recs from "../convex/lib/recs.ts";

const SEED = Number(process.env.SIM_SEED ?? 20261115);
const WORLDS = Number(process.env.SIM_WORLDS ?? 5);   // seeds SEED, SEED + 1, ...
const STARTED = performance.now();

// ───────────── the world (section 9, "The world") ─────────────
const N_USERS = 200;
const N_VENUES = 300;
const N_PERFORMERS = 20;
const TASTE_NOISE = 0.12;          // around the archetype
const VENUE_NOISE = 0.08;          // around the venue type
const FEATURIZER_NOISE = 0.25;     // how wrong the keyword guess is
const QUALITY_SD = 0.5;
const ENJOY_NOISE = 0.5;
const FAVOURITE_BONUS_MIN = 0.5, FAVOURITE_BONUS_MAX = 2.5;   // per user and favourite: how much more they enjoy that act's night
const LOCAL_SHARE = 0.6;
const POPULARITY_SD = 0.9;         // log-normal: a few venues get most of the visits
const FAVOURITES_PER_USER = 3;
const FOLLOW_RATE = 0.5;           // share of their favourites a user follows in the app
const OTHER_FOLLOWS_MAX = 2;       // and 0 to 2 performers who are not favourites: a friend's tip, an old taste
const FRIENDS_PER_USER = 4;
const FRIEND_SAME_ARCHETYPE = 0.7;
// ───────────── what users do ─────────────
const QUIZ_NOISE = 0.1;
const QUIZ_SKIPPED_SHARE = 0.2;    // never took the quiz: NEUTRAL_TASTE
const QUIZ_CARELESS_SHARE = 0.3;   // tapped through it: each card answered at random half the time
const CARELESS_CARD_RATE = 0.5;
const QUIZ_MULTI_CARDS = [0, 5];   // "What music gets you out?" and "Besides nightlife you're into..."
const RANKED_MIN = 8, RANKED_MAX = 15;
const HELD_OUT_SHARE = 0.2;
const ANSWER_RATE = 0.4;
const ANSWER_NOISE = 0.15;
const LOVED_FROM = 7, DIDNT_UNTIL = 4;
const MULTI_PICK_SLACK = 0.2;      // a multi-select option is picked when the venue is within this of its target
const NO_TARGET_PICK_RATE = 0.3;
// ───────────── what is measured ─────────────
const UNSEEN_PER_USER = 30;
const NDCG_K = 10;
const NDCG_GAIN_FROM = 5;
const TOP_K = 10;
const WELL_MEASURED = 10;          // respondents
const N_GROUPS = 100;
const GROUP_MIN = 2, GROUP_MAX = 5;
const GROUP_CANDIDATES = 40;
const PLAN_STOPS = 3;
const MAX_RATERS = 50;             // MAX_RATERS_PER_ITEM in discovery.ts
// Copied from convex/rankings.ts (People's file, which imports Convex): the score a list position gets.
const BUCKET_RANGE = { loved: [6.7, 10], fine: [3.4, 6.7], didnt: [0, 3.3] };
// Section 4.1, the affinity step (Data's recordPerformerAffinity): written out here because it has no pure version yet.
const AFFINITY_MIN_STEP = 0.3, SUPPORT_ACT_STEP = 0.5;

const { FEATURES } = recs;
const F = (name) => FEATURES.indexOf(name);
const vec = (set) => FEATURES.map((k) => set[k] ?? 0.15);
const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length);

const ARCHETYPES = [
  { name: "club kid", taste: vec({ energy: 0.9, loudness: 0.9, crowdAge: 0.85, price: 0.5, dancing: 0.95, liveMusic: 0.3, pop: 0.5, hiphop: 0.5, electronic: 0.9, food: 0.3 }) },
  { name: "dive-bar regular", taste: vec({ energy: 0.5, loudness: 0.55, crowdAge: 0.4, dancing: 0.2, liveMusic: 0.4, pop: 0.35, hiphop: 0.2, indie: 0.7, culture: 0.25, outdoors: 0.3, food: 0.45 }) },
  { name: "foodie", taste: vec({ energy: 0.35, loudness: 0.3, crowdAge: 0.4, price: 0.75, liveMusic: 0.2, pop: 0.2, indie: 0.25, culture: 0.5, outdoors: 0.35, food: 0.95 }) },
  { name: "culture and outdoors", taste: vec({ energy: 0.3, crowdAge: 0.35, price: 0.35, liveMusic: 0.3, indie: 0.35, culture: 0.9, outdoors: 0.9, food: 0.5 }) },
  { name: "live-music fan", taste: vec({ energy: 0.75, loudness: 0.8, crowdAge: 0.55, price: 0.4, dancing: 0.5, liveMusic: 0.95, pop: 0.5, hiphop: 0.35, electronic: 0.3, indie: 0.8, culture: 0.35, outdoors: 0.2, food: 0.3 }) },
];

/** Venue types per category, with how many of the 300 each category gets. Live and pop-up (60) are the events. */
const VENUE_TYPES = {
  nightlife: { count: 90, types: [
    { energy: 0.92, loudness: 0.92, crowdAge: 0.8, price: 0.6, dancing: 0.92, pop: 0.3, hiphop: 0.35, electronic: 0.9 },
    { energy: 0.85, loudness: 0.85, crowdAge: 0.8, price: 0.5, dancing: 0.85, pop: 0.5, hiphop: 0.9 },
    { energy: 0.7, loudness: 0.7, crowdAge: 0.7, price: 0.4, dancing: 0.6, pop: 0.9 },
    { energy: 0.5, loudness: 0.55, crowdAge: 0.4, price: 0.2, pop: 0.35, indie: 0.5 },
    { energy: 0.45, loudness: 0.4, crowdAge: 0.5, price: 0.7, food: 0.3 },
    { energy: 0.28, loudness: 0.22, crowdAge: 0.35, price: 0.7, culture: 0.3, food: 0.5 },
    { energy: 0.75, loudness: 0.8, crowdAge: 0.55, price: 0.25, dancing: 0.35, liveMusic: 0.9, indie: 0.9 },
  ] },
  food: { count: 75, types: [
    { energy: 0.35, loudness: 0.3, crowdAge: 0.35, price: 0.9, food: 0.95 },
    { energy: 0.45, loudness: 0.45, crowdAge: 0.5, price: 0.3, food: 0.9 },
    { energy: 0.35, loudness: 0.3, crowdAge: 0.55, food: 0.8 },
    { energy: 0.55, loudness: 0.55, crowdAge: 0.6, price: 0.45, outdoors: 0.35, food: 0.85 },
  ] },
  culture: { count: 40, types: [
    { energy: 0.25, crowdAge: 0.4, price: 0.3, culture: 0.95 },
    { energy: 0.25, crowdAge: 0.5, price: 0.1, indie: 0.4, culture: 0.9 },
    { energy: 0.4, loudness: 0.3, crowdAge: 0.35, price: 0.5, liveMusic: 0.4, culture: 0.85 },
  ] },
  outdoors: { count: 35, types: [
    { energy: 0.3, crowdAge: 0.45, price: 0.05, outdoors: 0.95 },
    { energy: 0.8, crowdAge: 0.5, price: 0.05, outdoors: 0.95 },
    { energy: 0.45, crowdAge: 0.5, price: 0.1, outdoors: 0.9, food: 0.3 },
  ] },
  live: { count: 35, types: [
    { energy: 0.9, loudness: 0.9, crowdAge: 0.6, price: 0.85, dancing: 0.45, liveMusic: 0.9, pop: 0.85, hiphop: 0.5 },
    { energy: 0.8, loudness: 0.85, crowdAge: 0.6, price: 0.3, dancing: 0.4, liveMusic: 0.95, indie: 0.95 },
    { energy: 0.9, loudness: 0.9, crowdAge: 0.8, price: 0.5, dancing: 0.9, liveMusic: 0.5, electronic: 0.95 },
    { energy: 0.45, loudness: 0.45, crowdAge: 0.3, price: 0.5, liveMusic: 0.9, culture: 0.5 },
  ] },
  popup: { count: 25, types: [
    { energy: 0.65, loudness: 0.5, crowdAge: 0.65, price: 0.3, culture: 0.5, outdoors: 0.5, food: 0.8 },
    { energy: 0.8, loudness: 0.7, crowdAge: 0.75, price: 0.2, dancing: 0.8, electronic: 0.85, outdoors: 0.8 },
    { energy: 0.5, loudness: 0.4, crowdAge: 0.6, price: 0.3, indie: 0.5, culture: 0.85 },
  ] },
};
const EVENT_CATEGORIES = ["live", "popup"];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One stream per purpose, keyed by name: a draw never depends on how many draws another part made, so
 * changing a constant in the scorer changes the scores and nothing else about the world.
 */
function streams(seed) {
  const stream = (...key) => {
    const next = mulberry32(insights.hashString(`${seed}:${key.join(":")}`));
    const gauss = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
    return {
      next, gauss,
      int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
      pick: (xs) => xs[Math.floor(next() * xs.length)],
      shuffle: (xs) => {
        const out = [...xs];
        for (let i = out.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
      },
      noisy: (v, sd) => v.map((x) => recs.clip(x + sd * gauss(), 0, 1)),
    };
  };
  return stream;
}

/**
 * The onboarding quiz as the app scores it: on each card the person picks the option (or, on the two
 * multi-select cards, the set of options) that brings quizToVector() closest to how they see themselves.
 * That is the best answer the quiz can express, so a careful quiz-taker is an optimist's case. With
 * `careless` (a random stream) about half the cards are answered at random instead.
 */
function takeQuiz(selfImage, careless = null) {
  const distance = (answers) => recs.quizToVector(answers).reduce((s, x, k) => s + Math.abs(x - selfImage[k]), 0);
  const answers = recs.QUIZ_TABLE.map(() => []);
  const random = new Set();
  if (careless !== null) {
    recs.QUIZ_TABLE.forEach((card, c) => {
      if (careless.next() >= CARELESS_CARD_RATE) return;
      random.add(c);
      const options = careless.shuffle(card.map((_, o) => o));
      answers[c] = options.slice(0, QUIZ_MULTI_CARDS.includes(c) ? careless.int(1, 2) : 1);
    });
  }
  for (let pass = 0; pass < 2; pass++) {
    recs.QUIZ_TABLE.forEach((card, c) => {
      if (random.has(c)) return;
      const multi = QUIZ_MULTI_CARDS.includes(c);
      const choices = multi
        ? Array.from({ length: 2 ** card.length }, (_, mask) => card.map((_, o) => o).filter((o) => mask & (1 << o)))
        : card.map((_, o) => [o]);
      let best = answers[c], bestDistance = Infinity;
      for (const choice of choices) {
        answers[c] = choice;
        const d = distance(answers);
        if (d < bestDistance) { best = choice; bestDistance = d; }
      }
      answers[c] = best;
    });
  }
  return recs.quizToVector(answers);
}

function buildWorld(seed) {
  const stream = streams(seed);

  const users = Array.from({ length: N_USERS }, (_, u) => {
    const rng = stream("user", u);
    const archetype = u % ARCHETYPES.length;
    const taste = rng.noisy(ARCHETYPES[archetype].taste, TASTE_NOISE);
    const selfImage = rng.noisy(taste, QUIZ_NOISE);
    const how = stream("quiz", u).next();
    const quizKind = how < QUIZ_SKIPPED_SHARE ? "skipped" : how < QUIZ_SKIPPED_SHARE + QUIZ_CARELESS_SHARE ? "careless" : "careful";
    const quiz = quizKind === "skipped"
      ? [...recs.NEUTRAL_TASTE]
      : takeQuiz(selfImage, quizKind === "careless" ? stream("careless", u) : null);
    // Favourites carry a bonus of their own size. Follows are a noisy copy of them: about half of the
    // favourites, plus a few performers the user does not enjoy any more than anyone else.
    const acts = rng.shuffle(Array.from({ length: N_PERFORMERS }, (_, p) => p));
    const favourites = new Map(acts.slice(0, FAVOURITES_PER_USER)
      .map((p) => [p, FAVOURITE_BONUS_MIN + (FAVOURITE_BONUS_MAX - FAVOURITE_BONUS_MIN) * rng.next()]));
    const follows = new Set([...favourites.keys()].filter(() => rng.next() < FOLLOW_RATE));
    for (const p of acts.slice(FAVOURITES_PER_USER, FAVOURITES_PER_USER + rng.int(0, OTHER_FOLLOWS_MAX))) follows.add(p);
    return { u, archetype, taste, quiz, quizKind, local: rng.next() < LOCAL_SHARE, favourites, follows, friends: new Set() };
  });
  const friendRng = stream("friends");
  for (const user of users) {
    for (let k = 0; k < FRIENDS_PER_USER / 2; k++) {
      const same = friendRng.next() < FRIEND_SAME_ARCHETYPE;
      const pool = users.filter((v) => v.u !== user.u && (v.archetype === user.archetype) === same);
      const other = friendRng.pick(pool);
      user.friends.add(other.u);
      other.friends.add(user.u);
    }
  }

  const venues = [];
  for (const [category, { count, types }] of Object.entries(VENUE_TYPES)) {
    for (let n = 0; n < count; n++) {
      const i = venues.length;
      const rng = stream("venue", i);
      const truth = rng.noisy(vec(types[n % types.length]), VENUE_NOISE);
      const isEvent = EVENT_CATEGORIES.includes(category);
      const performers = isEvent
        ? stream("bill", i).shuffle(Array.from({ length: N_PERFORMERS }, (_, p) => p)).slice(0, rng.int(1, 2))
        : [];
      venues.push({
        i, category, truth, guess: rng.noisy(truth, FEATURIZER_NOISE), quality: QUALITY_SD * rng.gauss(),
        popularity: Math.exp(POPULARITY_SD * rng.gauss()), performers,
      });
    }
  }
  assert.equal(venues.length, N_VENUES);

  /** True enjoyment y of every user at every venue, including the one night's noise. */
  const enjoy = users.map((user) => {
    const rng = stream("enjoy", user.u);
    return venues.map((venue) =>
      recs.contentScore(user.taste, venue.truth) + venue.quality + ENJOY_NOISE * rng.gauss()
      + Math.max(0, ...venue.performers.map((p) => user.favourites.get(p) ?? 0)));
  });

  // Who went where: popular venues more often. A fifth of each user's venues is held out before training.
  for (const user of users) {
    const rng = stream("visits", user.u);
    const wanted = rng.int(RANKED_MIN, RANKED_MAX);
    const keyed = venues.map((venue) => ({ i: venue.i, key: -Math.log(1 - rng.next()) / venue.popularity }));
    const visited = rng.shuffle(keyed.sort((a, b) => a.key - b.key).slice(0, wanted).map((x) => x.i));
    const nHeld = Math.max(2, Math.round(HELD_OUT_SHARE * wanted));
    user.heldOut = visited.slice(0, nHeld);
    user.train = visited.slice(nHeld);
    const seen = new Set(visited);
    user.unseen = rng.shuffle(venues.filter((venue) => !seen.has(venue.i)).map((venue) => venue.i)).slice(0, UNSEEN_PER_USER);
  }
  const timeline = stream("timeline").shuffle(users.flatMap((user) => user.train.map((i) => ({ u: user.u, i }))));
  return { seed, stream, users, venues, enjoy, timeline };
}

const bucketOf = (y) => (y >= LOVED_FROM ? "loved" : y <= DIDNT_UNTIL ? "didnt" : "fine");
const bucketScore = (bucket, position, count) => {
  const [low, high] = BUCKET_RANGE[bucket];
  return Math.round((high - ((position - 0.5) * (high - low)) / count) * 10) / 10;
};

/**
 * One person's answers: for each question asked, the options closest to how the venue seemed to them. The
 * options and what they say about a venue are the ones this category has ("Date night" means a quiet room
 * for a bar and nothing for a restaurant).
 */
function answersFor(category, questions, perceived, y, key) {
  const coin = (...parts) => insights.hashString(`${key}:${parts.join(":")}`) / 2 ** 32;
  const bank = insights.questionsForCategory(category);
  const answers = [];
  for (const asked of questions) {
    const q = bank.find((b) => b.id === asked.id);
    const options = q.options.filter((o) => asked.options.some((a) => a.id === o.id));
    const distance = (o) => mean(Object.entries(o.targets).map(([feature, target]) => Math.abs(perceived[F(feature)] - target)));
    if (q.id === "return") {
      answers.push({ questionId: q.id, optionIds: [y >= LOVED_FROM ? "definitely" : y <= DIDNT_UNTIL ? "no" : "maybe"] });
    } else if (!insights.feedsFeatures(q)) {
      answers.push({ questionId: q.id, optionIds: [options[Math.floor(coin(q.id) * options.length)].id] });
    } else if (!q.multi) {
      const best = options.filter((o) => o.targets).sort((a, b) => distance(a) - distance(b))[0];
      answers.push({ questionId: q.id, optionIds: [best.id] });
    } else {
      // Per feature, the one option that describes it best, when the venue really is like that. Options that
      // describe two features at once (Latin, "No real music") have no hidden truth in this world.
      const byFeature = new Map();
      const picked = [];
      for (const o of options) {
        const targets = Object.entries(o.targets ?? {});
        if (targets.length === 0 && coin(q.id, o.id) < NO_TARGET_PICK_RATE) picked.push(o.id);
        if (targets.length !== 1) continue;
        const [feature, target] = targets[0];
        const seems = perceived[F(feature)];
        const fits = target >= 0.5 ? seems >= target - MULTI_PICK_SLACK : seems <= target + MULTI_PICK_SLACK;
        const best = byFeature.get(feature);
        if (fits && (best === undefined || Math.abs(seems - target) < best.gap)) byFeature.set(feature, { id: o.id, gap: Math.abs(seems - target) });
      }
      for (const { id } of byFeature.values()) picked.push(id);
      if (picked.length === 0 && options.some((o) => o.id === "none")) picked.push("none");
      if (picked.length > 0) answers.push({ questionId: q.id, optionIds: picked });
    }
  }
  return answers;
}

/** Runs every training ranking through the real update functions, in time order. */
function train(world) {
  const { stream, users, venues, enjoy, timeline } = world;
  const state = {
    tasteGuess: users.map((user) => [...user.quiz]),    // learned from the featurizer's vectors (v3)
    tasteBlend: users.map((user) => [...user.quiz]),    // learned from the measured vectors (v4)
    blend: venues.map((venue) => venue.guess),          // what venueVectorOf() returns once answers arrive
    elo: venues.map(() => 0),
    nComparisons: venues.map(() => 0),
    counts: venues.map(() => ({})),
    localCounts: venues.map(() => ({})),
    respondents: venues.map(() => 0),
    measured: venues.map(() => FEATURES.map(() => 0)),
    lists: users.map(() => new Map()),                  // "category:bucket" -> venue ids, best first
    affinity: users.map(() => new Map()),               // performer -> { score, n }
    raters: venues.map(() => []),                       // user ids who ranked it
    ownScore: users.map(() => new Map()),
    comparisons: 0, answers: 0,
  };
  for (const { u, i } of timeline) {
    const user = users[u], venue = venues[i], y = enjoy[u][i];
    const bucket = bucketOf(y);
    const key = `${venue.category}:${bucket}`;
    const list = state.lists[u].get(key) ?? [];
    // rankings.rank: binary insertion against the user's own list, each step one comparison in the same category.
    let lo = 0, hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const other = list[mid];
      const won = y > enjoy[u][other];
      const [w, l] = won ? [i, other] : [other, i];
      state.tasteGuess[u] = recs.updateTaste(state.tasteGuess[u], user.quiz, venues[w].guess, venues[l].guess);
      state.tasteBlend[u] = recs.updateTaste(state.tasteBlend[u], user.quiz, state.blend[w], state.blend[l]);
      [state.elo[w], state.elo[l]] = recs.updateElo(state.elo[w], state.elo[l], state.nComparisons[w], state.nComparisons[l]);
      state.nComparisons[w] += 1;
      state.nComparisons[l] += 1;
      state.comparisons += 1;
      if (won) hi = mid; else lo = mid + 1;
    }
    list.splice(lo, 0, i);
    state.lists[u].set(key, list);
    // scoring.applyBucket: someone who skipped the quiz has a neutral prior and takes the bigger step.
    const lovedStep = recs.lovedStepFor(user.quiz);
    state.tasteGuess[u] = recs.nudgeTaste(state.tasteGuess[u], venue.guess, bucket, lovedStep);
    state.tasteBlend[u] = recs.nudgeTaste(state.tasteBlend[u], state.blend[i], bucket, lovedStep);
    state.raters[i].push(u);

    // The affinity step for every performer on the bill, from the score the ranking has right now.
    const score = bucketScore(bucket, lo + 1, list.length);
    venue.performers.forEach((p, k) => {
      const row = state.affinity[u].get(p) ?? { score: recs.AFFINITY_NEUTRAL, n: 0 };
      const eta = Math.max(AFFINITY_MIN_STEP, 1 / (1 + row.n)) * (k === 0 ? 1 : SUPPORT_ACT_STEP);
      state.affinity[u].set(p, { score: row.score + eta * (score - row.score), n: row.n + 1 });
    });

    // insights.submit, after 40% of rankings.
    const rng = stream("answers", u, i);
    if (rng.next() >= ANSWER_RATE) continue;
    const questions = insights.pickQuestions(venue.category, state.counts[i], { seed: `user${u}` });
    const given = answersFor(venue.category, questions, rng.noisy(venue.truth, ANSWER_NOISE), y, `${world.seed}:${u}:${i}`);
    const answers = insights.cleanAnswers(venue.category, given);
    if (answers.length === 0) continue;
    state.counts[i] = insights.addAnswers(state.counts[i], answers);
    if (user.local) state.localCounts[i] = insights.addAnswers(state.localCounts[i], answers);
    // As insights.submit does: only questions at least MIN_SHOW people answered here feed the vector.
    const observed = insights.measuredVector(venue.category, state.counts[i], state.localCounts[i]);
    state.blend[i] = insights.hasObservations(observed.weight) ? insights.blendVector(venue.guess, observed.vector, observed.weight) : venue.guess;
    state.measured[i] = observed.weight;
    state.respondents[i] += 1;
    state.answers += answers.length;
  }
  // The score a ranking ends up with depends on the final length of its list.
  users.forEach((_, u) => {
    for (const [key, list] of state.lists[u]) {
      const bucket = key.split(":")[1];
      list.forEach((i, index) => state.ownScore[u].set(i, recs.clip(bucketScore(bucket, index + 1, list.length), 1, 10)));
    }
  });
  return state;
}

/**
 * The models being compared. `vectors` and `taste` say which world the model lives in: the featurizer's
 * guesses (v3) or the vectors measured from answers (v4). v3's quality term is the uncapped gamma * elo.
 */
const MODELS = {
  "content only (quiz taste)": { content: true },
  "content only (learned taste)": { content: "learned" },
  "v3": { measured: false, capElo: false, performer: false },
  "v4": { measured: true, capElo: true, performer: true },
  "v4, no measured vectors": { measured: false, capElo: true, performer: true },
  "v4, no performer term": { measured: true, capElo: true, performer: false },
  "v4, follows only": { measured: true, capElo: true, performer: true, learned: false },
  "v4, learned affinity only": { measured: true, capElo: true, performer: true, follows: false },
  "v4, no cap on quality": { measured: true, capElo: false, performer: true },
  "v4, no crowd": { measured: true, capElo: true, performer: true, crowd: false },
  "v4, no quality term": { measured: true, capElo: true, performer: true, elo: false },
};

function scorer(world, state, model) {
  const { users, venues } = world;
  if (model.content === "learned") return (u, i) => recs.contentScore(state.tasteBlend[u], state.blend[i]);
  if (model.content) return (u, i) => recs.contentScore(users[u].quiz, venues[i].guess);
  const taste = model.measured ? state.tasteBlend : state.tasteGuess;
  return (u, i) => {
    const user = users[u], venue = venues[i];
    const raters = model.crowd === false ? [] : state.raters[i].filter((v) => v !== u).slice(0, MAX_RATERS).map((v) => ({
      taste: taste[v], score: state.ownScore[v].get(i), local: users[v].local, friend: user.friends.has(v), name: `user${v}`,
    }));
    const known = !model.performer ? [] : venue.performers.flatMap((p) => {
      const row = model.learned === false ? undefined : state.affinity[u].get(p);
      const following = model.follows !== false && user.follows.has(p);
      if (row === undefined && !following) return [];
      return [{ name: `performer${p}`, score: row?.score ?? recs.AFFINITY_NEUTRAL, following, nRankings: row?.n ?? 0 }];
    });
    const elo = model.elo === false ? 0 : state.elo[i];
    const p = recs.predict(taste[u], model.measured ? state.blend[i] : venue.guess, elo, raters, user.local, { performer: recs.performerAffinity(known).term });
    return model.capElo ? p.score : recs.clip(p.base + recs.GAMMA_ELO * elo + p.performer, 1, 10);
  };
}

const QUIZ_KINDS = ["careful", "careless", "skipped"];

function evaluate(world, state, model, { explore = false } = {}) {
  const { users, venues, enjoy } = world;
  const score = scorer(world, state, model);
  const blank = () => ({ pairs: 0, pairsRight: 0, widePairs: 0, wideRight: 0, ndcgSum: 0, ndcgUsers: 0, favEvents: 0, favInTop: 0 });
  const everyone = blank();
  const byQuiz = Object.fromEntries(QUIZ_KINDS.map((kind) => [kind, blank()]));
  const agree = (dp, dy) => (dp === 0 ? 0.5 : dp > 0 === dy > 0 ? 1 : 0);
  for (const user of users) {
    const u = user.u;
    const mine = blank();
    const pool = [...user.heldOut, ...user.unseen].map((i) => {
      const predicted = score(u, i);
      // Exploration changes the order only, never the predicted score (section 8).
      const order = explore ? predicted + recs.exploreBonus(state.raters[i].length + state.nComparisons[i]) : predicted;
      return { i, predicted: order, y: enjoy[u][i], held: user.heldOut.includes(i) };
    });
    for (let a = 0; a < pool.length; a++) {
      for (let b = a + 1; b < pool.length; b++) {
        const right = agree(pool[a].predicted - pool[b].predicted, pool[a].y - pool[b].y);
        mine.widePairs += 1; mine.wideRight += right;
        if (pool[a].held && pool[b].held) { mine.pairs += 1; mine.pairsRight += right; }
      }
    }
    const gain = (x) => Math.max(0, x.y - NDCG_GAIN_FROM);
    const dcg = (xs) => xs.slice(0, NDCG_K).reduce((s, x, rank) => s + gain(x) / Math.log2(rank + 2), 0);
    const ranked = [...pool].sort((a, b) => b.predicted - a.predicted || a.i - b.i);
    const ideal = dcg([...pool].sort((a, b) => b.y - a.y));
    if (ideal > 0) { mine.ndcgSum += dcg(ranked) / ideal; mine.ndcgUsers += 1; }
    ranked.forEach((x, rank) => {
      if (!venues[x.i].performers.some((p) => user.favourites.has(p))) return;
      mine.favEvents += 1;
      if (rank < TOP_K) mine.favInTop += 1;
    });
    for (const tally of [everyone, byQuiz[user.quizKind]]) for (const key of Object.keys(mine)) tally[key] += mine[key];
  }
  const fold = (t) => ({
    pairwise: t.pairsRight / t.pairs, pairs: t.pairs, widePairwise: t.wideRight / t.widePairs, widePairs: t.widePairs,
    ndcg: t.ndcgSum / t.ndcgUsers, favTop: t.favInTop / t.favEvents, favEvents: t.favEvents, users: t.ndcgUsers,
  });
  return { ...fold(everyone), byQuiz: Object.fromEntries(QUIZ_KINDS.map((kind) => [kind, fold(byQuiz[kind])])) };
}

function vectorErrors(world, state) {
  const { venues } = world;
  const err = (rows) => mean(rows.map(([a, b]) => Math.abs(a - b)));
  const cells = (pickVenue, pickFeature, source) => venues.flatMap((venue) => (pickVenue(venue.i)
    ? FEATURES.flatMap((_, k) => (pickFeature(venue.i, k) ? [[source(venue)[k], venue.truth[k]]] : []))
    : []));
  const all = () => true;
  const well = (i) => state.respondents[i] >= WELL_MEASURED;
  // `measured` holds the weights insights.measuredVector kept: only questions MIN_SHOW people answered at the venue.
  const hasAnswers = (i, k) => state.measured[i][k] > 0;
  const fiveAnswers = (i, k) => state.measured[i][k] >= insights.INSIGHT_N0;
  const guess = (venue) => venue.guess, blend = (venue) => state.blend[venue.i];
  return {
    allGuess: err(cells(all, all, guess)), allBlend: err(cells(all, all, blend)),
    wellVenues: venues.filter((venue) => well(venue.i)).length,
    wellGuess: err(cells(well, all, guess)), wellBlend: err(cells(well, all, blend)),
    wellAskedGuess: err(cells(well, hasAnswers, guess)), wellAskedBlend: err(cells(well, hasAnswers, blend)),
    fiveCells: cells(all, fiveAnswers, guess).length,
    fiveGuess: err(cells(all, fiveAnswers, guess)), fiveBlend: err(cells(all, fiveAnswers, blend)),
  };
}

/** 100 random groups pick one place, then a three-stop night, by each rule; satisfaction is the members' true enjoyment. */
function groups(world, state) {
  const { stream, users, venues, enjoy } = world;
  const predicted = scorer(world, state, MODELS.v4);
  const rules = {
    "average only": (scores) => mean(scores),
    "least misery only": (scores) => Math.min(...scores),
    "old groupScore (v3)": (scores) => recs.groupScore(scores),
    "groupScoreV2 (v4)": (scores) => group.groupScoreV2(scores)?.score ?? null,
  };
  const single = Object.fromEntries(Object.keys(rules).map((name) => [name, { mean: [], min: [] }]));
  const night = { "three stops, equal say": { mean: [], min: [] }, "three stops, fairWeights": { mean: [], min: [] } };
  for (let g = 0; g < N_GROUPS; g++) {
    const rng = stream("group", g);
    const members = rng.shuffle(users.map((user) => user.u)).slice(0, rng.int(GROUP_MIN, GROUP_MAX));
    const options = rng.shuffle(venues.map((venue) => venue.i)).slice(0, GROUP_CANDIDATES).map((i) => ({
      i, scores: members.map((u) => state.ownScore[u].get(i) ?? predicted(u, i)), truth: members.map((u) => enjoy[u][i]),
    }));
    const best = (value) => {
      let top = null, topValue = -Infinity;
      for (const o of options) {
        const x = value(o);
        if (x !== null && x > topValue) { top = o; topValue = x; }
      }
      return top;
    };
    for (const [name, rule] of Object.entries(rules)) {
      let pick = best((o) => rule(o.scores));
      pick ??= best((o) => mean(o.scores));   // everything vetoed: fall back to the average
      single[name].mean.push(mean(pick.truth));
      single[name].min.push(Math.min(...pick.truth));
    }
    for (const [name, fair] of [["three stops, equal say", false], ["three stops, fairWeights", true]]) {
      const chosen = [];
      for (let stop = 0; stop < PLAN_STOPS; stop++) {
        const weights = fair ? group.fairWeights(chosen.map((o) => o.scores)) : [];
        const free = (o) => !chosen.includes(o);
        const pick = best((o) => (free(o) ? group.groupScoreV2(o.scores, { weights })?.score ?? null : null))
          ?? best((o) => (free(o) ? mean(o.scores) : null));
        chosen.push(pick);
      }
      const perMember = members.map((_, m) => mean(chosen.map((o) => o.truth[m])));
      night[name].mean.push(mean(perMember));
      night[name].min.push(Math.min(...perMember));
    }
  }
  const fold = (table) => Object.fromEntries(Object.entries(table).map(([name, r]) => [name, { mean: mean(r.mean), min: mean(r.min) }]));
  return { single: fold(single), night: fold(night) };
}

function simulate(seed) {
  const world = buildWorld(seed);
  const state = train(world);
  const models = Object.fromEntries(Object.entries(MODELS).map(([name, model]) => [name, evaluate(world, state, model)]));
  models["v4 + exploration in the order"] = evaluate(world, state, MODELS.v4, { explore: true });
  return {
    models,
    vectors: vectorErrors(world, state),
    groups: groups(world, state),
    counts: {
      rankings: world.timeline.length,
      heldOut: world.users.reduce((s, user) => s + user.heldOut.length, 0),
      comparisons: state.comparisons,
      respondents: state.respondents.reduce((s, x) => s + x, 0),
      answers: state.answers,
      venuesWithAnswers: state.respondents.filter((x) => x > 0).length,
    },
  };
}

/** The mean of every number in a list of same-shaped results. */
function averaged(results) {
  const first = results[0];
  if (typeof first === "number") return mean(results);
  return Object.fromEntries(Object.keys(first).map((key) => [key, averaged(results.map((r) => r[key]))]));
}

const RUNS = Array.from({ length: WORLDS }, (_, k) => simulate(SEED + k));
const R = averaged(RUNS);
const ELAPSED_MS = performance.now() - STARTED;

const QUIZ = "content only (quiz taste)";
const LEARNED = "content only (learned taste)";
const ABLATIONS = Object.keys(MODELS).filter((name) => name.startsWith("v4, "));
const gap = (metric) => RUNS.map((run) => run.models.v4[metric] - run.models.v3[metric]);
const exploreCost = R.models.v4.ndcg - R.models["v4 + exploration in the order"].ndcg;
const worstAblation = Math.max(...ABLATIONS.map((name) => R.models[name].widePairwise - R.models.v4.widePairwise));

/** The targets docs/ALGORITHM.md section 9 set before any number existed. Reported as they are, met or not. */
const TARGETS = [
  ["v4 pairwise accuracy >= v3 + 0.03", R.models.v4.pairwise - R.models.v3.pairwise >= 0.03],
  ["v4 NDCG@10 >= v3 + 0.02", R.models.v4.ndcg - R.models.v3.ndcg >= 0.02],
  ["vector error at most half the featurizer's, venues with 10+ respondents, on the features measured there",
    R.vectors.wellAskedBlend <= R.vectors.wellAskedGuess / 2],
  ["a favourite performer's event in the top 10 twice as often as v3", R.models.v4.favTop >= 2 * R.models.v3.favTop],
  ["group minimum >= average-only + 0.5 with the mean down by <= 0.2",
    R.groups.single["groupScoreV2 (v4)"].min >= R.groups.single["average only"].min + 0.5
    && R.groups.single["average only"].mean - R.groups.single["groupScoreV2 (v4)"].mean <= 0.2],
  ["no term raises pairwise* by more than 0.005 when switched off", worstAblation <= 0.005],
  ["exploration costs under 0.01 NDCG@10", exploreCost < 0.01],
];

const f3 = (x) => x.toFixed(3);
const f2 = (x) => x.toFixed(2);
const pad = (s, n) => String(s).padEnd(n);
const signed = (x) => (x >= 0 ? "+" : "") + x.toFixed(3);
const range = (xs) => `${signed(Math.min(...xs))} to ${signed(Math.max(...xs))}`;

function report() {
  const { models, vectors, groups: g, counts } = R;
  const v3 = models.v3, v4 = models.v4;
  const lines = [
    "",
    `clubi simulator: ${WORLDS} worlds (seeds ${SEED} to ${SEED + WORLDS - 1}), averaged, ${Math.round(ELAPSED_MS)} ms. Per world: ${N_USERS} users, ${N_VENUES} venues, `
      + `${Math.round(counts.rankings)} training rankings (${Math.round(counts.heldOut)} held out), ${Math.round(counts.comparisons)} comparisons, `
      + `${Math.round(counts.respondents)} answer sets (${Math.round(counts.answers)} answers) on ${Math.round(counts.venuesWithAnswers)} venues`,
    "",
    `${pad("model", 32)}${pad("pairwise", 10)}${pad("pairwise*", 11)}${pad("NDCG@10", 9)}fav. event in top 10`,
    ...Object.entries(models).map(([name, m]) =>
      `${pad(name, 32)}${pad(f3(m.pairwise), 10)}${pad(f3(m.widePairwise), 11)}${pad(f3(m.ndcg), 9)}${f3(m.favTop)}`),
    `  pairwise  = held-out pairs of the same user (${Math.round(v4.pairs)} pairs per world)`,
    `  pairwise* = every pair among a user's held-out venues and ${UNSEEN_PER_USER} never-seen ones (${Math.round(v4.widePairs)} pairs per world)`,
    `  v4 - v3: pairwise ${signed(v4.pairwise - v3.pairwise)} (per world ${range(gap("pairwise"))}), `
      + `pairwise* ${signed(v4.widePairwise - v3.widePairwise)} (${range(gap("widePairwise"))}), NDCG@10 ${signed(v4.ndcg - v3.ndcg)} (${range(gap("ndcg"))})`,
    `  favourite performers' events in the top 10: x${f2(v4.favTop / v3.favTop)} (${Math.round(v4.favEvents)} cases per world); `
      + `exploration costs ${f3(exploreCost)} NDCG@10`,
    "",
    `${pad("by how the quiz was taken", 28)}${pad("users", 7)}${pad("quiz alone", 16)}${pad("learned taste", 16)}${pad("v3", 16)}v4          (pairwise* / NDCG@10)`,
    ...QUIZ_KINDS.map((kind) => {
      const cell = (name) => pad(`${f3(models[name].byQuiz[kind].widePairwise)} / ${f3(models[name].byQuiz[kind].ndcg)}`, 16);
      return `${pad(kind, 28)}${pad(Math.round(v4.byQuiz[kind].users), 7)}${cell(QUIZ)}${cell(LEARNED)}${cell("v3")}${cell("v4")}`;
    }),
    "  quiz alone / learned taste = the content score only, from the quiz vector or from the taste after training",
    "",
    `${pad("venue vector error (mean abs.)", 60)}${pad("featurizer", 12)}measured blend`,
    `${pad("all venues, all 13 features", 60)}${pad(f3(vectors.allGuess), 12)}${f3(vectors.allBlend)}`,
    `${pad(`venues with ${WELL_MEASURED}+ respondents (${vectors.wellVenues.toFixed(1)} per world), all features`, 60)}${pad(f3(vectors.wellGuess), 12)}${f3(vectors.wellBlend)}`,
    `${pad("  the features measured there (a question 5+ answered)", 60)}${pad(f3(vectors.wellAskedGuess), 12)}${f3(vectors.wellAskedBlend)}`,
    `${pad(`measured features with ${insights.INSIGHT_N0}+ answers' weight (${Math.round(vectors.fiveCells)} per world)`, 60)}${pad(f3(vectors.fiveGuess), 12)}${f3(vectors.fiveBlend)}`,
    "",
    `${pad(`group pick, ${N_GROUPS} groups of ${GROUP_MIN}-${GROUP_MAX} per world`, 42)}${pad("mean", 8)}minimum`,
    ...Object.entries(g.single).map(([name, r]) => `${pad(name, 42)}${pad(f2(r.mean), 8)}${f2(r.min)}`),
    ...Object.entries(g.night).map(([name, r]) => `${pad(name, 42)}${pad(f2(r.mean), 8)}${f2(r.min)}`),
    "  mean / minimum = the members' true enjoyment of the pick (for three stops: of their average over the night)",
    "",
    "section 9 targets",
    ...TARGETS.map(([text, met]) => `  ${met ? "met    " : "NOT met"}  ${text}`),
    "",
  ];
  return lines.join("\n");
}
console.log(report());

test("the simulator runs in under 5 seconds and is the same world for the same seed", () => {
  assert.ok(ELAPSED_MS < 5000, `${ELAPSED_MS} ms`);
  const a = buildWorld(SEED), b = buildWorld(SEED);
  assert.deepEqual(a.timeline, b.timeline);
  assert.deepEqual(a.venues[17].guess, b.venues[17].guess);
  assert.notDeepEqual(a.timeline, buildWorld(SEED + 1).timeline);
  assert.equal(a.venues.filter((venue) => venue.performers.length > 0).length, 60);
  assert.ok(a.users.every((user) => user.heldOut.length >= 2 && user.train.length >= 6 && user.unseen.length === UNSEEN_PER_USER));
  assert.ok(a.users.every((user) => user.quiz.length === FEATURES.length && user.quiz.every((x) => x >= 0 && x <= 1)));
  // Follows are a noisy copy of the favourites: some favourites are not followed, some follows are not favourites.
  const followed = a.users.flatMap((user) => [...user.follows].map((p) => user.favourites.has(p)));
  assert.ok(followed.some((x) => x) && followed.some((x) => !x));
  assert.ok(a.users.some((user) => [...user.favourites.keys()].some((p) => !user.follows.has(p))));
  assert.ok(QUIZ_KINDS.every((kind) => a.users.some((user) => user.quizKind === kind)));
  assert.ok(a.users.filter((user) => user.quizKind === "skipped").every((user) => recs.isNeutralTaste(user.quiz)));
  assert.deepEqual(simulate(SEED), RUNS[0]);
});

test("v4 is at least as good as v3 on held-out pairwise accuracy and NDCG@10", () => {
  const { v3, v4 } = R.models;
  assert.ok(v4.pairwise >= v3.pairwise, `pairwise ${v4.pairwise} < ${v3.pairwise}`);
  assert.ok(v4.ndcg >= v3.ndcg, `NDCG@10 ${v4.ndcg} < ${v3.ndcg}`);
  // The wide pairwise set and NDCG@10 are large enough to hold in every world, not only on average.
  assert.ok(gap("widePairwise").every((d) => d > 0), range(gap("widePairwise")));
  assert.ok(gap("ndcg").every((d) => d > 0), range(gap("ndcg")));
});

test("v4 ranks better than the quiz alone", () => {
  const quiz = R.models[QUIZ], { v3, v4 } = R.models;
  assert.ok(v4.pairwise > quiz.pairwise && v4.widePairwise > quiz.widePairwise && v4.ndcg > quiz.ndcg);
  // v3 orders pairs better than the quiz too; its NDCG@10 is not asserted because it is no better (see the table).
  assert.ok(v3.pairwise > quiz.pairwise && v3.widePairwise > quiz.widePairwise);
});

test("no single term of v4 makes the ranking clearly worse", () => {
  for (const name of ABLATIONS) {
    const without = R.models[name];
    assert.ok(without.widePairwise - R.models.v4.widePairwise <= 0.005, `${name}: pairwise* ${without.widePairwise}`);
  }
  // Measured vectors are not asserted to help the ranking: with the 5-respondent rule only about 70
  // features per world are measured at all, and the two rows differ by less than 0.001.
  assert.ok(Math.abs(R.models["v4, no measured vectors"].widePairwise - R.models.v4.widePairwise) < 0.003);
  assert.ok(R.models["v4, no performer term"].ndcg < R.models.v4.ndcg);
  assert.ok(R.models["v4, no crowd"].widePairwise < R.models.v4.widePairwise);
});

test("the performer term: follows carry the gain, and a learned affinity alone does no harm", () => {
  const none = R.models["v4, no performer term"], follows = R.models["v4, follows only"], learned = R.models["v4, learned affinity only"];
  // Follows are a noisy copy of who the user really enjoys, and still most of what v4 adds.
  assert.ok(follows.ndcg > none.ndcg + 0.005, `follows only ${follows.ndcg} against ${none.ndcg}`);
  assert.ok(follows.favTop > 1.3 * none.favTop);
  // Affinities learned from rankings, shrunk by how many there are: never below having no performer term.
  assert.ok(learned.ndcg >= none.ndcg, `learned only NDCG@10 ${learned.ndcg} < ${none.ndcg}`);
  assert.ok(learned.widePairwise >= none.widePairwise, `learned only pairwise* ${learned.widePairwise} < ${none.widePairwise}`);
  assert.ok(learned.favTop > none.favTop);
});

test("v4 is at least as good as v3 with every follow switched off", () => {
  const { v3 } = R.models, learned = R.models["v4, learned affinity only"];
  assert.ok(learned.widePairwise >= v3.widePairwise, `pairwise* ${learned.widePairwise} < ${v3.widePairwise}`);
  assert.ok(learned.ndcg >= v3.ndcg, `NDCG@10 ${learned.ndcg} < ${v3.ndcg}`);
});

test("v4 beats the quiz alone for careful, careless and skipped quiz-takers alike", () => {
  for (const kind of QUIZ_KINDS) {
    const quiz = R.models[QUIZ].byQuiz[kind], v4 = R.models.v4.byQuiz[kind];
    assert.ok(v4.users >= 20, `${kind}: ${v4.users} users`);
    assert.ok(v4.widePairwise > quiz.widePairwise && v4.ndcg > quiz.ndcg, `${kind}: ${v4.widePairwise} / ${v4.ndcg}`);
  }
  // The weaker the quiz, the more there is to learn: the gain over the quiz grows from careful to skipped.
  const gain = (kind) => R.models.v4.byQuiz[kind].widePairwise - R.models[QUIZ].byQuiz[kind].widePairwise;
  assert.ok(gain("skipped") > gain("careless") && gain("careless") > gain("careful"));
  // Taste learning on its own: it beats a skipped or careless quiz, and not yet a careful one (section 9.4).
  const learned = (kind) => R.models[LEARNED].byQuiz[kind].widePairwise - R.models[QUIZ].byQuiz[kind].widePairwise;
  assert.ok(learned("skipped") > 0.02 && learned("careless") > 0, `${learned("skipped")} ${learned("careless")}`);
});

test("a favourite performer's event reaches the top 10 more often under v4", () => {
  assert.ok(R.models.v4.favTop > 1.3 * R.models.v3.favTop);
  assert.ok(R.models.v4.favTop > R.models["v4, no performer term"].favTop);
});

test("exploration changes the order at a cost under 0.01 NDCG@10", () => {
  assert.ok(exploreCost > 0 && exploreCost < 0.01, `${exploreCost}`);
});

test("answers make venue vectors more accurate, and halve the error on the features they measure", () => {
  const v = R.vectors;
  assert.ok(v.allBlend < v.allGuess);
  assert.ok(v.wellBlend < v.wellGuess);
  assert.ok(v.wellAskedBlend <= v.wellAskedGuess * 0.6);
  assert.ok(v.fiveBlend <= v.fiveGuess / 2);
});

test("groupScoreV2 keeps the least happy member happier than averaging does, for little of the mean", () => {
  const { single, night } = R.groups;
  assert.ok(single["groupScoreV2 (v4)"].min > single["average only"].min);
  assert.ok(single["average only"].mean - single["groupScoreV2 (v4)"].mean <= 0.2);
  // Against the old groupScore, and with fairness weights across stops, the difference is too small to assert a direction.
  assert.ok(Math.abs(single["groupScoreV2 (v4)"].min - single["old groupScore (v3)"].min) < 0.1);
  assert.ok(Math.abs(night["three stops, fairWeights"].min - night["three stops, equal say"].min) < 0.1);
});
