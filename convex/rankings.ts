import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Bucket, Category, RankResult } from "./lib/contract";
import { displayNameOf } from "./lib/discovery";
import { notify } from "./notifications";
import { applyBucket, applyComparison } from "./scoring";
import { categoryValidator } from "./tables/catalog";
import { bucketValidator } from "./tables/people";

const BUCKET_ORDER: Bucket[] = ["loved", "fine", "didnt"];
const BUCKET_RANGE: Record<Bucket, [number, number]> = {
  loved: [6.7, 10],
  fine: [3.4, 6.7],
  didnt: [0, 3.3],
};
const CATEGORY_NOUN: Record<Category, string> = {
  nightlife: "bars",
  food: "food spots",
  culture: "culture spots",
  outdoors: "outdoor spots",
  live: "shows",
  popup: "pop-ups",
};
const DEGREES_PER_HOUR = 15;
const MAX_COMPARISONS = 20;

const localOffsetMs = (lng: number) =>
  Math.round(lng / DEGREES_PER_HOUR) * 3600 * 1000;

const vKind = v.union(v.literal("place"), v.literal("event"));
const vTargetId = v.union(v.id("places"), v.id("events"));

type TargetId = Id<"places"> | Id<"events">;
type BucketItem = {
  id: TargetId;
  kind: "place" | "event";
  name: string;
  score: number;
  position: number;
};

function bucketScore(bucket: Bucket, position: number, count: number) {
  const [low, high] = BUCKET_RANGE[bucket];
  const score = high - ((position - 0.5) * (high - low)) / count;
  return Math.round(score * 10) / 10;
}

async function loadTarget(
  ctx: QueryCtx,
  kind: "place" | "event",
  id: TargetId,
): Promise<{
  name: string;
  category: Category;
  city?: string;
  lng: number;
} | null> {
  if (kind === "place") {
    const place = await ctx.db.get("places", id as Id<"places">);
    return (
      place && {
        name: place.name,
        category: place.category,
        city: place.city,
        lng: place.lng,
      }
    );
  }
  const event = await ctx.db.get("events", id as Id<"events">);
  return (
    event && {
      name: event.title,
      category: event.category,
      city: event.city,
      lng: event.lng,
    }
  );
}

export const listInBucket = query({
  args: { category: categoryValidator, bucket: bucketValidator },
  handler: async (ctx, { category, bucket }): Promise<BucketItem[]> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const rankings = await ctx.db
      .query("rankings")
      .withIndex("by_user_category", (q) =>
        q.eq("userId", userId).eq("category", category),
      )
      .collect();
    const inBucket = rankings
      .filter((ranking) => ranking.bucket === bucket)
      .sort((a, b) => a.position - b.position);
    const items: BucketItem[] = [];
    for (const ranking of inBucket) {
      const kind = ranking.placeId !== undefined ? "place" : "event";
      const id = ranking.placeId ?? ranking.eventId;
      const target = id === undefined ? null : await loadTarget(ctx, kind, id);
      if (id === undefined || target === null) {
        continue;
      }
      items.push({
        id,
        kind,
        name: target.name,
        score: ranking.score,
        position: ranking.position,
      });
    }
    return items;
  },
});

