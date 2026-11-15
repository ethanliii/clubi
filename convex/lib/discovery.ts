import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";
import type { Category, Filter, NearbyItem, Tier } from "./contract";
import { FEATURES, NEUTRAL_TASTE, clip, contentScore, mapRank, matchPct, topFeatures, whyFromFeatures } from "./recs";

export const ALGO = "cosine-v1";
export const ATTRIBUTION = "© OpenStreetMap contributors";
export const DEFAULT_RADIUS_METERS = 2500;
export const DEFAULT_LIMIT = 60;
export const MAX_CANDIDATES = 200;
export const SCAN_LIMIT = 1500;
export const TOP_TIER_SIZE = 5;
export const GOOD_TIER_SIZE = 25;
export const EVENT_DEFAULT_LENGTH_MS = 3 * 60 * 60 * 1000;
export const TONIGHT_WINDOW_MS = 12 * 60 * 60 * 1000;
const METERS_PER_DEGREE = 111_320;

const CATEGORY_VECTORS: Record<Category, Partial<Record<(typeof FEATURES)[number], number>>> = {
  nightlife: { energy: 0.7, loudness: 0.6, crowdAge: 0.6, dancing: 0.5 },
  food: { food: 0.9 },
  culture: { culture: 0.9 },
  outdoors: { outdoors: 0.9 },
  live: { liveMusic: 0.9, energy: 0.7, loudness: 0.7 },
  popup: { energy: 0.6, crowdAge: 0.6, culture: 0.5, food: 0.5 },
};

export type Candidate = { kind: "place"; doc: Doc<"places"> } | { kind: "event"; doc: Doc<"events"> };
export type ScoredItem = Omit<NearbyItem, "rank" | "tier"> & { order: number };

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

export function venueVectorOf(doc: { venueVector?: number[]; category: Category }): number[] {
  if (doc.venueVector?.length === FEATURES.length) return doc.venueVector;
  const preset = CATEGORY_VECTORS[doc.category];
  return FEATURES.map((k) => preset[k] ?? 0.3);
}

export async function viewerTaste(ctx: QueryCtx): Promise<number[]> {
  const userId = await getAuthUserId(ctx);
  const user = userId === null ? null : await ctx.db.get(userId);
  return user?.tasteVector?.length === FEATURES.length ? user.tasteVector : NEUTRAL_TASTE;
}

export async function loadCandidates(ctx: QueryCtx, lat: number, lng: number, radiusMeters: number, now: number): Promise<Candidate[]> {
  const dLat = radiusMeters / METERS_PER_DEGREE;
  const dLng = radiusMeters / (METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
  const places = await ctx.db
    .query("places")
    .withIndex("by_lat", (q) => q.gte("lat", lat - dLat).lte("lat", lat + dLat))
    .filter((q) => q.and(q.gte(q.field("lng"), lng - dLng), q.lte(q.field("lng"), lng + dLng)))
    .take(SCAN_LIMIT);
  const events = await ctx.db
    .query("events")
    .withIndex("by_lat", (q) => q.gte("lat", lat - dLat).lte("lat", lat + dLat))
    .filter((q) => q.and(q.gte(q.field("lng"), lng - dLng), q.lte(q.field("lng"), lng + dLng)))
    .take(SCAN_LIMIT);
  const upcoming = events.filter((e) => (e.end ?? e.start + EVENT_DEFAULT_LENGTH_MS) > now);
  const all: Candidate[] = [
    ...places.map((doc) => ({ kind: "place" as const, doc })),
    ...upcoming.map((doc) => ({ kind: "event" as const, doc })),
  ];
  return all
    .map((c) => ({ c, d: haversineMeters(lat, lng, c.doc.lat, c.doc.lng) }))
    .filter((x) => x.d <= radiusMeters)
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_CANDIDATES)
    .map((x) => x.c);
}

export function scoreCandidate(c: Candidate, taste: number[], lat: number, lng: number): ScoredItem {
  const { doc } = c;
  const f = venueVectorOf(doc);
  const exact = clip(contentScore(taste, f), 1, 10);
  const score = Math.round(exact * 10) / 10;
  const distance = haversineMeters(lat, lng, doc.lat, doc.lng);
  const price = c.kind === "place" && doc.priceLevel !== undefined ? clip(Math.round(doc.priceLevel), 1, 4) : undefined;
  return {
    kind: c.kind,
    id: doc._id,
    name: c.kind === "place" ? c.doc.name : c.doc.title,
    category: doc.category,
    subcategory: doc.subcategory,
    lat: doc.lat,
    lng: doc.lng,
    distanceMeters: Math.round(distance),
    score,
    matchPct: matchPct(score),
    why: whyFromFeatures(topFeatures(taste, f)),
    imageUrl: doc.imageUrl,
    blurb: doc.blurb,
    priceLevel: price as NearbyItem["priceLevel"],
    startsAt: c.kind === "event" ? c.doc.start : undefined,
    source: doc.source,
    sourceUrl: doc.sourceUrl,
    friends: [],
    order: mapRank(exact, distance, 0),
  };
}

export function matchesFilter(item: ScoredItem, filter: Filter, now: number): boolean {
  switch (filter) {
    case "all":
      return true;
    case "tonight":
      return item.kind === "event"
        ? (item.startsAt ?? 0) <= now + TONIGHT_WINDOW_MS
        : item.category === "nightlife" || item.category === "popup" || item.category === "live";
    case "bars":
      return item.category === "nightlife";
    case "food":
      return item.category === "food";
    case "events":
      return item.kind === "event" || item.category === "live";
    case "popups":
      return item.category === "popup";
    case "outdoors":
      return item.category === "outdoors";
  }
}

export const tierForRank = (rank: number): Tier =>
  rank <= TOP_TIER_SIZE ? "top" : rank <= GOOD_TIER_SIZE ? "good" : "other";

/** Sorts best first and assigns rank 1..n and the pin tier. */
export function rankItems(scored: ScoredItem[], limit: number): NearbyItem[] {
  return [...scored]
    .sort((a, b) => b.order - a.order)
    .slice(0, limit)
    .map(({ order, ...item }, i) => ({ ...item, rank: i + 1, tier: tierForRank(i + 1) }));
}
