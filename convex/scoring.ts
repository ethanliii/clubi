import { Id } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";
import type { Bucket } from "./lib/contract";
import { tasteOf, venueVectorOf } from "./lib/discovery";
import { nudgeTaste, updateElo, updateTaste } from "./lib/recs";

/*
 * Live learning, for rankings.rank (Captain 2, task P5). Add this import:
 *
 *   import { applyBucket, applyComparison } from "./scoring";
 *
 * and, after the ranking and its comparisons are saved, these two lines:
 *
 *   for (const { winnerId, loserId } of comparisons) await applyComparison(ctx, userId, winnerId, loserId);
 *   await applyBucket(ctx, userId, id, bucket);
 *
 * Both are safe to call for places and events, skip missing rows, and write only
 * users.tasteVector / tastePrior and the two items' elo / nComparisons.
 *
 * venueVectorOf() returns the item's learnedVector (measured from visitors' answers) when it has one,
 * so every taste step here learns from measured features, not only from the featurizer's guess.
 */
export * from "./lib/recs";

type ItemId = Id<"places"> | Id<"events">;

/** One comparison "winner beat loser": a taste step for the user and an Elo step for both items. Same category only. */
export async function applyComparison(ctx: MutationCtx, userId: Id<"users">, winner: ItemId, loser: ItemId): Promise<void> {
  const [user, w, l] = await Promise.all([ctx.db.get(userId), ctx.db.get(winner), ctx.db.get(loser)]);
  if (user === null || w === null || l === null || w._id === l._id || w.category !== l.category) return;
  const taste = tasteOf(user);
  const prior = user.tastePrior?.length === taste.length ? user.tastePrior : taste;
  await ctx.db.patch(userId, {
    tasteVector: updateTaste(taste, prior, venueVectorOf(w), venueVectorOf(l)),
    tastePrior: prior,
  });
  const [eloW, eloL] = updateElo(w.elo ?? 0, l.elo ?? 0, w.nComparisons ?? 0, l.nComparisons ?? 0);
  await ctx.db.patch(w._id, { elo: eloW, nComparisons: (w.nComparisons ?? 0) + 1 });
  await ctx.db.patch(l._id, { elo: eloL, nComparisons: (l.nComparisons ?? 0) + 1 });
}

/** The bucket alone: loved moves taste 3% toward the item's features (LOVED_STEP), didnt 5% away. */
export async function applyBucket(ctx: MutationCtx, userId: Id<"users">, item: ItemId, bucket: Bucket): Promise<void> {
  const [user, doc] = await Promise.all([ctx.db.get(userId), ctx.db.get(item)]);
  if (user === null || doc === null || bucket === "fine") return;
  const taste = tasteOf(user);
  await ctx.db.patch(userId, {
    tasteVector: nudgeTaste(taste, venueVectorOf(doc), bucket),
    tastePrior: user.tastePrior?.length === taste.length ? user.tastePrior : taste,
  });
}
