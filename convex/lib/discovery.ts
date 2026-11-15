import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";
import type { Category, Filter, FriendScore, NearbyItem, Tier } from "./contract";
import { isOpenAt } from "./hours";
import {
  FEATURES, NEUTRAL_TASTE, Rater, clip, mapRank, matchPct, predict, similarity, whyFromFeatures,
} from "./recs";

export const ALGO = "hybrid-v2";
export const ATTRIBUTION = "© OpenStreetMap contributors";
export const DEFAULT_RADIUS_METERS = 2500;
export const DEFAULT_LIMIT = 60;
export const MAX_CANDIDATES = 200;
export const SCAN_LIMIT = 1500;
export const MAX_RATERS_PER_ITEM = 50;
export const MAX_FRIENDS_SHOWN = 3;
export const MAX_FRIENDS_LOADED = 50;
export const TOP_TIER_SIZE = 5;
export const GOOD_TIER_SIZE = 25;
export const DIVERSITY_MAX_COSINE = 0.95;
export const WHY_SOCIAL_LAMBDA = 0.4;
export const ADULT_AGE = 21;
const HOUR_MS = 60 * 60 * 1000;
export const EVENT_DEFAULT_LENGTH_MS = 3 * HOUR_MS;
export const EVENT_SOON_MS = 6 * HOUR_MS;
export const TONIGHT_WINDOW_MS = 12 * HOUR_MS;
const YEAR_MS = 365.25 * 24 * HOUR_MS;
const METERS_PER_DEGREE = 111_320;
const DEGREES_PER_HOUR = 15;

const CATEGORY_VECTORS: Record<Category, Partial<Record<(typeof FEATURES)[number], number>>> = {
  nightlife: { energy: 0.7, loudness: 0.6, crowdAge: 0.6, dancing: 0.5 },
  food: { food: 0.9 },
  culture: { culture: 0.9 },
  outdoors: { outdoors: 0.9 },
  live: { liveMusic: 0.9, energy: 0.7, loudness: 0.7 },
  popup: { energy: 0.6, crowdAge: 0.6, culture: 0.5, food: 0.5 },
};

const CATEGORY_FITS_HOUR: Record<Category, (hour: number) => boolean> = {
  nightlife: (h) => h >= 17 || h < 3,
  food: (h) => h >= 7 && h < 22,
  culture: (h) => h >= 9 && h < 18,
  outdoors: (h) => h >= 6 && h < 19,
  live: (h) => h >= 17 || h < 1,
  popup: () => true,
};

export type Candidate = { kind: "place"; doc: Doc<"places"> } | { kind: "event"; doc: Doc<"events"> };

export type Viewer = {
  userId: Id<"users"> | null;
  taste: number[];
  homeCity?: string;
  under21: boolean;
  friendIds: Set<Id<"users">>;
  /** The viewer's own and their friends' rankings by item id, loaded apart from the bounded crowd sample. */
  knownRankings: Map<string, Doc<"rankings">[]>;
};

export type FriendRow = { ranking: Doc<"rankings">; user: Doc<"users">; local: boolean };

export type Scored = {
  item: Omit<NearbyItem, "rank" | "tier">;
  order: number;
  vector: number[];
  mine: Doc<"rankings"> | null;
  friendRows: FriendRow[];
};

export type UserLoader = (id: Id<"users">) => Promise<Doc<"users"> | null>;

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

const tasteOf = (user: Doc<"users"> | null) =>
  user?.tasteVector?.length === FEATURES.length ? user.tasteVector : NEUTRAL_TASTE;

const sameCity = (a: string | undefined, b: string | undefined) =>
  a !== undefined && b !== undefined && a.trim() !== "" && a.trim().toLowerCase() === b.trim().toLowerCase();

export const displayNameOf = (user: Doc<"users">) => user.displayName ?? user.username ?? "A friend";
export const avatarUrlOf = (user: Doc<"users">) => (user.avatar?.startsWith("http") ? user.avatar : undefined);

export function isUnder21(birthday: unknown, now: number): boolean {
  const born = typeof birthday === "number" ? birthday : typeof birthday === "string" ? Date.parse(birthday) : NaN;
  return !Number.isNaN(born) && (now - born) / YEAR_MS < ADULT_AGE;
}

export function userLoader(ctx: QueryCtx): UserLoader {
  const cache = new Map<Id<"users">, Promise<Doc<"users"> | null>>();
  return (id) => {
    let hit = cache.get(id);
    if (hit === undefined) {
      hit = ctx.db.get(id);
      cache.set(id, hit);
    }
    return hit;
  };
}

