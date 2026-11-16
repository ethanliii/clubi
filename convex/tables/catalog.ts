import { defineTable } from "convex/server";
import { v } from "convex/values";

export const categoryValidator = v.union(
  v.literal("nightlife"),
  v.literal("food"),
  v.literal("culture"),
  v.literal("outdoors"),
  v.literal("live"),
  v.literal("popup"),
);

export const sourceValidator = v.union(
  v.literal("seed"),
  v.literal("osm"),
  v.literal("ticketmaster"),
  v.literal("luma"),
  v.literal("partiful"),
  v.literal("manual"),
  v.literal("eventbrite"),
  v.literal("google"),
);

export const catalogTables = {
  places: defineTable({
    name: v.string(),
    category: categoryValidator,
    lat: v.number(),
    lng: v.number(),
    subcategory: v.optional(v.string()),
    address: v.optional(v.string()),
    hours: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    source: v.optional(sourceValidator),
    sourceId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    blurb: v.optional(v.string()),
    priceLevel: v.optional(v.number()),
    venueVector: v.optional(v.array(v.number())),
    elo: v.optional(v.number()),
    nComparisons: v.optional(v.number()),
    city: v.optional(v.string()),
    // v2 (Data): enrichment, all optional
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    externalRating: v.optional(v.number()),
    externalRatingCount: v.optional(v.number()),
    googlePlaceId: v.optional(v.string()),
    // Set together with imageUrl when the image is a Google Places photo copied into file storage
    // (imports/google.ts): the credit Google requires, and the stored file.
    imageAttribution: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    // v2 (Brain writes it): venueVector blended with what visitors answered. Imports must never clear it.
    learnedVector: v.optional(v.array(v.number())),
  })
    .index("by_source", ["source", "sourceId"])
    .index("by_category", ["category"])
    .index("by_lat", ["lat"])
    .searchIndex("search_name", { searchField: "name" }),

  events: defineTable({
    title: v.string(),
    start: v.number(),
    category: categoryValidator,
    lat: v.number(),
    lng: v.number(),
    end: v.optional(v.number()),
    placeId: v.optional(v.id("places")),
    subcategory: v.optional(v.string()),
    address: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    price: v.optional(v.union(v.number(), v.string())),
    imageUrl: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    source: v.optional(sourceValidator),
    sourceId: v.optional(v.string()),
    venueVector: v.optional(v.array(v.number())),
    elo: v.optional(v.number()),
    nComparisons: v.optional(v.number()),
    blurb: v.optional(v.string()),
    city: v.optional(v.string()),
    // v2 (Data): all optional
    venueName: v.optional(v.string()),
    performerNames: v.optional(v.array(v.string())),
    createdAt: v.optional(v.number()),
    learnedVector: v.optional(v.array(v.number())),
    // v2 (Data): the same event's pages on other sources ("also on Eventbrite"), when two sources list it
    otherUrls: v.optional(v.array(v.string())),
  })
    .index("by_source", ["source", "sourceId"])
    .index("by_category", ["category"])
    .index("by_lat", ["lat"])
    .index("by_start", ["start"])
    .searchIndex("search_title", { searchField: "title" }),

  appConfig: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),
};
