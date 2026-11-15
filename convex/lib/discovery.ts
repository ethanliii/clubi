import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";
import type { Category, Filter, FriendScore, NearbyItem, Tier } from "./contract";
import { isOpenAt } from "./hours";
import {
  FEATURES, NEUTRAL_TASTE, PerformerAffinity, Rater, TIME_TAU, clip, exploreBonus, mapRank, matchPct, mmrPick, newSlotPick,
  performerAffinity, predict, socialBump, whyFromFeatures,
} from "./recs";

export const ALGO = "hybrid-v4";
export const ATTRIBUTION = "© OpenStreetMap contributors";
export const DEFAULT_RADIUS_METERS = 2500;
export const DEFAULT_LIMIT = 60;
export const MAX_CANDIDATES = 200;
export const SCAN_LIMIT_PER_SIDE = 800;
export const MAX_RATERS_PER_ITEM = 50;
export const MAX_FRIENDS_SHOWN = 3;
export const MAX_FRIENDS_LOADED = 50;
export const MAX_AFFINITIES = 200;
export const MAX_SAVES_LOADED = 300;
export const MAX_SAVES_PER_ITEM = 60;
export const MAX_PERFORMERS_PER_EVENT = 8;
export const MAX_PERFORMERS_SHOWN = 4;
export const MMR_POOL_SIZE = 30;
export const NEW_SLOT_TAG = "New on clubi";
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
  /** The viewer's performer affinities by performer id (at most MAX_AFFINITIES). Optional: older callers build a Viewer without it. */
  affinities?: Map<string, AffinityRow>;
  /** What the viewer saved or marked "going", by item id (at most MAX_SAVES_LOADED rows). */
  saves?: Map<string, { saved: boolean; going: boolean }>;
};

export type AffinityRow = { score: number; following: boolean; nRankings?: number };

export type FriendRow = { ranking: Doc<"rankings">; user: Doc<"users">; local: boolean };

export type Scored = {
  item: Omit<NearbyItem, "rank" | "tier">;
  order: number;
  vector: number[];
  mine: Doc<"rankings"> | null;
  friendRows: FriendRow[];
  raters: (Rater & { userId: Id<"users"> })[];
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

export async function friendIdsOf(ctx: QueryCtx, userId: Id<"users">): Promise<Set<Id<"users">>> {
  const asA = await ctx.db
    .query("friendships")
    .withIndex("by_userA", (q) => q.eq("userA", userId).eq("status", "accepted"))
    .collect();
  const asB = await ctx.db
    .query("friendships")
    .withIndex("by_userB", (q) => q.eq("userB", userId).eq("status", "accepted"))
    .collect();
  return new Set([...asA.map((f) => f.userB), ...asB.map((f) => f.userA)]);
}

export async function loadViewer(ctx: QueryCtx, now: number): Promise<Viewer> {
  const userId = await getAuthUserId(ctx);
  const user = userId === null ? null : await ctx.db.get(userId);
  if (userId === null || user === null) {
    return {
      userId: null, taste: NEUTRAL_TASTE, under21: false, friendIds: new Set(), knownRankings: new Map(),
      affinities: new Map(), saves: new Map(),
    };
  }
  const friendIds = await friendIdsOf(ctx, userId);
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
    affinities: await affinitiesOf(ctx, userId),
    saves: await savesOf(ctx, userId),
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

/** How many of the viewer's friends marked an item "going" or saved it. One indexed read, skipped without friends. */
async function friendSaves(ctx: QueryCtx, viewer: Viewer, itemId: Id<"places"> | Id<"events">): Promise<{ going: number; saved: number }> {
  if (viewer.friendIds.size === 0) return { going: 0, saved: 0 };
  const rows = await ctx.db
    .query("saves")
    .withIndex("by_target", (q) => q.eq("targetId", itemId))
    .take(MAX_SAVES_PER_ITEM);
  const going = new Set<string>(), saved = new Set<string>();
  for (const row of rows) {
    if (!viewer.friendIds.has(row.userId)) continue;
    if (row.type === "going") going.add(row.userId);
    else saved.add(row.userId);
  }
  for (const id of going) saved.delete(id);
  return { going: going.size, saved: saved.size };
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
export async function loadInRadius(ctx: QueryCtx, lat: number, lng: number, radiusMeters: number, now: number): Promise<Candidate[]> {
  const dLat = radiusMeters / METERS_PER_DEGREE;
  const dLng = radiusMeters / (METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
  const [placesNorth, placesSouth, eventsNorth, eventsSouth] = await Promise.all([
    ctx.db
      .query("places")
      .withIndex("by_lat", (q) => q.gte("lat", lat).lte("lat", lat + dLat))
      .filter((q) => q.and(q.gte(q.field("lng"), lng - dLng), q.lte(q.field("lng"), lng + dLng)))
      .take(SCAN_LIMIT_PER_SIDE),
    ctx.db
      .query("places")
      .withIndex("by_lat", (q) => q.gte("lat", lat - dLat).lt("lat", lat))
      .order("desc")
      .filter((q) => q.and(q.gte(q.field("lng"), lng - dLng), q.lte(q.field("lng"), lng + dLng)))
      .take(SCAN_LIMIT_PER_SIDE),
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

/** Section 2.3: the reason is the term that moved the score most. First rule that matches wins. Never empty. */
function reasonLine(prediction: ReturnType<typeof predict>, raters: Rater[], ownScore: number | undefined, performerWhy: string | undefined): string {
  if (ownScore !== undefined) return `You ranked it ${ownScore.toFixed(1)}`;
  if (performerWhy !== undefined) return performerWhy;
  if (prediction.lam > WHY_SOCIAL_LAMBDA && raters.some((r) => r.local || r.friend)) {
    const friend = prediction.topRater?.friend
      ? prediction.topRater
      : raters.some((r) => r.local) ? undefined : [...raters].filter((r) => r.friend).sort((a, b) => b.score - a.score)[0];
    return friend
      ? `${friend.name} gave it ${clip(friend.score, 1, 10).toFixed(1)}`
      : `Locals like you rate it ${prediction.crowd.toFixed(1)}`;
  }
  return whyFromFeatures(prediction.topFeatures);
}

export const withTag = (reason: string, tag: string | undefined) => (tag ? `${reason} · ${tag}` : reason);

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
    const friend = viewer.friendIds.has(ranking.userId);
    raters.push({ userId: user._id, taste: tasteOf(user), score: clip(ranking.score, 1, 10), local, friend, name: displayNameOf(user) });
    if (friend) friendRows.push({ ranking, user, local });
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
  const friendsSaves = await friendSaves(ctx, viewer, doc._id);
  const friendsOut = friendsSaves.going + friendsSaves.saved;
  const social = socialBump(friendsOut);
  const order = mapRank(exact, distance, time.timeMatch) + explore + social;
  const reason = reasonLine(prediction, raters, ownScore, affinity.why);
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
