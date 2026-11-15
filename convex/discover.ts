import { v } from "convex/values";
import { query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import type { Category, NearbyItem, NearbyResult, PlanMember, PlanResult, PlanSlot, PlanStop } from "./lib/contract";
import {
  ALGO, ATTRIBUTION, DEFAULT_LIMIT, DEFAULT_RADIUS_METERS, Scored,
  avatarUrlOf, displayNameOf, haversineMeters, isUnder21, isVisibleTo, loadInRadius, loadViewer, matchesFilter,
  nearestMatching, rankItems, sameCity, scoreAll, tasteOf, userLoader,
} from "./lib/discovery";
import { FEATURES, clip, groupScore, mapRank, matchPct, predict, topFeatures, whyFromFeatures } from "./lib/recs";

const TOP_PICKS = 6;
const SECTION_SIZE = 10;
const MAX_PLAN_MEMBERS = 8;
const PLAN_VIBE_WEIGHT = 6;
const DEFAULT_VIBE = "balanced";
const ENERGY = FEATURES.indexOf("energy");

const PLAN_SLOTS: { slot: PlanSlot; label: string; categories: Category[] }[] = [
  { slot: "early", label: "Start", categories: ["food", "culture", "outdoors"] },
  { slot: "mid", label: "Then", categories: ["nightlife", "live", "popup"] },
  { slot: "late", label: "End the night", categories: ["nightlife", "live"] },
];

/** The energy each stop aims for, early to late. */
const VIBE_ENERGY: Record<string, [number, number, number]> = {
  chill: [0.3, 0.35, 0.45],
  balanced: [0.4, 0.6, 0.75],
  wild: [0.5, 0.75, 0.95],
};

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

/**
 * Three stops for the viewer and the accepted friends they pick, each chosen by the group score
 * (half the average, half the least happy member) and by how well its energy fits the vibe and the hour.
 */
export const plan = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    memberIds: v.optional(v.array(v.id("users"))),
    vibe: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<PlanResult> => {
    const now = Date.now();
    const vibe = args.vibe !== undefined && args.vibe in VIBE_ENERGY ? args.vibe : DEFAULT_VIBE;
    const viewer = await loadViewer(ctx, now);
    const getUser = userLoader(ctx);
    const group: Doc<"users">[] = [];
    const wanted = viewer.userId === null ? [] : [viewer.userId, ...(args.memberIds ?? []).filter((id) => viewer.friendIds.has(id))];
    for (const id of [...new Set(wanted)].slice(0, MAX_PLAN_MEMBERS)) {
      const user = await getUser(id);
      if (user !== null) group.push(user);
    }
    const anyUnder21 = viewer.under21 || group.some((user) => isUnder21(user.birthday, now));

    const pool = await loadInRadius(ctx, args.lat, args.lng, DEFAULT_RADIUS_METERS, now);
    const candidates = nearestMatching(pool, (c) => !(anyUnder21 && c.doc.category === "nightlife"));
    const cityOf = new Map<string, string | undefined>(candidates.map((c) => [c.doc._id, c.doc.city]));
    const scored = await scoreAll(ctx, candidates, viewer, args.lat, args.lng, now);

    const scoreFor = (s: Scored, user: Doc<"users">) => {
      if (user._id === viewer.userId) return s.terms.score;
      const own = (viewer.knownRankings.get(s.item.id) ?? []).find((r) => r.userId === user._id);
      if (own !== undefined) return clip(own.score, 1, 10);
      const others = s.raters.filter((r) => r.userId !== user._id);
      return predict(tasteOf(user), s.vector, s.terms.elo, others, sameCity(user.homeCity, cityOf.get(s.item.id))).score;
    };
    const options = scored.flatMap((s) => {
      const scores = group.length === 0 ? [s.terms.score] : group.map((user) => scoreFor(s, user));
      const together = groupScore(scores);
      return together === null ? [] : [{ s, scores, together }];
    });
    const groupTaste = FEATURES.map((_, k) => group.reduce((sum, user) => sum + tasteOf(user)[k], 0) / Math.max(1, group.length));

    const stops: PlanStop[] = [];
    const used = new Set<string>();
    let from = { lat: args.lat, lng: args.lng };
    for (const [index, def] of PLAN_SLOTS.entries()) {
      const free = options.filter((o) => !used.has(o.s.item.id));
      const fitting = free.filter((o) => def.categories.includes(o.s.item.category));
      const value = (o: (typeof options)[number]) =>
        mapRank(o.together, haversineMeters(from.lat, from.lng, o.s.item.lat, o.s.item.lng), 0)
        - PLAN_VIBE_WEIGHT * Math.abs(o.s.vector[ENERGY] - VIBE_ENERGY[vibe][index]);
      const best = (fitting.length > 0 ? fitting : free).sort((a, b) => value(b) - value(a))[0];
      if (best === undefined) break;
      const { item, vector } = best.s;
      used.add(item.id);
      from = { lat: item.lat, lng: item.lng };
      const score = Math.round(best.together * 10) / 10;
      stops.push({
        ...item,
        score,
        matchPct: matchPct(score),
        why: group.length < 2
          ? item.why
          : `${whyFromFeatures(topFeatures(groupTaste, vector))} · everyone ${(Math.floor(Math.min(...best.scores) * 10) / 10).toFixed(1)}+`,
        rank: index + 1,
        tier: "top",
        slot: def.slot,
        slotLabel: def.label,
        memberScores: group.map((user, i) => ({ ...memberOf(user), score: Math.round(best.scores[i] * 10) / 10 })),
      });
    }
    return {
      stops,
      members: group.map(memberOf),
      vibe,
      center: { lat: args.lat, lng: args.lng },
      algo: ALGO,
      generatedAt: now,
    };
  },
});

const memberOf = (user: Doc<"users">): PlanMember => ({
  userId: user._id,
  displayName: displayNameOf(user),
  avatarUrl: avatarUrlOf(user),
});
