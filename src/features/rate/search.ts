/**
 * "Which was better?": where a newly ranked place sits among the ones already in its bucket.
 *
 * This is the pseudocode in docs/UI-SPEC.md section 6, step 3, and it produces exactly what
 * `api.rankings.rank` accepts: a 1-based `position` inside the bucket, and `comparisons` that are
 * each between the new item and one item of that list. It decides nothing about scores or order:
 * the backend turns the position into a score.
 *
 * No runtime imports, so it can be run on its own.
 */
import type { Id } from "../../../convex/_generated/dataModel";

export type TargetId = Id<"places"> | Id<"events">;
/** One row of `api.rankings.listInBucket`, best first. */
export type BucketEntry = { id: TargetId; kind: "place" | "event"; name: string; score: number; position: number };
export type Comparison = { winnerId: TargetId; loserId: TargetId };

export type Search = {
  /** The bucket as it was when the step started, without the item being ranked. Never changes afterwards. */
  list: BucketEntry[];
  lo: number;
  hi: number;
  rounds: number;
  comparisons: Comparison[];
  /** No more questions: read `positionOf`. */
  done: boolean;
};

export const MAX_ROUNDS = 4;

/** How many rounds the progress line promises: "1 of 3". */
export function totalRounds(listLength: number): number {
  if (listLength <= 0) return 0;
  return Math.min(MAX_ROUNDS, Math.ceil(Math.log2(listLength + 1)));
}

const finished = (lo: number, hi: number, rounds: number) => lo >= hi || rounds >= MAX_ROUNDS;

/**
 * Start from the bucket the backend returned. The item being ranked is left out, which matters
 * when re-ranking a place that is already in this bucket. An empty bucket is done at once: position 1.
 */
export function startSearch(bucketList: readonly BucketEntry[], newId: string): Search {
  const list = bucketList.filter((entry) => entry.id !== newId);
  return { list, lo: 0, hi: list.length, rounds: 0, comparisons: [], done: finished(0, list.length, 0) };
}

/** The already-ranked item to show against the new one, or null when the search is over. */
export function opponentOf(search: Search): BucketEntry | null {
  if (search.done) return null;
  return search.list[Math.floor((search.lo + search.hi) / 2)] ?? null;
}

/** One tap: the new item was better (`newWon`) or the one already ranked was. */
export function answer(search: Search, newId: TargetId, newWon: boolean): Search {
  const opponent = opponentOf(search);
  if (opponent === null) return search;
  const mid = Math.floor((search.lo + search.hi) / 2);
  const lo = newWon ? search.lo : mid + 1;
  const hi = newWon ? mid : search.hi;
  const rounds = search.rounds + 1;
  const comparison: Comparison = newWon
    ? { winnerId: newId, loserId: opponent.id }
    : { winnerId: opponent.id, loserId: newId };
  return {
    list: search.list,
    lo,
    hi,
    rounds,
    comparisons: [...search.comparisons, comparison],
    done: finished(lo, hi, rounds),
  };
}

/** "Too close to call": stop asking, keep what was learned, add no comparison. */
export function stopEarly(search: Search): Search {
  return { ...search, done: true };
}

/** Where the new item goes in its bucket. 1 = best. */
export function positionOf(search: Search): number {
  return Math.floor((search.lo + search.hi) / 2) + 1;
}
