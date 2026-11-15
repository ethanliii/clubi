import { v } from "convex/values";
import { query } from "./_generated/server";
import type { NearbyItem, NearbyResult } from "./lib/contract";
import {
  ALGO, ATTRIBUTION, DEFAULT_LIMIT, DEFAULT_RADIUS_METERS,
  isVisibleTo, loadInRadius, loadViewer, matchesFilter, nearestMatching, rankItems, scoreAll,
} from "./lib/discovery";

const TOP_PICKS = 6;
const SECTION_SIZE = 10;

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
    const viewer = await loadViewer(ctx, now);
    const pool = await loadInRadius(ctx, args.lat, args.lng, args.radiusMeters ?? DEFAULT_RADIUS_METERS, now);
    const candidates = nearestMatching(pool, (c) => isVisibleTo(c, viewer, now) && matchesFilter(c, filter, now));
    const scored = await scoreAll(ctx, candidates, viewer, args.lat, args.lng, now);
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
    const viewer = await loadViewer(ctx, now);
    const pool = await loadInRadius(ctx, args.lat, args.lng, DEFAULT_RADIUS_METERS, now);
    const tonightPool = pool.filter((c) => isVisibleTo(c, viewer, now) && matchesFilter(c, "tonight", now));
    const nearest = nearestMatching(tonightPool, () => true);
    const eventish = nearestMatching(tonightPool, (c) => c.kind === "event" || c.doc.category === "live" || c.doc.category === "popup");
    const scored = await scoreAll(ctx, [...new Set([...nearest, ...eventish])], viewer, args.lat, args.lng, now);
    const nearestIds = new Set<string>(nearest.map((c) => c.doc._id));
    const eventishIds = new Set<string>(eventish.map((c) => c.doc._id));
    return {
      topPicks: rankItems(scored.filter((s) => nearestIds.has(s.item.id)), TOP_PICKS),
      friendsGoing: rankItems(scored.filter((s) => s.item.friends.length > 0), SECTION_SIZE),
      events: rankItems(scored.filter((s) => eventishIds.has(s.item.id)), SECTION_SIZE),
    };
  },
});
