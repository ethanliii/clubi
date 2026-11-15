export const FEATURES = ["energy", "loudness", "crowdAge", "price", "dancing", "liveMusic",
  "pop", "hiphop", "electronic", "indie", "culture", "outdoors", "food"] as const;
export type Feature = (typeof FEATURES)[number];

export const TASTE_ETA = 0.25;
export const TASTE_KAPPA = 5;
export const TASTE_LAMBDA = 0.1;
export const ELO_K0 = 0.5;
export const ALPHA_LOCAL_VIEWER = 1;
export const ALPHA_VISITOR_VIEWER = 2;
export const BETA_FRIEND = 0.5;
export const PSEUDO_VOTES = 2;
export const GLOBAL_MEAN = 6;
export const GAMMA_ELO = 0.3;
export const CROWD_HALF_WEIGHT = 3;
export const DISTANCE_D0_METERS = 400;
export const DISTANCE_DELTA = 1;
export const TIME_TAU = 0.5;
export const GROUP_BETA = 0.5;
export const GROUP_VETO_SCORE = 4;
export const LOVED_STEP = 0.1;
export const DIDNT_STEP = 0.05;
export const QUIZ_BASELINE = 0.3;
export const FEATURE_BASELINE = 0.15;
export const UNKNOWN_SIMILARITY = 0.5;
export const MIN_TASTE_WEIGHT = 0.05;
// hybrid-v4 (docs/ALGORITHM.md sections 2, 4 and 8)
export const ELO_TERM_CAP = 1;
export const ALSO_IOTA = 0.6;
export const AFFINITY_NEUTRAL = 5;
export const FOLLOW_FLOOR = 8;
export const PERFORMER_RHO = 1.5;
export const PERFORMER_TERM_MIN = -0.75;
export const PERFORMER_TERM_MAX = 1.5;
export const WHY_PERFORMER_MIN = 0.5;
export const EXPLORE_C = 0.6;
export const NEW_ITEM_MAX_RATINGS = 3;
export const NEW_SLOT_MIN_CONTENT = 7;
export const SAVE_BUMP = 0.3;
export const SAVE_BUMP_MAX_FRIENDS = 2;
export const MMR_MU = 0.75;
export const MMR_SIMILARITY_SCALE = 10;
export const TOP_MAX_PER_CATEGORY = 3;
export const SIMILAR_MIX = 0.6;
export const NEUTRAL_TASTE: number[] = FEATURES.map(() => 0.5);

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const dot = (a: number[], b: number[]) => a.reduce((s, x, k) => s + x * (b[k] ?? 0), 0);
const norm = (a: number[]) => Math.sqrt(dot(a, a)) || 1e-9;
export const cosine = (a: number[], b: number[]) => dot(a, b) / (norm(a) * norm(b));
export const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * Cosine measured from the "no signal" baseline instead of from zero. Raw cosine of two all-positive
 * vectors sits near 1 for every pair, which squeezes every score into 9-10 and cannot tell places apart.
 */
export function similarity(a: number[], b: number[]): number {
  const ca = a.map((x) => x - FEATURE_BASELINE);
  const cb = b.map((x) => x - FEATURE_BASELINE);
  if (dot(ca, ca) < 1e-9 || dot(cb, cb) < 1e-9) return UNKNOWN_SIMILARITY;
  return cosine(ca, cb);
}

/**
 * 8.1: one BT/logistic step on the user's taste after "winner beat loser". The surprise g is measured on
 * the similarity gap, the same quantity the content score is built from; a raw dot product saturates
 * whenever the winner simply has more high features, and then nothing is learned.
 */
export function updateTaste(t: number[], prior: number[], fW: number[], fL: number[],
  eta = TASTE_ETA, kappa = TASTE_KAPPA, lambda = TASTE_LAMBDA): number[] {
  const delta = fW.map((x, k) => x - fL[k]);
  const g = 1 - sigmoid(kappa * (similarity(t, fW) - similarity(t, fL)));
  return t.map((x, k) => clip(x + eta * g * delta[k] - eta * lambda * (x - prior[k]), 0, 1));
}

/** A bucket alone is a signal: loved pulls taste toward the item's features, didnt pushes it away. */
export function nudgeTaste(t: number[], f: number[], bucket: "loved" | "fine" | "didnt"): number[] {
  const step = bucket === "loved" ? LOVED_STEP : bucket === "didnt" ? -DIDNT_STEP : 0;
  return t.map((x, k) => clip(x + step * (f[k] - x), 0, 1));
}

