import { v } from "convex/values";
import { query } from "./_generated/server";
import type { NearbyItem, Tier, VenueDetail } from "./lib/contract";
import { DEMO_COORDS } from "./lib/demo";
import {
  Candidate, DEFAULT_RADIUS_METERS, loadCandidates, rankItems, scoreCandidate, venueVectorOf, viewerTaste,
} from "./lib/discovery";
import { FEATURES, FEATURE_PHRASES } from "./lib/recs";

const SEARCH_LIMIT = 10;
const BREAKDOWN_SIZE = 4;
const TOP_SCORE = 8.5;
const GOOD_SCORE = 7;

export const get = query({
  args: {
    kind: v.union(v.literal("place"), v.literal("event")),
    id: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<VenueDetail | null> => {
    let candidate: Candidate;
    if (args.kind === "place") {
      const id = ctx.db.normalizeId("places", args.id);
      const doc = id === null ? null : await ctx.db.get(id);
      if (doc === null) return null;
      candidate = { kind: "place", doc };
    } else {
      const id = ctx.db.normalizeId("events", args.id);
      const doc = id === null ? null : await ctx.db.get(id);
      if (doc === null) return null;
      candidate = { kind: "event", doc };
    }
    const taste = await viewerTaste(ctx);
    const { order, ...item } = scoreCandidate(candidate, taste, args.lat ?? DEMO_COORDS.lat, args.lng ?? DEMO_COORDS.lng);
    const f = venueVectorOf(candidate.doc);
    const tier: Tier = item.score >= TOP_SCORE ? "top" : item.score >= GOOD_SCORE ? "good" : "other";
    const breakdown = FEATURES.map((k, i) => ({ label: FEATURE_PHRASES[k], value: Math.round(taste[i] * f[i] * 100) / 10 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, BREAKDOWN_SIZE)
      .map((b) => ({ label: b.label[0].toUpperCase() + b.label.slice(1), value: b.value }));
    return {
      ...item,
      rank: 1,
      tier,
      address: candidate.doc.address,
      hours: candidate.kind === "place" ? candidate.doc.hours : undefined,
      tags: candidate.doc.tags ?? [],
      breakdown,
      friendRankings: [],
      ticketUrl: candidate.kind === "event" ? candidate.doc.ticketUrl : undefined,
    };
  },
});

export const search = query({
  args: { text: v.string(), lat: v.number(), lng: v.number() },
  handler: async (ctx, args): Promise<NearbyItem[]> => {
    const now = Date.now();
    const text = args.text.trim();
    const taste = await viewerTaste(ctx);
    let candidates: Candidate[];
    if (text === "") {
      candidates = await loadCandidates(ctx, args.lat, args.lng, DEFAULT_RADIUS_METERS, now);
    } else {
      const places = await ctx.db
        .query("places")
        .withSearchIndex("search_name", (q) => q.search("name", text))
        .take(SEARCH_LIMIT * 2);
      const events = await ctx.db
        .query("events")
        .withSearchIndex("search_title", (q) => q.search("title", text))
        .take(SEARCH_LIMIT * 2);
      candidates = [
        ...places.map((doc) => ({ kind: "place" as const, doc })),
        ...events.filter((e) => (e.end ?? e.start) > now).map((doc) => ({ kind: "event" as const, doc })),
      ];
    }
    return rankItems(candidates.map((c) => scoreCandidate(c, taste, args.lat, args.lng)), SEARCH_LIMIT);
  },
});
