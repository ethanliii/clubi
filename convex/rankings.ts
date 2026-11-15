import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { RankResult } from "./lib/contract";
import { categoryValidator } from "./tables/catalog";
import { bucketValidator } from "./tables/people";

const vTargetId = v.union(v.id("places"), v.id("events"));

type BucketItem = {
  id: Id<"places"> | Id<"events">;
  kind: "place" | "event";
  name: string;
  score: number;
  position: number;
};

export const listInBucket = query({
  args: { category: categoryValidator, bucket: bucketValidator },
  handler: async (): Promise<BucketItem[]> => {
    return [];
  },
});

export const rank = mutation({
  args: {
    kind: v.union(v.literal("place"), v.literal("event")),
    id: vTargetId,
    bucket: bucketValidator,
    position: v.number(),
    comparisons: v.array(v.object({ winnerId: vTargetId, loserId: vTargetId })),
    tags: v.array(v.string()),
    caption: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (): Promise<RankResult> => {
    throw new Error("not yet");
  },
});
