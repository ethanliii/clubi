import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";
import type { Category, Filter, FriendScore, NearbyItem, Tier } from "./contract";
import { isOpenAt } from "./hours";
import { isMeasured } from "./insights";
import {
  AFFINITY_NEUTRAL, CROWD_HALF_WEIGHT, FEATURES, NEUTRAL_TASTE, PerformerAffinity, Rater, TIME_TAU, clip, effectiveAffinity,
  exploreBonus, friendMaySee, mapRank, matchPct, mmrPick, newSlotPick, performerAffinity, predict, shareOf, shownScore, socialBump,
  whyFromFeatures,
} from "./recs";

export const ALGO = "hybrid-v4";
export const ATTRIBUTION = "© OpenStreetMap contributors";
export const DEFAULT_RADIUS_METERS = 2500;
export const DEFAULT_LIMIT = 60;
export const MAX_CANDIDATES = 200;
export const SCAN_LIMIT_PER_SIDE = 800;
/** The crowd sample of one item: its newest rankings. `ratingCount` on a card is counted from it, so it stops here too. */
export const MAX_RATERS_PER_ITEM = 50;
export const MAX_FRIENDS_SHOWN = 3;
export const MAX_FRIENDS_LOADED = 50;
export const MAX_FRIENDSHIPS_PER_SIDE = 300;
/** The viewer's own rankings read per category, newest first, so "You ranked it" survives a busy place. */
export const MAX_OWN_RANKINGS_PER_CATEGORY = 150;
/** Ranking rows read for all loaded friends together; each friend gets an equal share per category, newest first. */
export const FRIEND_RANKINGS_BUDGET = 1200;
export const MIN_FRIEND_RANKINGS_PER_CATEGORY = 4;
export const MAX_FRIEND_RANKINGS_PER_CATEGORY = 50;
/** Save rows read for all loaded friends together; each friend gets an equal share per type ("going", "want"), newest first. */
export const FRIEND_SAVES_BUDGET = 600;
export const MIN_FRIEND_SAVES_PER_TYPE = 6;
export const MAX_FRIEND_SAVES_PER_TYPE = 40;
export const MAX_AFFINITIES = 200;
export const MAX_SAVES_LOADED = 300;
/** discover.upcoming: events of the performers the viewer likes are candidates before anything else. */
export const MAX_LIKED_PERFORMERS = 30;
export const MAX_EVENTS_PER_LIKED_PERFORMER = 6;
export const MAX_PERFORMERS_PER_EVENT = 8;
export const MAX_PERFORMERS_SHOWN = 4;
export const MMR_POOL_SIZE = 30;
export const NEW_SLOT_TAG = "New on Vioma";
export const TOP_TIER_SIZE = 5;
export const GOOD_TIER_SIZE = 25;
export const DIVERSITY_MAX_COSINE = 0.95;
/** The reason line turns social once similar raters weigh this much together (two full-weight raters). */
export const WHY_SOCIAL_WEIGHT = 2;
/** The same threshold as a crowd share. It was 0.4 while CROWD_HALF_WEIGHT was 3: the same weight of 2. */
export const WHY_SOCIAL_LAMBDA = WHY_SOCIAL_WEIGHT / (WHY_SOCIAL_WEIGHT + CROWD_HALF_WEIGHT);
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

const CATEGORIES = Object.keys(CATEGORY_VECTORS) as Category[];

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
  /** The viewer's performer affinities by performer id (at most MAX_AFFINITIES). Optional: older callers build a Viewer without it. */
  affinities?: Map<string, AffinityRow>;
  /** What the viewer saved or marked "going", by item id (at most MAX_SAVES_LOADED rows). */
  saves?: Map<string, { saved: boolean; going: boolean }>;
  /** How many of the loaded friends marked an item "going" or saved it, by item id. Loaded once per query. */
  friendSaves?: Map<string, { going: number; saved: number }>;
};

export type AffinityRow = { score: number; following: boolean; nRankings?: number };

