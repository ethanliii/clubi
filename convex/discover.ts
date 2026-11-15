import { v } from "convex/values";
import { query } from "./_generated/server";
import type { NearbyItem, NearbyResult } from "./lib/contract";
import {
  ALGO, ATTRIBUTION, DEFAULT_LIMIT, DEFAULT_RADIUS_METERS,
  loadCandidates, matchesFilter, rankItems, scoreCandidate, viewerTaste,
} from "./lib/discovery";

const filterValidator = v.union(
  v.literal("tonight"), v.literal("bars"), v.literal("food"), v.literal("events"),
  v.literal("popups"), v.literal("outdoors"), v.literal("all"),
);

export const nearby = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusMeters: v.optional(v.number()),
    filter: v.optional(filterValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<NearbyResult> => {
    const now = Date.now();
    const filter = args.filter ?? "all";
    const taste = await viewerTaste(ctx);
    const candidates = await loadCandidates(ctx, args.lat, args.lng, args.radiusMeters ?? DEFAULT_RADIUS_METERS, now);
    const scored = candidates
      .map((c) => scoreCandidate(c, taste, args.lat, args.lng))
      .filter((item) => matchesFilter(item, filter, now));
    return {
      items: rankItems(scored, args.limit ?? DEFAULT_LIMIT),
      center: { lat: args.lat, lng: args.lng },
      algo: ALGO,
      generatedAt: now,
      attribution: ATTRIBUTION,
    };
  },
});

export const tonight = query({
  args: { lat: v.number(), lng: v.number() },
  handler: async (ctx, args): Promise<{ topPicks: NearbyItem[]; friendsGoing: NearbyItem[]; events: NearbyItem[] }> => {
    const now = Date.now();
    const taste = await viewerTaste(ctx);
    const candidates = await loadCandidates(ctx, args.lat, args.lng, DEFAULT_RADIUS_METERS, now);
    const scored = candidates.map((c) => scoreCandidate(c, taste, args.lat, args.lng));
    return {
      topPicks: rankItems(scored.filter((item) => matchesFilter(item, "tonight", now)), 6),
      friendsGoing: [],
      events: rankItems(scored.filter((item) => matchesFilter(item, "events", now) || item.category === "popup"), 10),
    };
  },
});