export const rank = mutation({
  args: {
    kind: vKind,
    id: vTargetId,
    bucket: bucketValidator,
    position: v.number(),
    comparisons: v.array(v.object({ winnerId: vTargetId, loserId: vTargetId })),
    tags: v.array(v.string()),
    caption: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args): Promise<RankResult> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const { kind, id, bucket, comparisons, tags } = args;
    if (comparisons.length > MAX_COMPARISONS) {
      throw new Error("Too many comparisons");
    }
    const target = await loadTarget(ctx, kind, id);
    if (target === null) {
      throw new Error("That place or event no longer exists");
    }
    const user = await ctx.db.get("users", userId);
    const { category } = target;
    const now = Date.now();
    const local = new Date(now + localOffsetMs(target.lng));
    const homeCity = user?.homeCity?.trim().toLowerCase();
    const targetCity = target.city?.trim().toLowerCase();
    const dayOfWeek = local.getUTCDay();
    const hour = local.getUTCHours();

    const mine = await ctx.db
      .query("rankings")
      .withIndex("by_user_category", (q) =>
        q.eq("userId", userId).eq("category", category),
      )
      .collect();
    const existing = mine.find(
      (ranking) => (ranking.placeId ?? ranking.eventId) === id,
    );
    const others = mine.filter((ranking) => ranking !== existing);
    const rankedIds = new Set(
      others.map((ranking) => ranking.placeId ?? ranking.eventId),
    );
    for (const { winnerId, loserId } of comparisons) {
      const other = winnerId === id ? loserId : winnerId;
      if ((winnerId !== id && loserId !== id) || !rankedIds.has(other)) {
        throw new Error(
          "Each comparison must be between this item and one you already ranked in the same category",
        );
      }
    }

    const fields = {
      bucket,
      position: 0,
      score: 0,
      tags,
      visitedAt: now,
      wasLocal: !!homeCity && homeCity === targetCity,
      dayOfWeek,
      hour,
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

    let score = 0;
    let position = 0;
    let rankedAbove = 0;
    for (const current of BUCKET_ORDER) {
      const ordered: { _id: Id<"rankings">; position: number; score: number }[] =
        others
          .filter((ranking) => ranking.bucket === current)
          .sort((a, b) => a.position - b.position);
      if (current === bucket) {
        const index = Math.min(
          ordered.length,
          Math.max(0, Math.round(args.position) - 1),
        );
        ordered.splice(index, 0, { _id: rankingId, position: 0, score: 0 });
      }
      for (const [index, ranking] of ordered.entries()) {
        const nextScore = bucketScore(current, index + 1, ordered.length);
        if (ranking.position !== index + 1 || ranking.score !== nextScore) {
          await ctx.db.patch("rankings", ranking._id, {
            position: index + 1,
            score: nextScore,
          });
        }
        if (ranking._id === rankingId) {
          score = nextScore;
          position = rankedAbove + index + 1;
        }
      }
      rankedAbove += ordered.length;
    }

    for (const { winnerId, loserId } of comparisons) {
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

    for (const { winnerId, loserId } of comparisons) {
      await applyComparison(ctx, userId, winnerId, loserId);
    }
    await applyBucket(ctx, userId, id, bucket);

    const post = {
      photos: args.photoStorageId === undefined ? [] : [args.photoStorageId],
      caption: args.caption,
      visibility: "friends" as const,
      createdAt: now,
    };
    const previousPost =
      existing === undefined
        ? null
        : await ctx.db
            .query("posts")
            .withIndex("by_ranking", (q) => q.eq("rankingId", rankingId))
            .first();
    if (previousPost === null) {
      await ctx.db.insert("posts", {
        userId,
        rankingId,
        targetKind: kind,
        targetId: id,
        ...post,
      });
    } else {
      await ctx.db.patch("posts", previousPost._id, post);
    }

    const friendships = [
      ...(await ctx.db
        .query("friendships")
        .withIndex("by_userA", (q) =>
          q.eq("userA", userId).eq("status", "accepted"),
        )
        .collect()),
      ...(await ctx.db
        .query("friendships")
        .withIndex("by_userB", (q) =>
          q.eq("userB", userId).eq("status", "accepted"),
        )
        .collect()),
    ];
    const friendIds = new Set(
      friendships.map((friendship) =>
        friendship.userA === userId ? friendship.userB : friendship.userA,
      ),
    );
    const sameTarget =
      kind === "place"
        ? await ctx.db
            .query("rankings")
            .withIndex("by_place", (q) => q.eq("placeId", id as Id<"places">))
            .collect()
        : await ctx.db
            .query("rankings")
            .withIndex("by_event", (q) => q.eq("eventId", id as Id<"events">))
            .collect();
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
            ? (args.caption ?? `#${position} of their ${CATEGORY_NOUN[category]}`)
            : `…and you gave it ${friendScore.toFixed(1)}`,
        link: `/venue/${kind}/${id}`,
        actorId: userId,
      });
    }

    return {
      rankingId,
      score,
      position,
      outOf: rankedAbove,
      label: `#${position} of your ${CATEGORY_NOUN[category]} · ${score.toFixed(1)}`,
    };
  },
});