/** A friend's ranking the viewer may see, with its post (null when the post was deleted). */
export type FriendRow = { ranking: Doc<"rankings">; user: Doc<"users">; local: boolean; post: Doc<"posts"> | null };

export type Scored = {
  item: Omit<NearbyItem, "rank" | "tier">;
  order: number;
  vector: number[];
  mine: Doc<"rankings"> | null;
  friendRows: FriendRow[];
  /** `score` is clipped to 1-10 for the math; `given` is the score the ranking really has, for text. */
  raters: (Rater & { userId: Id<"users">; given: number })[];
  /** The why line without its context tag, and the tag, so a list can swap the tag ("New on clubi"). */
  reason: string;
  tag?: string;
  /** Rankings loaded plus comparisons: the n behind the exploration bonus. */
  nRatings: number;
  /** Performers linked to an event (empty for places), for scoring the same event for another person. */
  performerIds: Id<"performers">[];
  terms: {
    content: number; crowd: number; lambda: number; base: number; elo: number; eloTerm: number;
    performer: number; performerName?: string; performerAffinity?: number; also: number;
    predicted: number; ownScore?: number; score: number; distanceMeters: number; distancePenalty: number;
    timeMatch: number; timeTerm: number;
    nRatings: number; explore: number; friendsGoing: number; friendsSaved: number; social: number;
    order: number;
    raters: { count: number; locals: number; friends: number; weightSum: number };
  };
};

export type UserLoader = (id: Id<"users">) => Promise<Doc<"users"> | null>;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

/**
 * The features every score and taste update use: the vector measured from visitors' answers
 * (`learnedVector`, written by insights.submit) when there is one, else the featurizer's guess, else the category default.
 */
export function venueVectorOf(doc: { learnedVector?: number[]; venueVector?: number[]; category: Category }): number[] {
  if (doc.learnedVector?.length === FEATURES.length) return doc.learnedVector;
  if (doc.venueVector?.length === FEATURES.length) return doc.venueVector;
  const preset = CATEGORY_VECTORS[doc.category];
  return FEATURES.map((k) => preset[k] ?? 0.3);
}

export const tasteOf = (user: Doc<"users"> | null) =>
  user?.tasteVector?.length === FEATURES.length ? user.tasteVector : NEUTRAL_TASTE;

export const sameCity = (a: string | undefined, b: string | undefined) =>
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

/** A person's accepted friends: at most MAX_FRIENDSHIPS_PER_SIDE they asked and as many who asked them. */
export async function friendIdsOf(ctx: QueryCtx, userId: Id<"users">): Promise<Set<Id<"users">>> {
  const asA = await ctx.db
    .query("friendships")
    .withIndex("by_userA", (q) => q.eq("userA", userId).eq("status", "accepted"))
    .take(MAX_FRIENDSHIPS_PER_SIDE);
  const asB = await ctx.db
    .query("friendships")
    .withIndex("by_userB", (q) => q.eq("userB", userId).eq("status", "accepted"))
    .take(MAX_FRIENDSHIPS_PER_SIDE);
  return new Set([...asA.map((f) => f.userB), ...asB.map((f) => f.userA)]);
}

/** One person's newest rankings, at most `perCategory` in each category. */
export async function newestRankingsOf(ctx: QueryCtx, userId: Id<"users">, perCategory: number, categories: readonly Category[] = CATEGORIES): Promise<Doc<"rankings">[]> {
  const lists = await Promise.all(categories.map((category) => ctx.db
    .query("rankings")
    .withIndex("by_user_category", (q) => q.eq("userId", userId).eq("category", category))
    .order("desc")
    .take(perCategory)));
  return lists.flat();
}

/**
 * People's rule: a ranking is as visible as its post. Returns the post of a ranking (null when it was
 * deleted, which leaves the ranking visible to friends); `friendMaySee(post?.visibility)` decides.
 */
export const postOfRanking = (ctx: QueryCtx, rankingId: Id<"rankings">): Promise<Doc<"posts"> | null> =>
  ctx.db.query("posts").withIndex("by_ranking", (q) => q.eq("rankingId", rankingId)).first();

