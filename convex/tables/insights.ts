import { defineTable } from "convex/server";
import { v } from "convex/values";
import { categoryValidator } from "./catalog";

/** Owner: Brain session. Answers to the multiple-choice questions asked right after a ranking. */
export const insightsTables = {
  // One row per question answered. Never shown with a name attached: only aggregates leave the backend.
  visitAnswers: defineTable({
    userId: v.id("users"),
    targetKind: v.union(v.literal("place"), v.literal("event")),
    targetId: v.union(v.id("places"), v.id("events")),
    category: categoryValidator,
    questionId: v.string(),
    optionIds: v.array(v.string()),
    createdAt: v.number(),
    rankingId: v.optional(v.id("rankings")),
    wasLocal: v.optional(v.boolean()),
    dayOfWeek: v.optional(v.number()),
    hour: v.optional(v.number()),
  })
    .index("by_target", ["targetId", "questionId"])
    .index("by_user", ["userId", "createdAt"])
    .index("by_ranking", ["rankingId"]),

  // Running totals per place or event, updated inside the submit mutation.
  venueStats: defineTable({
    targetKind: v.union(v.literal("place"), v.literal("event")),
    targetId: v.union(v.id("places"), v.id("events")),
    nAnswers: v.number(),
    counts: v.any(),                                   // { [questionId]: { [optionId]: count } }
    observedVector: v.optional(v.array(v.number())),   // 13 features measured from answers
    observedWeight: v.optional(v.array(v.number())),   // answers behind each feature
    updatedAt: v.number(),
  }).index("by_target", ["targetId"]),
};
