import { defineTable } from "convex/server";
import { v } from "convex/values";
import { categoryValidator } from "./catalog";

export const bucketValidator = v.union(v.literal("loved"), v.literal("fine"), v.literal("didnt"));

export const notificationTypeValidator = v.union(
  v.literal("friend_posted"),
  v.literal("friend_ranked_same"),
  v.literal("event_tonight"),
  v.literal("friend_request"),
  v.literal("friend_accepted"),
  v.literal("artist_event"),
  v.literal("trip_invite"),
  v.literal("trip_update"),
  v.literal("post_reaction"),
  v.literal("post_comment"),
);

export const visibilityValidator = v.union(v.literal("friends"), v.literal("public"), v.literal("private"));

export const notifPrefsValidator = v.object({
  friendPosts: v.optional(v.boolean()),
  friendRequests: v.optional(v.boolean()),
  eventsTonight: v.optional(v.boolean()),
  artistAlerts: v.optional(v.boolean()),
  tripUpdates: v.optional(v.boolean()),
  reactions: v.optional(v.boolean()),
});

export const peopleTables = {
  users: defineTable({
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
    birthday: v.optional(v.string()),
    homeCity: v.optional(v.string()),
    privacy: v.optional(v.string()),
    avatar: v.optional(v.string()),
    tasteVector: v.optional(v.array(v.number())),
    tastePrior: v.optional(v.array(v.number())),
    // v2 (People): settings, all optional
    bio: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    defaultVisibility: v.optional(visibilityValidator),
    discoverable: v.optional(v.boolean()),
    notifPrefs: v.optional(notifPrefsValidator),
  })
    .index("by_username", ["username"])
    .index("by_homeCity", ["homeCity"])
    .searchIndex("search_displayName", { searchField: "displayName" }),

  quizAnswers: defineTable({
    userId: v.id("users"),
    answers: v.array(v.array(v.number())),
  }).index("by_user", ["userId"]),

  rankings: defineTable({
    userId: v.id("users"),
    category: categoryValidator,
    bucket: bucketValidator,
    position: v.number(),
    score: v.number(),
    placeId: v.optional(v.id("places")),
    eventId: v.optional(v.id("events")),
    tags: v.optional(v.array(v.string())),
    // The 1.0 to 10.0 score the user gave directly, for one of their first five rankings in the
    // category (lib/social.ts, DIRECT_SCORE_RANKINGS). `score` is what is shown.
    manualScore: v.optional(v.number()),
    visitedAt: v.optional(v.number()),
    wasLocal: v.optional(v.boolean()),
    dayOfWeek: v.optional(v.number()),
    hour: v.optional(v.number()),
    groupSize: v.optional(v.number()),
  })
    .index("by_user_category", ["userId", "category"])
    .index("by_place", ["placeId"])
    .index("by_event", ["eventId"]),

  comparisons: defineTable({
    userId: v.id("users"),
    winnerId: v.union(v.id("places"), v.id("events")),
    loserId: v.union(v.id("places"), v.id("events")),
    category: categoryValidator,
    createdAt: v.number(),
    dayOfWeek: v.optional(v.number()),
    hour: v.optional(v.number()),
  }).index("by_user", ["userId", "createdAt"]),

  notifications: defineTable({
    userId: v.id("users"),
    type: notificationTypeValidator,
    title: v.string(),
    body: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
    link: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_read", ["userId", "read"])
    .index("by_actor", ["actorId"]),
};