/** 8.2: Elo step on place quality. Returns new [bW, bL]. */
export function updateElo(bW: number, bL: number, nW: number, nL: number, K0 = ELO_K0): [number, number] {
  const p = sigmoid(bW - bL);
  return [bW + (K0 / Math.sqrt(1 + nW)) * (1 - p), bL - (K0 / Math.sqrt(1 + nL)) * (1 - p)];
}

/** 8.4: the content-only score, 1 to 10. */
export const contentScore = (t: number[], f: number[]) => 1 + 4.5 * (1 + similarity(t, f));

/**
 * The features that best explain a match, best first: what the place is strongest in, weighted by how
 * much the viewer cares about it. Both are measured from the baseline, and the venue side is squared so
 * a pizza place reads as "great food" even to someone whose own strongest taste is loud music.
 */
export function topFeatures(t: number[], f: number[], n = 2): Feature[] {
  return FEATURES.map((k, i) => ({
    k,
    v: Math.max((f[i] ?? 0) - FEATURE_BASELINE, 0) ** 2 * Math.max((t[i] ?? 0) - FEATURE_BASELINE, MIN_TASTE_WEIGHT),
  }))
    .sort((a, b) => b.v - a.v)
    .slice(0, n)
    .map((c) => c.k);
}

export const FEATURE_PHRASES: Record<Feature, string> = {
  energy: "high energy",
  loudness: "loud",
  crowdAge: "young crowd",
  price: "upscale",
  dancing: "dancing",
  liveMusic: "live music",
  pop: "pop music",
  hiphop: "hip-hop",
  electronic: "electronic music",
  indie: "indie scene",
  culture: "art and culture",
  outdoors: "outdoors",
  food: "great food",
};

/** 8.5: a short phrase such as "Loud + pop music". Never empty. */
export function whyFromFeatures(features: readonly Feature[]): string {
  const phrase = features.map((k) => FEATURE_PHRASES[k]).filter(Boolean).join(" + ");
  if (phrase === "") return "Worth a look nearby";
  return phrase[0].toUpperCase() + phrase.slice(1);
}

export const matchPct = (score: number) => clip(Math.round(((score - 1) / 9) * 100), 0, 100);

type QuizEffect = { set?: Partial<Record<Feature, number>>; add?: Partial<Record<Feature, number>> };

/** One row per quiz card, one entry per option, in the order the quiz shows them. */
export const QUIZ_TABLE: QuizEffect[][] = [
  // What music gets you out? House, Hip-hop, Pop, Techno, Latin, Live bands (multi)
  [
    { set: { electronic: 0.9 }, add: { dancing: 0.25, energy: 0.1 } },
    { set: { hiphop: 0.9 }, add: { dancing: 0.2, energy: 0.1 } },
    { set: { pop: 0.9 }, add: { dancing: 0.2 } },
    { set: { electronic: 0.95 }, add: { dancing: 0.25, energy: 0.2, loudness: 0.1 } },
    { set: { pop: 0.6 }, add: { dancing: 0.35, energy: 0.15 } },
    { set: { liveMusic: 0.9, indie: 0.8 } },
  ],
  // Your ideal crowd? Intimate, Lively, Packed, Don't care
  [
    { set: { energy: 0.25, crowdAge: 0.3 } },
    { set: { energy: 0.6, crowdAge: 0.55 } },
    { set: { energy: 0.9, crowdAge: 0.75 }, add: { dancing: 0.1 } },
    { set: { energy: 0.5, crowdAge: 0.5 } },
  ],
  // Budget for a night out? Under $20, $20-50, $50-100, $100+
  [
    { set: { price: 0.15 } },
    { set: { price: 0.4 } },
    { set: { price: 0.7 } },
    { set: { price: 0.95 } },
  ],
  // When does your night peak? Before 10, 10 to 12, After midnight, Sunrise
  [
    { add: { energy: -0.15, dancing: -0.1 } },
    {},
    { add: { energy: 0.15, dancing: 0.15 } },
    { add: { energy: 0.25, dancing: 0.25, electronic: 0.1 } },
  ],
  // Loud or can you hear yourself? Quiet, Some buzz, Loud, Deafening
  [
    { set: { loudness: 0.1 }, add: { energy: -0.1 } },
    { set: { loudness: 0.4 } },
    { set: { loudness: 0.75 }, add: { energy: 0.1 } },
    { set: { loudness: 0.95 }, add: { energy: 0.15 } },
  ],
  // Besides nightlife you're into... Food, Museums & art, Outdoors, Live shows (multi)
  [
    { set: { food: 0.9 } },
    { set: { culture: 0.9 } },
    { set: { outdoors: 0.9 } },
    { set: { liveMusic: 0.8 } },
  ],
];