/**
 * Who is looking, with what every candidate needs from them. Every read is bounded: the viewer's own
 * rankings (newest MAX_OWN_RANKINGS_PER_CATEGORY per category), a share of FRIEND_RANKINGS_BUDGET for each of
 * the first MAX_FRIENDS_LOADED friends, and a share of FRIEND_SAVES_BUDGET for their saves. A friend's ranking
 * outside that share still shows when it is among the item's newest MAX_RATERS_PER_ITEM.
 * INTEGRATION (People): a `by_user_place` / `by_user_event` index on rankings would make this exact per candidate.
 */
export async function loadViewer(ctx: QueryCtx, now: number): Promise<Viewer> {
  const userId = await getAuthUserId(ctx);
  const user = userId === null ? null : await ctx.db.get(userId);
  if (userId === null || user === null) {
    return {
      userId: null, taste: NEUTRAL_TASTE, under21: false, friendIds: new Set(), knownRankings: new Map(),
      affinities: new Map(), saves: new Map(), friendSaves: new Map(),
    };
  }
  const friendIds = await friendIdsOf(ctx, userId);
  const loaded = [...friendIds].slice(0, MAX_FRIENDS_LOADED);
  const perCategory = shareOf(FRIEND_RANKINGS_BUDGET, loaded.length * CATEGORIES.length, MIN_FRIEND_RANKINGS_PER_CATEGORY, MAX_FRIEND_RANKINGS_PER_CATEGORY);
  const lists = await Promise.all([
    newestRankingsOf(ctx, userId, MAX_OWN_RANKINGS_PER_CATEGORY),
    ...loaded.map((id) => newestRankingsOf(ctx, id, perCategory)),
  ]);
  const knownRankings = new Map<string, Doc<"rankings">[]>();
  for (const row of lists.flat()) {
    const itemId = row.placeId ?? row.eventId;
    if (itemId !== undefined) knownRankings.set(itemId, [...(knownRankings.get(itemId) ?? []), row]);
  }
  return {
    userId,
    taste: tasteOf(user),
    homeCity: user.homeCity,
    under21: isUnder21(user.birthday, now),
    friendIds,
    knownRankings,
    affinities: await affinitiesOf(ctx, userId),
    saves: await savesOf(ctx, userId),
    friendSaves: await friendSavesOf(ctx, loaded),
  };
}

/** One person's performer affinities by performer id, for the performer term of the score. */
export async function affinitiesOf(ctx: QueryCtx, userId: Id<"users">): Promise<Map<string, AffinityRow>> {
  const rows = await ctx.db
    .query("affinities")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX_AFFINITIES);
  return new Map(rows.map((a) => [a.performerId, { score: a.score, following: a.following, nRankings: a.nRankings }]));
}

async function savesOf(ctx: QueryCtx, userId: Id<"users">): Promise<NonNullable<Viewer["saves"]>> {
  const rows = await ctx.db
    .query("saves")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX_SAVES_LOADED);
  const saves: NonNullable<Viewer["saves"]> = new Map();
  for (const row of rows) {
    const flags = saves.get(row.targetId) ?? { saved: false, going: false };
    if (row.type === "going") flags.going = true;
    else flags.saved = true;
    saves.set(row.targetId, flags);
  }
  return saves;
}

/**
 * How many of these friends marked each item "going" or saved it, by item id: each friend's newest saves of
 * each type, read once per query. A friend who did both counts as going.
 */