export async function loadViewer(ctx: QueryCtx, now: number): Promise<Viewer> {
  const userId = await getAuthUserId(ctx);
  const user = userId === null ? null : await ctx.db.get(userId);
  if (userId === null || user === null) {
    return { userId: null, taste: NEUTRAL_TASTE, under21: false, friendIds: new Set(), knownRankings: new Map() };
  }
  const asA = await ctx.db
    .query("friendships")
    .withIndex("by_userA", (q) => q.eq("userA", userId).eq("status", "accepted"))
    .collect();
  const asB = await ctx.db
    .query("friendships")
    .withIndex("by_userB", (q) => q.eq("userB", userId).eq("status", "accepted"))
    .collect();
  const friendIds = new Set([...asA.map((f) => f.userB), ...asB.map((f) => f.userA)]);
  const knownRankings = new Map<string, Doc<"rankings">[]>();
  for (const id of [userId, ...[...friendIds].slice(0, MAX_FRIENDS_LOADED)]) {
    const rows = await ctx.db
      .query("rankings")
      .withIndex("by_user_category", (q) => q.eq("userId", id))
      .collect();
    for (const row of rows) {
      const itemId = row.placeId ?? row.eventId;
      if (itemId !== undefined) knownRankings.set(itemId, [...(knownRankings.get(itemId) ?? []), row]);
    }
  }
  return {
    userId,
    taste: tasteOf(user),
    homeCity: user.homeCity,
    under21: isUnder21(user.birthday, now),
    friendIds,
    knownRankings,
  };
}

/** Every place and upcoming event within the radius, nearest first. */
export async function loadInRadius(ctx: QueryCtx, lat: number, lng: number, radiusMeters: number, now: number): Promise<Candidate[]> {
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
  const all: Candidate[] = [
    ...places.map((doc) => ({ kind: "place" as const, doc })),
    ...events.filter((e) => !isPastEvent(e, now)).map((doc) => ({ kind: "event" as const, doc })),
  ];
  return all
    .map((c) => ({ c, d: haversineMeters(lat, lng, c.doc.lat, c.doc.lng) }))
    .filter((x) => x.d <= radiusMeters)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.c);
}

/** The nearest candidates that pass the filter, capped so scoring stays bounded. */
export const nearestMatching = (pool: Candidate[], matches: (c: Candidate) => boolean) =>
  pool.filter(matches).slice(0, MAX_CANDIDATES);

export const isPastEvent = (event: Doc<"events">, now: number) =>
  (event.end ?? event.start + EVENT_DEFAULT_LENGTH_MS) <= now;

function timeContext(c: Candidate, now: number): { timeMatch: number; tag?: string; openNow?: boolean } {
  if (c.kind === "event") {
    const startsIn = c.doc.start - now;
    if (startsIn <= 0) return { timeMatch: 1, tag: "On now" };
    if (startsIn > EVENT_SOON_MS) return { timeMatch: 0 };
    return { timeMatch: 1, tag: startsIn < HOUR_MS ? "Starts within the hour" : `Starts in ${Math.round(startsIn / HOUR_MS)} h` };
  }
  const local = new Date(now + Math.round(c.doc.lng / DEGREES_PER_HOUR) * HOUR_MS);
  const hour = local.getUTCHours();
  const openNow = isOpenAt(c.doc.hours, local.getUTCDay(), hour * 60 + local.getUTCMinutes());
  if (openNow === false || !CATEGORY_FITS_HOUR[c.doc.category](hour)) return { timeMatch: 0, openNow };
  return { timeMatch: 1, openNow, tag: openNow ? "Open now" : undefined };
}

function whyLine(prediction: ReturnType<typeof predict>, raters: Rater[], ownScore: number | undefined, tag: string | undefined): string {
  let line = whyFromFeatures(prediction.topFeatures);
  if (ownScore !== undefined) {
    line = `You ranked it ${ownScore.toFixed(1)}`;
  } else if (prediction.lam > WHY_SOCIAL_LAMBDA && raters.some((r) => r.local || r.friend)) {
    const friend = prediction.topRater?.friend
      ? prediction.topRater
      : raters.some((r) => r.local) ? undefined : [...raters].filter((r) => r.friend).sort((a, b) => b.score - a.score)[0];
    line = friend
      ? `${friend.name} gave it ${clip(friend.score, 1, 10).toFixed(1)}`
      : `Locals like you rate it ${prediction.crowd.toFixed(1)}`;
  }
  return tag ? `${line} · ${tag}` : line;
}

