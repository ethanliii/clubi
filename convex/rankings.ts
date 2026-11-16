import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Category, RankResult, RankedListItem } from "./lib/contract";
import { displayNameOf, friendIdsOf, isUnder21, sameCity } from "./lib/discovery";
import {
  BUCKET_ORDER,
  CATEGORY_NOUN,
  DIRECT_SCORE_RANKINGS,
  MAX_DIRECT_SCORE,
  MIN_DIRECT_SCORE,
  bucketOfScore,
  cleanCaption,
  comparisonKey,
  rankLabel,
  renumber,
  shownScore,
  unseenComparisons,
} from "./lib/social";
import { forgetAnswers } from "./insights";
import { notify } from "./notifications";
import { recordPerformerAffinity } from "./performers";
import { applyComparison, applyScore } from "./scoring";
import { categoryValidator } from "./tables/catalog";
import { bucketValidator, visibilityValidator } from "./tables/people";

const DEGREES_PER_HOUR = 15;
const MAX_COMPARISONS = 20;
/** A re-rank teaches taste again when its score lands at least this far from the old one. */
const RESCORE_TEACHES = 1;
const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 40;
const MAX_GROUP_SIZE = 99;
/** One person's rankings in one category, and across all of them. Far above what anyone has today. */
export const MAX_RANKINGS_PER_CATEGORY = 500;
export const MAX_RANKINGS_PER_USER = 1000;
/** How far back we look for comparisons this user already made with the item being ranked. */
const COMPARISON_HISTORY = 1500;
/** Rankings of the same item we read to tell a friend "…and you gave it 7.1". */
const SAME_TARGET_SAMPLE = 300;
const MAX_FRIENDS_NOTIFIED = 200;

const localOffsetMs = (lng: number) =>
  Math.round(lng / DEGREES_PER_HOUR) * 3600 * 1000;

const vKind = v.union(v.literal("place"), v.literal("event"));
const vTargetId = v.union(v.id("places"), v.id("events"));

export type TargetId = Id<"places"> | Id<"events">;
export type TargetInfo = {
  name: string;
  category: Category;
  city?: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  startsAt?: number;
};

/** What a ranking, post or save points at: the few fields of a place or event that People code shows. */
export async function targetOf(
  ctx: QueryCtx,
  kind: "place" | "event",
  id: TargetId,
): Promise<TargetInfo | null> {
  if (kind === "place") {
    const place = await ctx.db.get("places", id as Id<"places">);
    return (
      place && {
        name: place.name,
        category: place.category,
        city: place.city,
        lat: place.lat,
        lng: place.lng,
        imageUrl: place.imageUrl,
      }
    );
  }
  const event = await ctx.db.get("events", id as Id<"events">);
  return (
    event && {
      name: event.title,
      category: event.category,
      city: event.city,
      lat: event.lat,
      lng: event.lng,
      imageUrl: event.imageUrl,
      startsAt: event.start,
    }
  );
}

/** How many reactions and comments one post delete will clear. Posts with more than this don't exist yet. */
const CASCADE_LIMIT = 1000;

/** Deletes a post with its reactions, comments and stored photos. The ranking stays. */
export async function deletePostCascade(ctx: MutationCtx, post: Doc<"posts">) {
  const reactions = await ctx.db
    .query("reactions")
    .withIndex("by_post", (q) => q.eq("postId", post._id))
    .take(CASCADE_LIMIT);
  for (const reaction of reactions) {
    await ctx.db.delete("reactions", reaction._id);
  }
  const comments = await ctx.db
    .query("comments")
    .withIndex("by_post", (q) => q.eq("postId", post._id))
    .take(CASCADE_LIMIT);
  for (const comment of comments) {
    await ctx.db.delete("comments", comment._id);
  }
  for (const photo of post.photos ?? []) {
    await ctx.storage.delete(photo);
  }
  await ctx.db.delete("posts", post._id);
}

type BucketItem = {
  id: TargetId;
  kind: "place" | "event";
  name: string;
  score: number;
  position: number;
  imageUrl?: string;
};