async function friendSavesOf(ctx: QueryCtx, friends: Id<"users">[]): Promise<NonNullable<Viewer["friendSaves"]>> {
  const perType = shareOf(FRIEND_SAVES_BUDGET, friends.length * 2, MIN_FRIEND_SAVES_PER_TYPE, MAX_FRIEND_SAVES_PER_TYPE);
  const newest = (userId: Id<"users">, type: "going" | "want") => ctx.db
    .query("saves")
    .withIndex("by_user", (q) => q.eq("userId", userId).eq("type", type))
    .order("desc")
    .take(perType);
  const counts: NonNullable<Viewer["friendSaves"]> = new Map();
  const perFriend = await Promise.all(friends.map(async (id) => ({ going: await newest(id, "going"), want: await newest(id, "want") })));
  for (const { going, want } of perFriend) {
    const goingTo = new Set<string>(going.map((row) => row.targetId));
    const wanted = new Set<string>(want.map((row) => row.targetId));
    for (const id of goingTo) wanted.delete(id);
    for (const [ids, key] of [[goingTo, "going"], [wanted, "saved"]] as const) {
      for (const id of ids) {
        const row = counts.get(id) ?? { going: 0, saved: 0 };
        row[key] += 1;
        counts.set(id, row);
      }
    }
  }
  return counts;
}

/** The performers linked to an event and, for those the viewer has an affinity row for, the row with the name. */
async function performersOf(ctx: QueryCtx, c: Candidate, viewer: Viewer): Promise<{ ids: Id<"performers">[]; known: PerformerAffinity[] }> {
  if (c.kind !== "event") return { ids: [], known: [] };
  const links = await ctx.db
    .query("eventPerformers")
    .withIndex("by_event", (q) => q.eq("eventId", c.doc._id))
    .take(MAX_PERFORMERS_PER_EVENT);
  const known: PerformerAffinity[] = [];
  for (const link of links) {
    const affinity = viewer.affinities?.get(link.performerId);
    if (affinity === undefined) continue;
    const performer = await ctx.db.get(link.performerId);
    if (performer !== null) known.push({ name: performer.name, ...affinity });
  }
  return { ids: links.map((l) => l.performerId), known };
}

/**
 * Every place and upcoming event within the radius, nearest first. The lat index is read outward from
 * the centre in both directions, so when a dense area hits the scan limit it is the far edge that is cut.
 */
export async function loadInRadius(
  ctx: QueryCtx, lat: number, lng: number, radiusMeters: number, now: number, placeScanLimit: number = SCAN_LIMIT_PER_SIDE,
): Promise<Candidate[]> {
  const dLat = radiusMeters / METERS_PER_DEGREE;
  const dLng = radiusMeters / (METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
  const [placesNorth, placesSouth, eventsNorth, eventsSouth] = await Promise.all([
    ctx.db
      .query("places")
      .withIndex("by_lat", (q) => q.gte("lat", lat).lte("lat", lat + dLat))
      .filter((q) => q.and(q.gte(q.field("lng"), lng - dLng), q.lte(q.field("lng"), lng + dLng)))
      .take(placeScanLimit),
    ctx.db
      .query("places")
      .withIndex("by_lat", (q) => q.gte("lat", lat - dLat).lt("lat", lat))
      .order("desc")
      .filter((q) => q.and(q.gte(q.field("lng"), lng - dLng), q.lte(q.field("lng"), lng + dLng)))
      .take(placeScanLimit),
    ctx.db
      .query("events")
      .withIndex("by_lat", (q) => q.gte("lat", lat).lte("lat", lat + dLat))
      .filter((q) => q.and(q.gte(q.field("lng"), lng - dLng), q.lte(q.field("lng"), lng + dLng)))
      .take(SCAN_LIMIT_PER_SIDE),
    ctx.db
      .query("events")
      .withIndex("by_lat", (q) => q.gte("lat", lat - dLat).lt("lat", lat))
      .order("desc")
      .filter((q) => q.and(q.gte(q.field("lng"), lng - dLng), q.lte(q.field("lng"), lng + dLng)))
      .take(SCAN_LIMIT_PER_SIDE),
  ]);
  const all: Candidate[] = [
    ...[...placesNorth, ...placesSouth].map((doc) => ({ kind: "place" as const, doc })),
    ...[...eventsNorth, ...eventsSouth].filter((e) => !isPastEvent(e, now)).map((doc) => ({ kind: "event" as const, doc })),
  ];
  return all
    .map((c) => ({ c, d: haversineMeters(lat, lng, c.doc.lat, c.doc.lng) }))
    .filter((x) => x.d <= radiusMeters)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.c);
}

