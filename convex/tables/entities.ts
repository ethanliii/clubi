import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Owner: Data session. Performers (artists, DJs, teams, hosts) and who likes them. */
export const entitiesTables = {
  performers: defineTable({
    name: v.string(),
    normalizedName: v.string(),
    kind: v.optional(v.string()),            // artist, dj, band, team, comedian, host
    genres: v.optional(v.array(v.string())),
    imageUrl: v.optional(v.string()),
    source: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    vector: v.optional(v.array(v.number())), // 13 features, same order as FEATURES
  })
    .index("by_normalizedName", ["normalizedName"])
    .searchIndex("search_name", { searchField: "name" }),

  eventPerformers: defineTable({
    eventId: v.id("events"),
    performerId: v.id("performers"),
    start: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_performer", ["performerId", "start"]),

  // How much a user likes a performer: from ranking their events (score) or an explicit follow.
  affinities: defineTable({
    userId: v.id("users"),
    performerId: v.id("performers"),
    score: v.number(),                       // 0–10
    following: v.boolean(),
    updatedAt: v.number(),
    nRankings: v.optional(v.number()),
    lastNotifiedEventId: v.optional(v.id("events")),
  })
    .index("by_user", ["userId"])
    .index("by_performer", ["performerId"])
    .index("by_user_performer", ["userId", "performerId"])
    // v2 (Data): the catch-up alert reads affinities that changed in the last day.
    .index("by_updatedAt", ["updatedAt"]),
};
