import { v } from "convex/values";
import { query } from "./_generated/server";
import type { NearbyItem, Tier, VenueDetail } from "./lib/contract";
import {
  Candidate, DEFAULT_RADIUS_METERS, MAX_RATERS_PER_ITEM, friendScoreOf, getCandidate, isPastEvent, isVisibleTo, loadInRadius,
  loadViewer, nearestMatching, rankItems, scoreAll, scoreCandidate, userLoader,
} from "./lib/discovery";
import { Counts, summarize } from "./lib/insights";
import { FEATURES, FEATURE_PHRASES, shownScore } from "./lib/recs";

const SEARCH_LIMIT = 10;
/** My list in one category, read to place a ranking in it. The same cap as People's MAX_RANKINGS_PER_CATEGORY. */
const MAX_RANKINGS_PER_CATEGORY = 500;
/** How far a venue page counts rankings: the same cap as insights.venue's nRatings, so the two agree. */
const MAX_RATINGS_COUNTED = 500;
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
    const candidate = await getCandidate(ctx, args.kind, args.id);
    if (candidate === null) return null;
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

    // friendRows holds only rankings the viewer may see: a friend's "Only me" ranking never gets here.
    const friendRankings = await Promise.all(friendRows.map(async (row) => {
      const post = row.post;
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
        .take(MAX_RANKINGS_PER_CATEGORY);
      myRanking = {
        // The score my ranking has (a "didn't like" can be under 1), the same number my profile list shows.
        score: shownScore(mine.score),
        position: inCategory.filter((r) => r.score > mine.score).length + 1,
        outOf: inCategory.length,
        bucket: mine.bucket,
      };
    }

    // What visitors answered after rating it: the same summary insights.venue returns. Totals only, and
    // nothing is stated from fewer than 5 people.
    const stats = await ctx.db
      .query("venueStats")
      .withIndex("by_target", (q) => q.eq("targetId", doc._id))
      .first();
    const summary = stats === null ? null : summarize(doc.category, stats.counts as Counts | undefined, stats.nAnswers);
    const insights = summary === null ? undefined : { highlights: summary.highlights, bestFor: summary.bestFor };

    // On a card ratingCount stops at the crowd sample; here it is counted as far as insights.venue counts.
    let ratingCount = item.ratingCount;
    if ((ratingCount ?? 0) >= MAX_RATERS_PER_ITEM) {
      const all = candidate.kind === "place"
        ? await ctx.db.query("rankings").withIndex("by_place", (q) => q.eq("placeId", candidate.doc._id)).take(MAX_RATINGS_COUNTED)
        : await ctx.db.query("rankings").withIndex("by_event", (q) => q.eq("eventId", candidate.doc._id)).take(MAX_RATINGS_COUNTED);
      ratingCount = Math.max(ratingCount ?? 0, all.length);
    }

    // `item` already carries saved, going and performers.
    return {
      ...item,
      ratingCount,
      rank: 1,
      tier,
      address: doc.address,
      hours: candidate.kind === "place" ? candidate.doc.hours : undefined,
      tags: doc.tags ?? [],
      breakdown,
      friendRankings,
      ticketUrl: candidate.kind === "event" ? candidate.doc.ticketUrl : undefined,
      myRanking,
      insights,
      website: candidate.kind === "place" ? candidate.doc.website : undefined,
      phone: candidate.kind === "place" ? candidate.doc.phone : undefined,
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