/** Upcoming events that start inside [from, to] within the radius, soonest first. Reads the by_start index, bounded. */
export async function loadEventsBetween(
  ctx: QueryCtx, lat: number, lng: number, radiusMeters: number, from: number, to: number, now: number, scanLimit: number,
): Promise<Candidate[]> {
  const dLat = radiusMeters / METERS_PER_DEGREE;
  const dLng = radiusMeters / (METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
  const events = await ctx.db
    .query("events")
    .withIndex("by_start", (q) => q.gte("start", from).lte("start", to))
    .filter((q) => q.and(
      q.gte(q.field("lat"), lat - dLat), q.lte(q.field("lat"), lat + dLat),
      q.gte(q.field("lng"), lng - dLng), q.lte(q.field("lng"), lng + dLng),
    ))
    .take(scanLimit);
  return events
    .filter((e) => !isPastEvent(e, now) && haversineMeters(lat, lng, e.lat, e.lng) <= radiusMeters)
    .map((doc) => ({ kind: "event" as const, doc }));
}

/**
 * Upcoming events, inside the window and the radius, of the performers the viewer follows or has rated
 * above neutral (the strongest MAX_LIKED_PERFORMERS, soonest MAX_EVENTS_PER_LIKED_PERFORMER events each).
 * discover.upcoming puts these in before it fills up, so a liked act is never cut for starting late in the window.
 */
export async function loadLikedPerformerEvents(
  ctx: QueryCtx, viewer: Viewer, lat: number, lng: number, radiusMeters: number, from: number, to: number, now: number,
): Promise<Candidate[]> {
  const liked = [...(viewer.affinities ?? new Map<string, AffinityRow>())]
    .map(([id, row]) => ({ id: id as Id<"performers">, affinity: effectiveAffinity(row) }))
    .filter((p) => p.affinity > AFFINITY_NEUTRAL)
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, MAX_LIKED_PERFORMERS);
  const links = await Promise.all(liked.map((p) => ctx.db
    .query("eventPerformers")
    .withIndex("by_performer", (q) => q.eq("performerId", p.id).gte("start", from).lte("start", to))
    .take(MAX_EVENTS_PER_LIKED_PERFORMER)));
  const eventIds = [...new Set(links.flat().map((link) => link.eventId))];
  const events = await Promise.all(eventIds.map((id) => ctx.db.get(id)));
  return events
    .flatMap((doc) => (doc === null ? [] : [doc]))
    .filter((e) => e.start >= from && e.start <= to && !isPastEvent(e, now) && haversineMeters(lat, lng, e.lat, e.lng) <= radiusMeters)
    .sort((a, b) => a.start - b.start)
    .map((doc) => ({ kind: "event" as const, doc }));
}

/** Looks a place or event up from the plain string id a route param carries. */
export async function getCandidate(ctx: QueryCtx, kind: "place" | "event", id: string): Promise<Candidate | null> {
  if (kind === "place") {
    const placeId = ctx.db.normalizeId("places", id);
    const doc = placeId === null ? null : await ctx.db.get(placeId);
    return doc === null ? null : { kind, doc };
  }
  const eventId = ctx.db.normalizeId("events", id);
  const doc = eventId === null ? null : await ctx.db.get(eventId);
  return doc === null ? null : { kind, doc };
}

/** The nearest candidates that pass the filter, capped so scoring stays bounded. */
export const nearestMatching = (pool: Candidate[], matches: (c: Candidate) => boolean) =>
  pool.filter(matches).slice(0, MAX_CANDIDATES);

/** The radius a caller may ask for (a circle drawn on the map), in metres. */
export const MIN_RADIUS_METERS = 200;
export const MAX_RADIUS_METERS = 15000;
/** Places read on each side of the centre for a radius the caller set: enough for a circle across a city. */
export const WIDE_SCAN_LIMIT_PER_SIDE = 2500;
const SPREAD_EVEN_SHARE = 1 / 4;
const SPREAD_EVENT_SHARE = 1 / 4;