export const targetIdOfRanking = (ranking: Doc<"rankings">): TargetId | undefined =>
  ranking.placeId ?? ranking.eventId;

/** A user's rankings, one category or all of them, in no particular order. */
export async function rankingsOf(
  ctx: QueryCtx,
  userId: Id<"users">,
  category?: Category,
): Promise<Doc<"rankings">[]> {
  if (category === undefined) {
    return await ctx.db
      .query("rankings")
      .withIndex("by_user_category", (q) => q.eq("userId", userId))
      .take(MAX_RANKINGS_PER_USER);
  }
  return await ctx.db
    .query("rankings")
    .withIndex("by_user_category", (q) =>
      q.eq("userId", userId).eq("category", category),
    )
    .take(MAX_RANKINGS_PER_CATEGORY);
}

/** ranking id → position in its category across buckets (1 = that person's favorite), and the category's size. */
export function overallPositions(rankings: Doc<"rankings">[]) {
  const overall = new Map<Id<"rankings">, { position: number; outOf: number }>();
  const byCategory = new Map<Category, Doc<"rankings">[]>();
  for (const ranking of rankings) {
    byCategory.set(ranking.category, [
      ...(byCategory.get(ranking.category) ?? []),
      ranking,
    ]);
  }
  for (const rows of byCategory.values()) {
    const sorted = [...rows].sort(
      (a, b) =>
        BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket) ||
        a.position - b.position,
    );
    for (const [index, ranking] of sorted.entries()) {
      overall.set(ranking._id, { position: index + 1, outOf: sorted.length });
    }
  }
  return overall;
}

/** A user's ranked list, best first. With no category: every category, highest score first. */
export async function rankedListOf(
  ctx: QueryCtx,
  userId: Id<"users">,
  category?: Category,
): Promise<RankedListItem[]> {
  const rankings = await rankingsOf(ctx, userId, category);
  const overall = overallPositions(rankings);
  const items: RankedListItem[] = [];
  for (const ranking of rankings) {
    const id = targetIdOfRanking(ranking);
    const kind = ranking.placeId !== undefined ? "place" : "event";
    const target = id === undefined ? null : await targetOf(ctx, kind, id);
    if (id === undefined || target === null) {
      continue;
    }
    items.push({
      rankingId: ranking._id,
      kind,
      id,
      name: target.name,
      category: ranking.category,
      score: ranking.score,
      position: overall.get(ranking._id)?.position ?? ranking.position,
      bucket: ranking.bucket,
      imageUrl: target.imageUrl,
      rankedAt: ranking.visitedAt ?? ranking._creationTime,
    });
  }
  return items.sort(
    (a, b) =>
      (category === undefined ? b.score - a.score : 0) ||
      a.position - b.position ||
      b.score - a.score,
  );
}

/** Writes the positions and scores `renumber` computed, touching only the rows that changed. */
export async function writePlacement(
  ctx: MutationCtx,
  rows: Doc<"rankings">[],
  placed: ReturnType<typeof renumber<Id<"rankings">>>,
  /** How many rankings the category holds, when `rows` leaves one out (the one being ranked). */
  total: number = rows.length,
) {
  const current = new Map(rows.map((row) => [row._id, row]));
  for (const { id, position, score: placedScore } of placed) {
    const row = current.get(id);
    // A directly given score stays what its owner gave while the category is small.
    const score = shownScore(placedScore, row?.manualScore, total);
    if (row !== undefined && (row.position !== position || row.score !== score)) {
      await ctx.db.patch("rankings", id, { position, score });
    }
  }
}

export const listInBucket = query({
  args: { category: categoryValidator, bucket: bucketValidator },
  handler: async (ctx, { category, bucket }): Promise<BucketItem[]> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const rankings = await rankingsOf(ctx, userId, category);
    const inBucket = rankings
      .filter((ranking) => ranking.bucket === bucket)
      .sort((a, b) => a.position - b.position);
    const items: BucketItem[] = [];
    for (const ranking of inBucket) {
      const kind = ranking.placeId !== undefined ? "place" : "event";
      const id = targetIdOfRanking(ranking);
      const target = id === undefined ? null : await targetOf(ctx, kind, id);
      if (id === undefined || target === null) {
        continue;
      }
      items.push({
        id,
        kind,
        name: target.name,
        score: ranking.score,
        position: ranking.position,
        imageUrl: target.imageUrl,
      });
    }
    return items;
  },
});

