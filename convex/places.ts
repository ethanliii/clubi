import { v } from "convex/values";
import { query } from "./_generated/server";
import type { NearbyItem, Tier, VenueDetail } from "./lib/contract";
import {
  Candidate, DEFAULT_RADIUS_METERS, friendScoreOf, isPastEvent, isVisibleTo, loadInRadius, loadViewer,
  nearestMatching, rankItems, scoreAll, scoreCandidate, userLoader,
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
    const now = Date.now();
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
    const { doc } = candidate;
    const viewer = await loadViewer(ctx, now);
    if (viewer.under21 && doc.category === "nightlife") return null;

    const scored = await scoreCandidate(ctx, candidate, viewer, args.lat ?? doc.lat, args.lng ?? doc.lng, now, userLoader(ctx));
    const { item, vector, mine, friendRows } = scored;
    const tier: Tier = item.score >= TOP_SCORE ? "top" : item.score >= GOOD_SCORE ? "good" : "other";
    const breakdown = FEATURES.map((k, i) => ({ label: FEATURE_PHRASES[k], value: Math.round(viewer.taste[i] * vector[i] * 100) / 10 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, BREAKDOWN_SIZE)
      .map((b) => ({ label: b.label[0].toUpperCase() + b.label.slice(1), value: b.value }));

    const friendRankings = await Promise.all(friendRows.map(async (row) => {
      const post = await ctx.db
        .query("posts")
        .withIndex("by_ranking", (q) => q.eq("rankingId", row.ranking._id))
        .first();
      const photo = post?.photos?.[0];
      return {
        ...friendScoreOf(row),
        caption: post?.caption,
        when: row.ranking.visitedAt ?? row.ranking._creationTime,
        photoUrl: photo === undefined ? undefined : (await ctx.storage.getUrl(photo)) ?? undefined,
      };
    }));

    let myRanking: VenueDetail["myRanking"];
    if (mine !== null && viewer.userId !== null) {
      const userId = viewer.userId;
      const inCategory = await ctx.db
        .query("rankings")
        .withIndex("by_user_category", (q) => q.eq("userId", userId).eq("category", mine.category))
        .collect();
      myRanking = {
        score: item.score,
        position: inCategory.filter((r) => r.score > mine.score).length + 1,
        outOf: inCategory.length,
        bucket: mine.bucket,
      };
    }

    return {
      ...item,
      rank: 1,
      tier,
      address: doc.address,
      hours: candidate.kind === "place" ? candidate.doc.hours : undefined,
      tags: doc.tags ?? [],
      breakdown,
      friendRankings,
      ticketUrl: candidate.kind === "event" ? candidate.doc.ticketUrl : undefined,
      myRanking,
    };
  },
});

export const search = query({
  args: { text: v.string(), lat: v.number(), lng: v.number() },
  handler: async (ctx, args): Promise<NearbyItem[]> => {
    const now = Date.now();
    const text = args.text.trim();
    const viewer = await loadViewer(ctx, now);
    let pool: Candidate[];
    if (text === "") {
      pool = await loadInRadius(ctx, args.lat, args.lng, DEFAULT_RADIUS_METERS, now);
    } else {
      const places = await ctx.db
        .query("places")
        .withSearchIndex("search_name", (q) => q.search("name", text))
        .take(SEARCH_LIMIT * 2);
      const events = await ctx.db
        .query("events")
        .withSearchIndex("search_title", (q) => q.search("title", text))
        .take(SEARCH_LIMIT * 2);
      pool = [
        ...places.map((doc) => ({ kind: "place" as const, doc })),
        ...events.filter((e) => !isPastEvent(e, now)).map((doc) => ({ kind: "event" as const, doc })),
      ];
    }
    const candidates = nearestMatching(pool, (c) => !(viewer.under21 && c.doc.category === "nightlife") && (text !== "" || isVisibleTo(c, viewer, now)));
    return rankItems(await scoreAll(ctx, candidates, viewer, args.lat, args.lng, now), SEARCH_LIMIT);
  },
});