/** How much is known about a place, cheaply: its Google rating and how many gave it, comparisons here, a photo. */
const renown = (c: Candidate) =>
  c.kind === "event"
    ? 0
    : (c.doc.externalRating ?? 3.5) * Math.log10(1 + (c.doc.externalRatingCount ?? 0)) + 0.5 * (c.doc.nComparisons ?? 0) + (c.doc.imageUrl ? 1 : 0);

/**
 * The candidates to score when a caller sets its own radius. `nearestMatching` keeps the nearest 200,
 * which in a dense city is a few blocks however wide the circle is. This keeps the whole circle in
 * play instead: a quarter evenly spaced by distance (so every ring is there, the nearest first), up
 * to a quarter events (nearest first), and the rest the best-known places anywhere in the radius.
 * `pool` is nearest first and already filtered; the result keeps that order. Everything is returned
 * when it fits.
 */
export function spreadCandidates(pool: Candidate[], max: number = MAX_CANDIDATES): Candidate[] {
  if (pool.length <= max) return pool;
  const picked = new Set<Candidate>();
  const even = Math.floor(max * SPREAD_EVEN_SHARE);
  for (let i = 0; i < even; i++) picked.add(pool[Math.floor((i * pool.length) / even)]);
  let events = 0;
  for (const c of pool) {
    if (events >= max * SPREAD_EVENT_SHARE) break;
    if (c.kind !== "event" || picked.has(c)) continue;
    picked.add(c);
    events++;
  }
  const rest = pool.filter((c) => !picked.has(c)).map((c, index) => ({ c, index, renown: renown(c) }));
  rest.sort((a, b) => b.renown - a.renown || a.index - b.index);
  for (const { c } of rest) {
    if (picked.size >= max) break;
    picked.add(c);
  }
  return pool.filter((c) => picked.has(c));
}

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

/**
 * Section 2.3: the reason is the term that moved the score most. First rule that matches wins. Never empty.
 * Scores in the text are the ones the rankings really have (a "didn't like" can be under 1).
 */
function reasonLine(
  prediction: ReturnType<typeof predict>, raters: Scored["raters"], mine: Doc<"rankings"> | null, performerWhy: string | undefined,
  measured: boolean,
): string {
  if (mine !== null) return `You ranked it ${shownScore(mine.score).toFixed(1)}`;
  if (performerWhy !== undefined) return performerWhy;
  if (prediction.lam > WHY_SOCIAL_LAMBDA && raters.some((r) => r.local || r.friend)) {
    const friend = prediction.topRater?.friend
      ? raters[prediction.topRater.index]
      : raters.some((r) => r.local) ? undefined : [...raters].filter((r) => r.friend).sort((a, b) => b.score - a.score)[0];
    return friend
      ? `${friend.name} gave it ${shownScore(friend.given).toFixed(1)}`
      : `Locals like you rate it ${prediction.crowd.toFixed(1)}`;
  }
  return whyFromFeatures(prediction.topFeatures, measured);
}

export const withTag = (reason: string, tag: string | undefined) => (tag ? `${reason} · ${tag}` : reason);

/** The answer weight behind each feature of an item's vector, or undefined when nothing is measured (no read then). */
async function measuredWeightOf(ctx: QueryCtx, doc: Candidate["doc"]): Promise<number[] | undefined> {
  if (doc.learnedVector?.length !== FEATURES.length) return undefined;
  const stats = await ctx.db
    .query("venueStats")
    .withIndex("by_target", (q) => q.eq("targetId", doc._id))
    .first();
  return stats?.observedWeight;
}