export const mine = query({
  args: { category: v.optional(categoryValidator) },
  handler: async (ctx, { category }): Promise<RankedListItem[]> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    return await rankedListOf(ctx, userId, category);
  },
});

/** The most friends one post can say you went with. */
const MAX_WENT_WITH = 8;

export const rank = mutation({
  args: {
    kind: vKind,
    id: vTargetId,
    bucket: bucketValidator,
    position: v.number(),
    comparisons: v.array(v.object({ winnerId: vTargetId, loserId: vTargetId })),
    /** A score given directly, 1.0 to 10.0. Only while the user has fewer than five other rankings in the category; `bucket` and `position` then follow from it. */
    score: v.optional(v.number()),
    tags: v.array(v.string()),
    caption: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
    visibility: v.optional(visibilityValidator),
    groupSize: v.optional(v.number()),
    /** Friends you went with. Must be accepted friends; at most 8; duplicates dropped. */
    withUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args): Promise<RankResult> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const { kind, id, comparisons } = args;
    if (comparisons.length > MAX_COMPARISONS) {
      throw new Error("Too many comparisons");
    }
    if (
      args.groupSize !== undefined &&
      (!Number.isInteger(args.groupSize) ||
        args.groupSize < 1 ||
        args.groupSize > MAX_GROUP_SIZE)
    ) {
      throw new Error(`Group size must be a whole number from 1 to ${MAX_GROUP_SIZE}`);
    }
    const tags = [
      ...new Set(args.tags.map((tag) => tag.trim()).filter((tag) => tag !== "")),
    ];
    if (tags.length > MAX_TAGS || tags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
      throw new Error(`Use at most ${MAX_TAGS} short tags`);
    }
    const caption = cleanCaption(args.caption);
    const target = await targetOf(ctx, kind, id);
    if (target === null) {
      throw new Error("That place or event no longer exists");
    }
    const user = await ctx.db.get("users", userId);
    const { category } = target;
    const now = Date.now();
    // Privacy: someone under 21 never gets nightlife, so they can't rank it either.
    if (category === "nightlife" && isUnder21(user?.birthday, now)) {
      throw new Error("That place or event isn't available");
    }
    const local = new Date(now + localOffsetMs(target.lng));
    const dayOfWeek = local.getUTCDay();
    const hour = local.getUTCHours();

    const mine = await rankingsOf(ctx, userId, category);
    const existing = mine.find((ranking) => targetIdOfRanking(ranking) === id);
    const others = mine.filter((ranking) => ranking !== existing);
    const rankedIds = new Set(others.map((ranking) => targetIdOfRanking(ranking)));
    for (const { winnerId, loserId } of comparisons) {
      const other = winnerId === id ? loserId : winnerId;
      if ((winnerId !== id && loserId !== id) || !rankedIds.has(other)) {
        throw new Error(
          "Each comparison must be between this item and one you already ranked in the same category",
        );
      }
    }

    // A direct score (the first five rankings of a category): it picks the bucket, and the item goes
    // below everything in that bucket that scores higher.
    let manualScore: number | undefined;
    if (args.score !== undefined) {
      if (others.length >= DIRECT_SCORE_RANKINGS) {
        throw new Error("You have enough rankings here to compare: pick which was better instead of a score");
      }
      if (!Number.isFinite(args.score) || args.score < MIN_DIRECT_SCORE || args.score > MAX_DIRECT_SCORE) {
        throw new Error(`A score is a number from ${MIN_DIRECT_SCORE} to ${MAX_DIRECT_SCORE}`);
      }
      if (comparisons.length > 0) throw new Error("A direct score comes without comparisons");
      manualScore = Math.round(args.score * 10) / 10;
    }
    const bucket = manualScore === undefined ? args.bucket : bucketOfScore(manualScore);
    const wantedPosition =
      manualScore === undefined
        ? args.position
        : 1 + others.filter((ranking) => ranking.bucket === bucket && ranking.score > manualScore!).length;
    const total = others.length + 1;

    // The same number-and-score code `remove` and the demo seed use. `null` stands for the item being
    // ranked until its row exists.
    const placed = renumber<Id<"rankings"> | null>(
      others.map((ranking) => ({
        id: ranking._id,
        bucket: ranking.bucket,
        position: ranking.position,
      })),
      { id: null, bucket, position: wantedPosition },
    );
    const own = placed.find((row) => row.id === null);
    if (own === undefined) {
      throw new Error("Could not place that ranking");
    }
    const fields = {
      bucket,
      position: own.position,
      score: shownScore(own.score, manualScore, total),
      // A ranking placed by comparisons no longer carries a score its owner typed in.
      manualScore,
      tags,
      visitedAt: now,
      wasLocal: sameCity(user?.homeCity, target.city),
      dayOfWeek,
      hour,
      ...(args.groupSize === undefined ? {} : { groupSize: args.groupSize }),
    };
    let rankingId: Id<"rankings">;
    if (existing !== undefined) {
      rankingId = existing._id;
      await ctx.db.patch("rankings", rankingId, fields);
    } else if (kind === "place") {
      rankingId = await ctx.db.insert("rankings", {
        userId,
        placeId: id as Id<"places">,
        category,
        ...fields,
      });
    } else {
      rankingId = await ctx.db.insert("rankings", {
        userId,
        eventId: id as Id<"events">,
        category,
        ...fields,
      });
    }
    await writePlacement(
      ctx,
      others,
      placed.flatMap((row) => (row.id === null ? [] : [{ ...row, id: row.id }])),
      total,
    );
    const score = shownScore(own.score, manualScore, total);
    const position = own.overall;

    // Live learning. A re-rank walks the same binary search again and sends comparisons the model has
    // already learned from, so only pairs this user has never recorded (same winner, same loser) are
    // stored and taught; a flipped outcome is new and counts. The bucket nudge runs once per bucket:
    // again only when the bucket changed.
    const history = await ctx.db
      .query("comparisons")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(COMPARISON_HISTORY);
    const fresh = unseenComparisons(
      comparisons,
      history
        .filter((row) => row.winnerId === id || row.loserId === id)
        .map((row) => comparisonKey(row.winnerId, row.loserId)),
    );
    for (const { winnerId, loserId } of fresh) {
      await ctx.db.insert("comparisons", {
        userId,
        winnerId,
        loserId,
        category,
        createdAt: now,
        dayOfWeek,
        hour,
      });
    }
    for (const { winnerId, loserId } of fresh) {
      await applyComparison(ctx, userId, winnerId, loserId);
    }
    // The score itself teaches taste: low pushes it away from what this place is like (so places like
    // it score lower for this person, and unlike ones a little higher), high pulls it toward. Once for
    // a new ranking, and again only when a re-rank changes the bucket or moves the score a full point.
    if (existing === undefined || existing.bucket !== bucket || Math.abs(existing.score - score) >= RESCORE_TEACHES) {
      await applyScore(ctx, userId, id, score);
    }
    if (kind === "event") {
      await recordPerformerAffinity(ctx, {
        userId,
        eventId: id as Id<"events">,
        score,
      });
    }

    // The post. A re-rank keeps the post it already has (and its place in the feed): a new photo is
    // added, a new caption or visibility replaces the old one, and nothing passed means nothing changes.
    const previousPost =
      existing === undefined
        ? null
        : await ctx.db
            .query("posts")
            .withIndex("by_ranking", (q) => q.eq("rankingId", rankingId))
            .first();
    const visibility =
      args.visibility ??
      previousPost?.visibility ??
      user?.defaultVisibility ??
      "friends";
    // "Went with": only people who are actually friends, so nobody can be tagged by a stranger.
    let withUserIds: Id<"users">[] | undefined;
    if (args.withUserIds !== undefined) {
      const friends = await friendIdsOf(ctx, userId);
      const unique = [...new Set(args.withUserIds)].filter((id) => id !== userId);
      if (unique.length > MAX_WENT_WITH) throw new Error(`Tag at most ${MAX_WENT_WITH} friends`);
      if (unique.some((id) => !friends.has(id))) throw new Error("You can only tag your friends");
      withUserIds = unique;
    }
    if (previousPost === null) {
      await ctx.db.insert("posts", {
        ...(withUserIds === undefined || withUserIds.length === 0 ? {} : { withUserIds }),
        userId,
        rankingId,
        targetKind: kind,
        targetId: id,
        photos: args.photoStorageId === undefined ? [] : [args.photoStorageId],
        caption,
        visibility,
        createdAt: now,
      });
    } else {
      const photos = previousPost.photos ?? [];
      await ctx.db.patch("posts", previousPost._id, {
        visibility,
        ...(withUserIds === undefined ? {} : { withUserIds }),
        ...(caption === undefined ? {} : { caption }),
        ...(args.photoStorageId === undefined ||
        photos.includes(args.photoStorageId)
          ? {}
          : { photos: [...photos, args.photoStorageId] }),
      });
    }

    // Friends hear about a new ranking once: not about a re-rank, and never about a private post.
    if (existing === undefined && visibility !== "private") {
      const friendIds = [...(await friendIdsOf(ctx, userId))].slice(
        0,
        MAX_FRIENDS_NOTIFIED,
      );
      const sameTarget =
        friendIds.length === 0
          ? []
          : kind === "place"
            ? await ctx.db
                .query("rankings")
                .withIndex("by_place", (q) => q.eq("placeId", id as Id<"places">))
                .take(SAME_TARGET_SAMPLE)
            : await ctx.db
                .query("rankings")
                .withIndex("by_event", (q) => q.eq("eventId", id as Id<"events">))
                .take(SAME_TARGET_SAMPLE);
      const scoreByUser = new Map(
        sameTarget.map((ranking) => [ranking.userId, ranking.score]),
      );
      const actorName = user === null ? "A friend" : displayNameOf(user);
      for (const friendId of friendIds) {
        const friendScore = scoreByUser.get(friendId);
        await notify(ctx, {
          userId: friendId,
          type: friendScore === undefined ? "friend_posted" : "friend_ranked_same",
          title: `${actorName} ranked ${target.name} #${position} · ${score.toFixed(1)}`,
          body:
            friendScore === undefined
              ? (caption ?? `#${position} of their ${CATEGORY_NOUN[category]}`)
              : `…and you gave it ${friendScore.toFixed(1)}`,
          link: `/venue/${kind}/${id}`,
          actorId: userId,
        });
      }
    }

    return {
      rankingId,
      score,
      position,
      outOf: placed.length,
      label: rankLabel("your", position, category, score),
    };
  },
});

export const remove = mutation({
  args: { rankingId: v.id("rankings") },
  returns: v.null(),
  handler: async (ctx, { rankingId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const ranking = await ctx.db.get("rankings", rankingId);
    if (ranking === null) {
      return null;
    }
    if (ranking.userId !== userId) {
      throw new Error("You can only remove your own rankings");
    }
    const post = await ctx.db
      .query("posts")
      .withIndex("by_ranking", (q) => q.eq("rankingId", rankingId))
      .first();
    if (post !== null) {
      await deletePostCascade(ctx, post);
    }
    await ctx.db.delete("rankings", rankingId);
    // The answers given about this visit come out of the venue's totals too.
    const removedTarget = ranking.placeId ?? ranking.eventId;
    if (removedTarget !== undefined) await forgetAnswers(ctx, userId, removedTarget);
    // Close the gap: the rest of the category is numbered and scored again by the code `rank` uses.
    const rest = await rankingsOf(ctx, userId, ranking.category);
    await writePlacement(
      ctx,
      rest,
      renumber(
        rest.map((row) => ({
          id: row._id,
          bucket: row.bucket,
          position: row.position,
        })),
      ),
    );
    return null;
  },
});
