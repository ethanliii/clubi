import { defineTable } from "convex/server";
import { v } from "convex/values";

export const socialTables = {
  moments: defineTable({
    authorId: v.id("users"),
    text: v.string(),
  }).index("by_author", ["authorId"]),

  posts: defineTable({
    userId: v.id("users"),
    targetKind: v.union(v.literal("place"), v.literal("event")),
    targetId: v.union(v.id("places"), v.id("events")),
    createdAt: v.number(),
    rankingId: v.optional(v.id("rankings")),
    photos: v.optional(v.array(v.id("_storage"))),
    caption: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("friends"), v.literal("public"), v.literal("private"))),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_target", ["targetId"])
    .index("by_ranking", ["rankingId"]),

  friendships: defineTable({
    userA: v.id("users"),
    userB: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined")),
  })
    .index("by_userA", ["userA", "status"])
    .index("by_userB", ["userB", "status"]),

  reactions: defineTable({
    postId: v.id("posts"),
    userId: v.id("users"),
    emoji: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  })
    .index("by_post", ["postId"])
    .index("by_user", ["userId"]),

  // v2 (People)
  comments: defineTable({
    postId: v.id("posts"),
    userId: v.id("users"),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_post", ["postId", "createdAt"]),

  // "want" = saved for later, "going" = I'm going to this event
  saves: defineTable({
    userId: v.id("users"),
    targetKind: v.union(v.literal("place"), v.literal("event")),
    targetId: v.union(v.id("places"), v.id("events")),
    type: v.union(v.literal("want"), v.literal("going")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "type"])
    .index("by_target", ["targetId", "type"]),
};
