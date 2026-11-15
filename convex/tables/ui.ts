// Owner: Bryan (UI). Tables added for the UI merge (docs/BRYAN-UI.md). Only optional, additive data:
// nothing here changes a table another session owns.
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const uiTables = {
  // The full onboarding quiz (song stars, this-or-that, scenarios, hot takes, nights, filters...).
  // users.saveQuiz still gets the 6-card mapping; this keeps the raw answers for the taste model (ask E1).
  quizExtras: defineTable({
    userId: v.id("users"),
    answers: v.any(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Public accounts can be followed without a request (decision Q20). Private accounts keep friend requests.
  accountPrivacy: defineTable({
    userId: v.id("users"),
    isPublic: v.boolean(),
  }).index("by_user", ["userId"]),

  follows: defineTable({
    followerId: v.id("users"),
    followeeId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_follower", ["followerId"])
    .index("by_followee", ["followeeId"])
    .index("by_pair", ["followerId", "followeeId"]),

  // Pinned favorites on a profile: up to 9 of my own posts, in my order (ask E13).
  profilePins: defineTable({
    userId: v.id("users"),
    postIds: v.array(v.id("posts")),
  }).index("by_user", ["userId"]),
};
