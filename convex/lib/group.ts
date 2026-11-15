// Owner: Brain session. Pure code: group and trip scoring (docs/ALGORITHM.md section 5).
// No imports on purpose, so `node --test` can load this file directly.

/** Share of the score that comes from the least happy member; the rest is the (weighted) average. Same value as GROUP_BETA in recs.ts. */
export const GROUP_BETA = 0.5;
/** Anyone predicted below this drops the item for the whole group. Same value as GROUP_VETO_SCORE in recs.ts. */
export const GROUP_VETO_SCORE = 4;
/** Disagreement penalty: points taken off per point of standard deviation between members. */
export const GROUP_PSI = 0.5;
/** Vote bonus: points added when every member voted the item up (and taken off when everyone voted it down). */
export const GROUP_VOTE_NU = 1.0;
/** How fast a member who compromised at one stop gains weight for the next. */
export const FAIRNESS_ETA = 2;
/** Standard deviation at which agreement reaches 0. */
export const AGREEMENT_SD_MAX = 3;
/** At or above this lowest member score the why line is "Everyone's at 8+ here". */
export const EVERYONE_LOVES_SCORE = 8;
export const GROUP_SCORE_MIN = 1;
export const GROUP_SCORE_MAX = 10;

export type VoteTally = { up: number; down: number };
export type GroupScoreOpts = {
  /** Trip shortlist votes for this item, counted over the group's members. */
  votes?: VoteTally;
  /** Fairness weights, one per score in the same order (from `fairWeights`). Ignored unless the length matches. */
  weights?: number[];
};
export type GroupScore = {
  /** The group score, clipped to 1-10, not rounded. */
  score: number;
  /** 0-1, 1 = everyone scores it the same. Goes straight into `GroupItem.agreement`. */
  agreement: number;
  /** The (weighted) average that went into the score. */
  mean: number;
  /** The least happy member's score. */
  min: number;
  /** Standard deviation between members. */
  sd: number;
  /** Points the votes added or removed, before clipping. */
  voteTerm: number;
};

const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const finite = (scores: number[]) => scores.filter((x) => Number.isFinite(x));
const average = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const one = (x: number) => (Math.floor(x * 10) / 10).toFixed(1);