export async function scoreCandidate(
  ctx: QueryCtx, c: Candidate, viewer: Viewer, lat: number, lng: number, now: number, getUser: UserLoader,
): Promise<Scored> {
  const { doc } = c;
  const vector = venueVectorOf(doc);
  const sample = c.kind === "place"
    ? await ctx.db.query("rankings").withIndex("by_place", (q) => q.eq("placeId", c.doc._id)).take(MAX_RATERS_PER_ITEM)
    : await ctx.db.query("rankings").withIndex("by_event", (q) => q.eq("eventId", c.doc._id)).take(MAX_RATERS_PER_ITEM);
  const known = viewer.knownRankings.get(doc._id) ?? [];
  const rankings = [...known, ...sample.filter((r) => !known.some((k) => k._id === r._id))];
  let mine: Doc<"rankings"> | null = null;
  const raters: Rater[] = [];
  const friendRows: FriendRow[] = [];
  for (const ranking of rankings) {
    if (ranking.userId === viewer.userId) {
      mine = ranking;
      continue;
    }
    const user = await getUser(ranking.userId);
    if (user === null) continue;
    const local = user.homeCity !== undefined && doc.city !== undefined
      ? sameCity(user.homeCity, doc.city)
      : ranking.wasLocal ?? false;
    const friend = viewer.friendIds.has(ranking.userId);
    raters.push({ taste: tasteOf(user), score: clip(ranking.score, 1, 10), local, friend, name: displayNameOf(user) });
    if (friend) friendRows.push({ ranking, user, local });
  }
  friendRows.sort((a, b) => b.ranking.score - a.ranking.score);

  const elo = doc.elo ?? 0;
  const prediction = predict(viewer.taste, vector, elo, raters, sameCity(viewer.homeCity, doc.city));
  const ownScore = mine === null ? undefined : clip(mine.score, 1, 10);
  const exact = ownScore ?? prediction.score;
  const score = Math.round(exact * 10) / 10;
  const distance = haversineMeters(lat, lng, doc.lat, doc.lng);
  const time = timeContext(c, now);
  const order = mapRank(exact, distance, time.timeMatch);
  const price = c.kind === "place" && c.doc.priceLevel !== undefined ? clip(Math.round(c.doc.priceLevel), 1, 4) : undefined;
  const friends: FriendScore[] = friendRows.slice(0, MAX_FRIENDS_SHOWN).map((row) => friendScoreOf(row));
  return {
    item: {
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
      why: whyLine(prediction, raters, ownScore, time.tag),
      imageUrl: doc.imageUrl,
      blurb: doc.blurb,
      priceLevel: price as NearbyItem["priceLevel"],
      openNow: time.openNow,
      startsAt: c.kind === "event" ? c.doc.start : undefined,
      source: doc.source,
      sourceUrl: doc.sourceUrl,
      friends,
    },
    order,
    vector,
    mine,
    friendRows,
  };
}

export const friendScoreOf = (row: FriendRow): FriendScore => ({
  userId: row.user._id,
  displayName: displayNameOf(row.user),
  avatarUrl: avatarUrlOf(row.user),
  score: Math.round(clip(row.ranking.score, 1, 10) * 10) / 10,
  isLocal: row.local,
});

export async function scoreAll(ctx: QueryCtx, candidates: Candidate[], viewer: Viewer, lat: number, lng: number, now: number): Promise<Scored[]> {
  const getUser = userLoader(ctx);
  return await Promise.all(candidates.map((c) => scoreCandidate(ctx, c, viewer, lat, lng, now, getUser)));
}

/** Closed places are hidden from lists, and nightlife is hidden from viewers under 21. */
export const isVisibleTo = (c: Candidate, viewer: Viewer, now: number) =>
  timeContext(c, now).openNow !== false && !(viewer.under21 && c.doc.category === "nightlife");

export function matchesFilter(c: Candidate, filter: Filter, now: number): boolean {
  const { category } = c.doc;
  switch (filter) {
    case "all":
      return true;
    case "tonight":
      return c.kind === "event"
        ? c.doc.start <= now + TONIGHT_WINDOW_MS
        : category === "nightlife" || category === "popup" || category === "live";
    case "bars":
      return category === "nightlife";
    case "food":
      return category === "food";
    case "events":
      return c.kind === "event" || category === "live";
    case "popups":
      return category === "popup";
    case "outdoors":
      return category === "outdoors";
  }
}

export const tierForRank = (rank: number): Tier =>
  rank <= TOP_TIER_SIZE ? "top" : rank <= GOOD_TIER_SIZE ? "good" : "other";

/** Sorts best first, keeps the top pins from being near-duplicates, and assigns rank 1..n and the pin tier. */
export function rankItems(scored: Scored[], limit: number): NearbyItem[] {
  const top: Scored[] = [];
  const rest: Scored[] = [];
  for (const s of [...scored].sort((a, b) => b.order - a.order)) {
    const duplicate = top.some((t) => similarity(t.vector, s.vector) > DIVERSITY_MAX_COSINE);
    if (top.length < TOP_TIER_SIZE && !duplicate) top.push(s);
    else rest.push(s);
  }
  return [...top, ...rest].slice(0, limit).map((s, i) => ({ ...s.item, rank: i + 1, tier: tierForRank(i + 1) }));
}
