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
export const LOVED_STEP = 0.1;
export const DIDNT_STEP = 0.05;
export const QUIZ_BASELINE = 0.3;
export const FEATURE_BASELINE = 0.15;
export const UNKNOWN_SIMILARITY = 0.5;
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

/** The features with the largest taste x venue contribution, best first. */
export function topFeatures(t: number[], f: number[], n = 2): Feature[] {
  return FEATURES.map((k, i) => ({ k, v: (t[i] ?? 0) * (f[i] ?? 0) }))
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

/** 8.3 + 8.4: predicted 1-10 score and the inputs for the why line. */
export function predict(tU: number[], fI: number[], eloI: number, raters: Rater[], userIsLocal: boolean) {
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
  const score = clip((1 - lam) * content + lam * crowd + GAMMA_ELO * eloI, 1, 10);
  return { score, lam, crowd, content, weightSum: wSum, topFeatures: topFeatures(tU, fI), topRater: best };
}

/** 8.4: map ordering. distanceM from haversine, timeMatch in [0, 1]. */
export const mapRank = (score: number, distanceM: number, timeMatch: number) =>
  score - DISTANCE_DELTA * Math.log(1 + distanceM / DISTANCE_D0_METERS) + TIME_TAU * timeMatch;