/** Maps the 6 quiz answers (option indexes per card) to a 13-feature taste vector in [0, 1]. */
export function quizToVector(answers: number[][]): number[] {
  const t: Record<string, number> = {};
  for (const k of FEATURES) t[k] = QUIZ_BASELINE;
  const wasSet = new Set<string>();
  const chosen = QUIZ_TABLE.flatMap((card, c) => (answers[c] ?? []).map((o) => card[o]).filter(Boolean));
  for (const effect of chosen) {
    for (const [k, value] of Object.entries(effect.set ?? {})) {
      t[k] = wasSet.has(k) ? Math.max(t[k], value) : value;
      wasSet.add(k);
    }
  }
  for (const effect of chosen) {
    for (const [k, value] of Object.entries(effect.add ?? {})) t[k] += value;
  }
  return FEATURES.map((k) => clip(Math.round(t[k] * 1000) / 1000, 0, 1));
}

export type Rater = { taste: number[]; score: number; local: boolean; friend: boolean; name: string };

/** Q: place quality from comparisons, capped so one hot streak cannot add more than a point. */
export const eloTerm = (elo: number) => clip(GAMMA_ELO * elo, -ELO_TERM_CAP, ELO_TERM_CAP);

/** The bounded add-ons of the v4 score. Each is computed by its own function and passed in. */
export type PredictExtras = { performer?: number; also?: number };

/**
 * Sections 1 and 2: predicted 1-10 score and the inputs for the why line.
 * score = clip((1 - lam) * content + lam * crowd + eloTerm + performer + also, 1, 10).
 */
export function predict(tU: number[], fI: number[], eloI: number, raters: Rater[], userIsLocal: boolean, extras: PredictExtras = {}) {
  const alpha = userIsLocal ? ALPHA_LOCAL_VIEWER : ALPHA_VISITOR_VIEWER;
  let num = PSEUDO_VOTES * GLOBAL_MEAN, den = PSEUDO_VOTES, wSum = 0;
  let best: { name: string; score: number; w: number; local: boolean; friend: boolean } | null = null;
  for (const v of raters) {
    const w = Math.max(0, similarity(tU, v.taste)) * (1 + alpha * +v.local) * (1 + BETA_FRIEND * +v.friend);
    num += w * v.score; den += w; wSum += w;
    if (!best || w > best.w) best = { name: v.name, score: v.score, w, local: v.local, friend: v.friend };
  }
  const crowd = num / den;
  const content = contentScore(tU, fI);
  const lam = wSum / (wSum + CROWD_HALF_WEIGHT);
  const base = (1 - lam) * content + lam * crowd;
  const quality = eloTerm(eloI);
  const performer = clip(extras.performer ?? 0, PERFORMER_TERM_MIN, PERFORMER_TERM_MAX);
  const also = clip(extras.also ?? 0, -ALSO_IOTA, ALSO_IOTA);
  const score = clip(base + quality + performer + also, 1, 10);
  return {
    score, lam, crowd, content, base, eloTerm: quality, performer, also,
    weightSum: wSum, topFeatures: topFeatures(tU, fI), topRater: best,
  };
}

export type PerformerAffinity = { name: string; score: number; following: boolean; nRankings?: number };

/** Section 4.1: following a performer lifts the affinity to at least FOLLOW_FLOOR. */
export const effectiveAffinity = (a: { score: number; following: boolean }) =>
  clip(a.following ? Math.max(a.score, FOLLOW_FLOOR) : a.score, 0, 10);

/** P: the performer term for the highest effective affinity on the bill. 0 when there is none. */
export const performerTerm = (bestAffinity: number | undefined) =>
  bestAffinity === undefined
    ? 0
    : clip((PERFORMER_RHO * (bestAffinity - AFFINITY_NEUTRAL)) / AFFINITY_NEUTRAL, PERFORMER_TERM_MIN, PERFORMER_TERM_MAX);

/**
 * The performer term of an event from the viewer's affinities for the performers on it (only those the
 * viewer has a row for), and the reason line when the term is big enough to carry the score.
 */