export async function scoreCandidate(
  ctx: QueryCtx, c: Candidate, viewer: Viewer, lat: number, lng: number, now: number, getUser: UserLoader,
): Promise<Scored> {
  const { doc } = c;
  const vector = venueVectorOf(doc);
  // The crowd is the item's newest rankings, so a place keeps learning after its first MAX_RATERS_PER_ITEM.
  const sample = c.kind === "place"
    ? await ctx.db.query("rankings").withIndex("by_place", (q) => q.eq("placeId", c.doc._id)).order("desc").take(MAX_RATERS_PER_ITEM)
    : await ctx.db.query("rankings").withIndex("by_event", (q) => q.eq("eventId", c.doc._id)).order("desc").take(MAX_RATERS_PER_ITEM);
  const known = viewer.knownRankings.get(doc._id) ?? [];
  const rankings = [...known, ...sample.filter((r) => !known.some((k) => k._id === r._id))];
  let mine: Doc<"rankings"> | null = null;
  const raters: Scored["raters"] = [];
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
    // A friend's "Only me" ranking still counts in the crowd, but as anyone's: no name, no friend weight,
    // and it never reaches friends[], friendRankings or the why line.
    const post = viewer.friendIds.has(ranking.userId) ? await postOfRanking(ctx, ranking._id) : null;
    const friend = viewer.friendIds.has(ranking.userId) && friendMaySee(post?.visibility);
    raters.push({
      userId: user._id, taste: tasteOf(user), score: clip(ranking.score, 1, 10), given: ranking.score, local, friend,
      name: displayNameOf(user),
    });
    if (friend) friendRows.push({ ranking, user, local, post });
  }
  friendRows.sort((a, b) => b.ranking.score - a.ranking.score);

  const elo = doc.elo ?? 0;
  const performers = await performersOf(ctx, c, viewer);
  const affinity = performerAffinity(performers.known);
  const prediction = predict(viewer.taste, vector, elo, raters, sameCity(viewer.homeCity, doc.city), { performer: affinity.term });
  const ownScore = mine === null ? undefined : clip(mine.score, 1, 10);
  const exact = ownScore ?? prediction.score;
  const score = Math.round(exact * 10) / 10;
  const distance = haversineMeters(lat, lng, doc.lat, doc.lng);
  const time = timeContext(c, now);
  // Exploration and the friends bump change the order only; the shown score stays the honest prediction.
  const nRatings = rankings.length + (doc.nComparisons ?? 0);
  const explore = exploreBonus(nRatings);
  const friendsSaves = viewer.friendSaves?.get(doc._id) ?? { going: 0, saved: 0 };
  const friendsOut = friendsSaves.going + friendsSaves.saved;
  const social = socialBump(friendsOut);
  const order = mapRank(exact, distance, time.timeMatch) + explore + social;
  const measured = isMeasured(prediction.topFeatures[0], await measuredWeightOf(ctx, doc));
  const reason = reasonLine(prediction, raters, mine, affinity.why, measured);
  const tag = time.tag ?? (friendsSaves.going > 0
    ? `${friendsSaves.going} ${friendsSaves.going === 1 ? "friend" : "friends"} going`
    : undefined);
  const mySaves = viewer.saves?.get(doc._id);
  const performerNames = c.kind === "event" ? c.doc.performerNames?.slice(0, MAX_PERFORMERS_SHOWN) : undefined;
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
      why: withTag(reason, tag),
      imageUrl: doc.imageUrl,
      imageAttribution: c.kind === "place" ? c.doc.imageAttribution : undefined,
      blurb: doc.blurb,
      priceLevel: price as NearbyItem["priceLevel"],
      openNow: time.openNow,
      startsAt: c.kind === "event" ? c.doc.start : undefined,
      source: doc.source,
      sourceUrl: doc.sourceUrl,
      friends,
      performers: performerNames !== undefined && performerNames.length > 0 ? performerNames : undefined,
      saved: mySaves?.saved ?? false,
      going: mySaves?.going ?? false,
      // Counted from the rows loaded here, so it stops near MAX_RATERS_PER_ITEM; places.get counts further.
      ratingCount: rankings.length,
    },
    order,
    vector,
    mine,
    friendRows,
    raters,
    reason,
    tag,
    nRatings,
    performerIds: performers.ids,
    terms: {
      content: prediction.content,
      crowd: prediction.crowd,
      lambda: prediction.lam,
      base: prediction.base,
      elo,
      eloTerm: prediction.eloTerm,
      performer: prediction.performer,
      performerName: affinity.best?.name,
      performerAffinity: affinity.affinity,
      also: prediction.also,
      predicted: prediction.score,
      ownScore,
      score: exact,
      distanceMeters: distance,
      distancePenalty: exact - mapRank(exact, distance, 0),
      timeMatch: time.timeMatch,
      timeTerm: TIME_TAU * time.timeMatch,
      nRatings,
      explore,
      friendsGoing: friendsSaves.going,
      friendsSaved: friendsSaves.saved,
      social,
      order,
      raters: {
        count: raters.length,
        locals: raters.filter((r) => r.local).length,
        friends: raters.filter((r) => r.friend).length,
        weightSum: prediction.weightSum,
      },
    },
  };
}