/** Population standard deviation of the members' scores; 0 for an empty group or a single member. */
export function spread(scores: number[]): number {
  const xs = finite(scores);
  if (xs.length < 2) return 0;
  const mean = average(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
}

/** 0.83: how alike the members' scores are. 1 = identical (also for one member or none), 0 = spread of 3 points or more. */
export function agreement(scores: number[]): number {
  return 1 - Math.min(1, spread(scores) / AGREEMENT_SD_MAX);
}

/**
 * The group score for one item, from each member's own predicted 1-10 score:
 * (1 - beta) * average + beta * lowest - psi * spread + nu * (up - down) / members, clipped to 1-10.
 * Returns null when the item is dropped: the group is empty, or anyone is below GROUP_VETO_SCORE.
 * Votes never rescue a vetoed item. Scores that are not finite numbers are ignored.
 * With one member and no votes the result is that member's own score.
 */
export function groupScoreV2(scores: number[], opts: GroupScoreOpts = {}): GroupScore | null {
  const usable = scores.every((x) => Number.isFinite(x));
  const xs = usable ? scores : finite(scores);
  if (xs.length === 0 || xs.some((x) => x < GROUP_VETO_SCORE)) return null;
  const weights = usable ? validWeights(opts.weights, xs.length) : null;
  const mean = weights === null
    ? average(xs)
    : xs.reduce((s, x, k) => s + weights[k] * x, 0) / weights.reduce((s, w) => s + w, 0);
  const min = Math.min(...xs);
  const sd = spread(xs);
  const up = Math.max(0, opts.votes?.up ?? 0), down = Math.max(0, opts.votes?.down ?? 0);
  const voteTerm = GROUP_VOTE_NU * clip((up - down) / xs.length, -1, 1);
  const raw = (1 - GROUP_BETA) * mean + GROUP_BETA * min - GROUP_PSI * sd + voteTerm;
  return {
    score: clip(raw, GROUP_SCORE_MIN, GROUP_SCORE_MAX),
    agreement: 1 - Math.min(1, sd / AGREEMENT_SD_MAX),
    mean, min, sd, voteTerm,
  };
}

/** The name ALGORITHM.md section 5 uses for the same function. */
export const groupScoreV4 = groupScoreV2;

function validWeights(weights: number[] | undefined, n: number): number[] | null {
  if (weights === undefined || weights.length !== n) return null;
  if (!weights.every((w) => Number.isFinite(w) && w >= 0) || !weights.some((w) => w > 0)) return null;
  return weights;
}

/**
 * One fairness step after a stop is chosen: w_u <- w_u * exp(eta * (average - score_u) / 10), then rescaled
 * so the weights sum to the group size. Whoever was least happy at this stop counts more at the next one.
 * `weights` and `scores` are in the same member order. A length mismatch returns equal weights for `scores`.
 */
export function nextWeights(weights: number[], scores: number[], eta: number = FAIRNESS_ETA): number[] {
  const n = scores.length;
  if (n === 0) return [];
  const start = validWeights(weights, n) ?? scores.map(() => 1);
  const known = finite(scores);
  const mean = known.length === 0 ? 0 : average(known);
  const moved = start.map((w, k) => (Number.isFinite(scores[k]) ? w * Math.exp((eta * (mean - scores[k])) / 10) : w));
  const total = moved.reduce((s, w) => s + w, 0);
  return total > 0 ? moved.map((w) => (w * n) / total) : scores.map(() => 1);
}

/**
 * Fairness weights for the next stop of a multi-stop plan.
 * `previousStopScores[k]` holds every member's score for the stop already chosen at position k, always in the
 * same member order. Returns one weight per member, summing to the group size; pass it as `opts.weights`
 * to `groupScoreV2` when scoring candidates for the next stop. No previous stops returns [] (equal weights).
 */
export function fairWeights(previousStopScores: number[][], eta: number = FAIRNESS_ETA): number[] {
  if (previousStopScores.length === 0) return [];
  const n = previousStopScores[0].length;
  let weights: number[] = Array.from({ length: n }, () => 1);
  for (const scores of previousStopScores) {
    if (scores.length !== n) continue;
    weights = nextWeights(weights, scores, eta);
  }
  return weights;
}

/**
 * Counts trip votes per item for the members being scored. Rows are `tripVotes` documents (or anything with the
 * same three fields). Votes from people outside `memberIds` are skipped, and each member counts once per item
 * (their last row wins). Look a result up with `tally.get(String(targetId))`.
 */
export function tallyVotes(
  rows: { targetId: string; userId: string; vote: number }[],
  memberIds?: string[],
): Map<string, VoteTally> {
  const members = memberIds === undefined ? null : new Set(memberIds.map(String));
  const latest = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const user = String(row.userId);
    if (members !== null && !members.has(user)) continue;
    const target = String(row.targetId);
    let byUser = latest.get(target);
    if (byUser === undefined) latest.set(target, (byUser = new Map()));
    byUser.set(user, row.vote);
  }
  const tally = new Map<string, VoteTally>();
  for (const [target, byUser] of latest) {
    let up = 0, down = 0;
    for (const vote of byUser.values()) {
      if (vote > 0) up++;
      else if (vote < 0) down++;
    }
    tally.set(target, { up, down });
  }
  return tally;
}

/**
 * The why line for a group item. "Everyone's at 8+ here" when the lowest member is at 8 or more, else
 * "Best overlap: Ethan 9.1, Bryan 7.8" (highest and lowest member), then " · tag" when a tag is given.
 * Never empty: one member or none falls back to the tag, or a plain line.
 */
export function groupWhy(members: { name: string; score: number }[], tag?: string): string {
  const known = members.filter((m) => Number.isFinite(m.score));
  const suffix = tag ? ` · ${tag}` : "";
  if (known.length < 2) return tag || (known.length === 1 ? "Picked for you" : "Picked for the group");
  let high = known[0], low = known[0];
  for (const m of known) {
    if (m.score > high.score) high = m;
    if (m.score < low.score) low = m;
  }
  if (low.score >= EVERYONE_LOVES_SCORE) return `Everyone's at ${EVERYONE_LOVES_SCORE}+ here${suffix}`;
  if (high === low) return `Everyone's at ${one(low.score)} here${suffix}`;
  return `Best overlap: ${high.name} ${one(high.score)}, ${low.name} ${one(low.score)}${suffix}`;
}