export function performerAffinity(known: PerformerAffinity[]): { term: number; best?: PerformerAffinity; affinity?: number; why?: string } {
  let best: PerformerAffinity | undefined;
  for (const a of known) {
    if (best === undefined || effectiveAffinity(a) > effectiveAffinity(best)) best = a;
  }
  if (best === undefined) return { term: 0 };
  const affinity = effectiveAffinity(best);
  const term = performerTerm(affinity);
  const rated = !best.following || ((best.nRankings ?? 0) > 0 && best.score >= FOLLOW_FLOOR);
  const why = term < WHY_PERFORMER_MIN
    ? undefined
    : rated ? `You rated ${best.name} ${clip(best.score, 0, 10).toFixed(1)}` : `You follow ${best.name}`;
  return { term, best, affinity, why };
}

/** E: optimism for items with few ratings. n = rankings + comparisons. Used in the order only, never in the shown score. */
export const exploreBonus = (n: number) => EXPLORE_C / Math.sqrt(1 + Math.max(0, n));

/** S: a small bump in the order per friend going or saved, at most SAVE_BUMP_MAX_FRIENDS of them. */
export const socialBump = (friends: number) => SAVE_BUMP * clip(friends, 0, SAVE_BUMP_MAX_FRIENDS);

/** The v4 order: score - distance + time + exploration + friends going or saved. */
export const mapRankV4 = (score: number, distanceM: number, timeMatch: number, nRatings: number, friendsGoingOrSaved: number) =>
  mapRank(score, distanceM, timeMatch) + exploreBonus(nRatings) + socialBump(friendsGoingOrSaved);

export type Rankable = { order: number; vector: number[]; category: string };

/**
 * Section 8: maximal marginal relevance. Picks k items from the pool: the best by order first, then the
 * one with the best mix of order and being unlike what is already picked, with at most
 * TOP_MAX_PER_CATEGORY from one category while another category is still available.
 */
export function mmrPick<T extends Rankable>(pool: T[], k: number, mu = MMR_MU): T[] {
  const left = [...pool].sort((a, b) => b.order - a.order);
  const picked: T[] = [];
  while (picked.length < k && left.length > 0) {
    const perCategory = new Map<string, number>();
    for (const p of picked) perCategory.set(p.category, (perCategory.get(p.category) ?? 0) + 1);
    const allowed = left.filter((c) => (perCategory.get(c.category) ?? 0) < TOP_MAX_PER_CATEGORY);
    let best: T | undefined, bestValue = -Infinity;
    for (const c of allowed.length > 0 ? allowed : left) {
      const closest = picked.reduce((m, p) => Math.max(m, similarity(c.vector, p.vector)), 0);
      const value = mu * c.order - (1 - mu) * MMR_SIMILARITY_SCALE * closest;
      if (value > bestValue) { best = c; bestValue = value; }
    }
    if (best === undefined) break;
    picked.push(best);
    left.splice(left.indexOf(best), 1);
  }
  return picked;
}

export type NewSlotCandidate = { order: number; nRatings: number; content: number };

/**
 * Section 8, the "new on clubi" slot: when the top tier is full and holds nothing with fewer than
 * NEW_ITEM_MAX_RATINGS ratings, returns the best-ordered such item from the rest whose content score
 * is at least NEW_SLOT_MIN_CONTENT. It takes the last top slot. null leaves the list alone.
 */
export function newSlotPick<T extends NewSlotCandidate>(top: T[], rest: T[], topSize: number): T | null {
  if (top.length < topSize || top.some((t) => t.nRatings < NEW_ITEM_MAX_RATINGS)) return null;
  let best: T | null = null;
  for (const c of rest) {
    if (c.nRatings >= NEW_ITEM_MAX_RATINGS || c.content < NEW_SLOT_MIN_CONTENT) continue;
    if (best === null || c.order > best.order) best = c;
  }
  return best;
}

/** "More like this": a mix of closeness in feature space (put on the 0-10 scale) and the viewer's own score. */
export const similarValue = (sim: number, score: number, mix = SIMILAR_MIX) =>
  mix * MMR_SIMILARITY_SCALE * Math.max(0, sim) + (1 - mix) * score;

/** 8.4: map ordering. distanceM from haversine, timeMatch in [0, 1]. */
export const mapRank = (score: number, distanceM: number, timeMatch: number) =>
  score - DISTANCE_DELTA * Math.log(1 + distanceM / DISTANCE_D0_METERS) + TIME_TAU * timeMatch;

/** 8.7: half the group's average, half its least happy member; null when anyone would hate it. */
export function groupScore(scores: number[]): number | null {
  if (scores.length === 0 || scores.some((x) => x < GROUP_VETO_SCORE)) return null;
  const mean = scores.reduce((s, x) => s + x, 0) / scores.length;
  return (1 - GROUP_BETA) * mean + GROUP_BETA * Math.min(...scores);
}