/** A friend's score as the card shows it: the score their ranking has (0 to 10), not the clipped one the math uses. */
export const friendScoreOf = (row: FriendRow): FriendScore => ({
  userId: row.user._id,
  displayName: displayNameOf(row.user),
  avatarUrl: avatarUrlOf(row.user),
  score: shownScore(row.ranking.score),
  isLocal: row.local,
});

export async function scoreAll(ctx: QueryCtx, candidates: Candidate[], viewer: Viewer, lat: number, lng: number, now: number): Promise<Scored[]> {
  const getUser = userLoader(ctx);
  return await Promise.all(candidates.map((c) => scoreCandidate(ctx, c, viewer, lat, lng, now, getUser)));
}

/** Closed places are hidden from lists, and nightlife is hidden from viewers under 21. */
/** A name with no letter or digit in it ("?", "-") is an import artefact, not a place. */
const hasRealName = (c: Candidate) => /[\p{L}\p{N}]/u.test(c.kind === "place" ? c.doc.name : c.doc.title);

/** Google says the place is closed for good (imports/google.ts sets the flag; the row is kept). */
const isClosedForGood = (c: Candidate) => c.kind === "place" && c.doc.permanentlyClosed === true;

export const isVisibleTo = (c: Candidate, viewer: Viewer, now: number) =>
  hasRealName(c) && !isClosedForGood(c) && timeContext(c, now).openNow !== false && !(viewer.under21 && c.doc.category === "nightlife");

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
      // Bars are places. A nightlife event belongs under "tonight" and "events".
      return c.kind === "place" && category === "nightlife";
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

/**
 * Sorts best first and assigns rank 1..n and the pin tier. The top tier is picked for variety (MMR over the
 * best MMR_POOL_SIZE), and when nothing in it is new, its last slot goes to the best new item, tagged "New on clubi".
 */
export function rankItems(scored: Scored[], limit: number): NearbyItem[] {
  const sorted = [...scored].sort((a, b) => b.order - a.order);
  const picks = mmrPick(sorted.slice(0, MMR_POOL_SIZE).map((s) => ({ s, order: s.order, vector: s.vector, category: s.item.category })), TOP_TIER_SIZE);
  let top = picks.map((p) => p.s);
  const slotOf = (s: Scored) => ({ s, order: s.order, nRatings: s.nRatings, content: s.terms.content });
  const fresh = newSlotPick(top.map(slotOf), sorted.filter((s) => !top.includes(s)).map(slotOf), TOP_TIER_SIZE)?.s;
  if (fresh !== undefined) top = [...top.slice(0, TOP_TIER_SIZE - 1), fresh];
  const rest = sorted.filter((s) => !top.includes(s));
  return [...top, ...rest].slice(0, limit).map((s, i) => ({
    ...s.item,
    why: s === fresh ? withTag(s.reason, NEW_SLOT_TAG) : s.item.why,
    rank: i + 1,
    tier: tierForRank(i + 1),
  }));
}
