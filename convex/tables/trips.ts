import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Owner: People session. A trip (or any group: "Friday night", "Tokyo in March") and its members. */
export const tripsTables = {
  trips: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    createdAt: v.number(),
    city: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    vibe: v.optional(v.string()),
  }).index("by_owner", ["ownerId"]),

  tripMembers: defineTable({
    tripId: v.id("trips"),
    userId: v.id("users"),
    status: v.union(v.literal("invited"), v.literal("joined"), v.literal("declined")),
    createdAt: v.number(),
    invitedBy: v.optional(v.id("users")),
  })
    .index("by_trip", ["tripId", "status"])
    .index("by_user", ["userId", "status"]),

  tripVotes: defineTable({
    tripId: v.id("trips"),
    userId: v.id("users"),
    targetKind: v.union(v.literal("place"), v.literal("event")),
    targetId: v.union(v.id("places"), v.id("events")),
    vote: v.number(),   // 1 or -1; the first +1 puts the item on the shortlist
    createdAt: v.number(),
  })
    .index("by_trip", ["tripId"])
    .index("by_trip_user", ["tripId", "userId"]),
};
