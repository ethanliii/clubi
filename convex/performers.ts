// Owner: Data session. Performers: search, follow, affinity, "X is coming to your city" alerts
// (docs/CONTRACT.md, docs/ALGORITHM.md section 4).
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { PerformerCard } from "./lib/contract";
import { ADULT_AGE, isUnder21 } from "./lib/discovery";
import {
  AFFINITY_NEUTRAL,
  ALERT_HORIZON_DAYS,
  ALERT_MIN_AFFINITY,
  MAX_PERFORMERS,
  affinityStep,
  alertText,
  effectiveAffinity,
  genresToVector,
  normalizePerformerName,
  performerSimilarity,
  shouldAlert,
} from "./lib/performers";
import { FEATURES } from "./lib/recs";
import { notify } from "./notifications";

const DAY_MS = 24 * 60 * 60 * 1000;
const SEARCH_LIMIT = 10;
const UPCOMING_LIMIT = 10;
const NEXT_EVENT_SCAN = 5;
const EVENT_LINK_LIMIT = 20;
const FOLLOWING_SCAN = 300;
const FOLLOWING_LIMIT = 30;
const FAN_LIMIT = 300;
const ENGAGED_LIMIT = 300;
const RECENT_NOTIFICATIONS = 100;
const CATCH_UP_WINDOW_MS = 25 * 60 * 60 * 1000;
const CATCH_UP_LIMIT = 300;
const CATCH_UP_EVENTS = 3;
const SIMILAR_SCAN = 400;
const SIMILAR_LIMIT = 8;
const SIMILAR_MIN = 0.6;

type Affinity = Doc<"affinities">;

/** Under-21 users never get these, anywhere. The ingest stores every adults-only event as nightlife. */
const adultsOnly = (event: Doc<"events">) => event.category === "nightlife" || (event.minAge ?? 0) >= ADULT_AGE;

/** The performers of an event, headliner first (the order of `performerNames` on the event). */
async function performersOf(ctx: QueryCtx, event: Doc<"events">): Promise<Doc<"performers">[]> {
  const links = await ctx.db
    .query("eventPerformers")
    .withIndex("by_event", (q) => q.eq("eventId", event._id))
    .take(EVENT_LINK_LIMIT);
  const performers: Doc<"performers">[] = [];
  for (const link of links) {
    const performer = await ctx.db.get(link.performerId);
    if (performer && !performers.some((p) => p._id === performer._id)) performers.push(performer);
  }
  const order = (event.performerNames ?? []).map(normalizePerformerName);
  const position = (p: Doc<"performers">) => {
    const index = order.indexOf(p.normalizedName);
    return index < 0 ? order.length : index;
  };
  return performers.sort((a, b) => position(a) - position(b)).slice(0, MAX_PERFORMERS);
}

const affinityFor = (ctx: QueryCtx, userId: Id<"users">, performerId: Id<"performers">) =>
  ctx.db
    .query("affinities")
    .withIndex("by_user_performer", (q) => q.eq("userId", userId).eq("performerId", performerId))
    .first();

// INTEGRATION (People): rankings.rank must call `recordPerformerAffinity(ctx, { userId, eventId, score })`
// after it stores a ranking whose target is an event. On main it does not call it yet.
/** Called by rankings.rank after a user ranks an event: moves their affinity for each performer toward `score` (0–10). */
export async function recordPerformerAffinity(
  ctx: MutationCtx,
  args: { userId: Id<"users">; eventId: Id<"events">; score: number },
): Promise<void> {
  if (!Number.isFinite(args.score)) return;
  const event = await ctx.db.get(args.eventId);
  if (!event) return;
  const performers = await performersOf(ctx, event);
  const now = Date.now();
  for (const [index, performer] of performers.entries()) {
    const row = await affinityFor(ctx, args.userId, performer._id);
    const n = row?.nRankings ?? 0;
    // A follow with no ranking yet holds the neutral placeholder score: the first ranking replaces it.
    const score = affinityStep(n === 0 ? undefined : row?.score, args.score, n, index === 0);
    if (row) await ctx.db.patch(row._id, { score, nRankings: n + 1, updatedAt: now });
    else {
      await ctx.db.insert("affinities", {
        userId: args.userId,
        performerId: performer._id,
        score,
        following: false,
        updatedAt: now,
        nRankings: 1,
      });
    }
  }
}

/** Users who already ranked this event or marked "going": they do not need telling. */
async function engagedWith(ctx: QueryCtx, eventId: Id<"events">): Promise<Set<Id<"users">>> {
  const ranked = await ctx.db
    .query("rankings")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .take(ENGAGED_LIMIT);
  const going = await ctx.db
    .query("saves")
    .withIndex("by_target", (q) => q.eq("targetId", eventId).eq("type", "going"))
    .take(ENGAGED_LIMIT);
  return new Set([...ranked.map((r) => r.userId), ...going.map((s) => s.userId)]);
}

async function alertsInLastDay(ctx: QueryCtx, userId: Id<"users">, now: number): Promise<number> {
  const recent = await ctx.db
    .query("notifications")
    .withIndex("by_user_createdAt", (q) => q.eq("userId", userId).gte("createdAt", now - DAY_MS))
    .take(RECENT_NOTIFICATIONS);
  return recent.filter((n) => n.type === "artist_event").length;
}

/** Apply the alert rule (ALGORITHM.md 4.2) to one fan and one event, and send the notification when it holds. */
async function alertFan(
  ctx: MutationCtx,
  affinity: Affinity,
  performer: Doc<"performers">,
  event: Doc<"events">,
  engaged: Set<Id<"users">>,
  now: number,
): Promise<boolean> {
  const input = {
    following: affinity.following,
    score: affinity.score,
    nRankings: affinity.nRankings ?? 0,
    event: { id: event._id as string, start: event.start, city: event.city, lat: event.lat, lng: event.lng },
    now,
    lastNotifiedEventId: affinity.lastNotifiedEventId,
    alertsLastDay: 0,
    alreadyEngaged: engaged.has(affinity.userId),
  };
  // The cheap conditions first: most rows stop here without reading the user.
  if (!shouldAlert({ ...input, homeCity: event.city })) return false;
  const user = await ctx.db.get(affinity.userId);
  if (!user) return false;
  if (adultsOnly(event) && isUnder21(user.birthday, now)) return false;
  const alertsLastDay = await alertsInLastDay(ctx, affinity.userId, now);
  if (!shouldAlert({ ...input, homeCity: user.homeCity, alertsLastDay })) return false;
  // INTEGRATION (People): notify() is expected to drop this when the user's notifPrefs.artistAlerts
  // is off. On main it does not read notifPrefs yet; nothing here duplicates that check.
  await notify(ctx, {
    userId: affinity.userId,
    type: "artist_event",
    ...alertText({
      performerName: performer.name,
      city: event.city,
      start: event.start,
      venueName: event.venueName,
      following: affinity.following,
      score: affinity.score,
      nRankings: affinity.nRankings ?? 0,
    }),
    link: `/venue/event/${event._id}`,
  });
  await ctx.db.patch(affinity._id, { lastNotifiedEventId: event._id });
  return true;
}

const withinHorizon = (event: Doc<"events">, now: number) =>
  event.start > now && event.start <= now + ALERT_HORIZON_DAYS * DAY_MS;

/** Called by the ingest after a new event is stored: notifies fans of its performers once per event. */
export async function notifyPerformerFans(ctx: MutationCtx, eventId: Id<"events">): Promise<void> {
  const event = await ctx.db.get(eventId);
  const now = Date.now();
  if (!event || !withinHorizon(event, now)) return;
  const performers = await performersOf(ctx, event);
  if (performers.length === 0) return;
  const engaged = await engagedWith(ctx, eventId);
  // One alert per person per event, for the performer highest on the bill that they like.
  const alerted = new Set<Id<"users">>();
  for (const performer of performers) {
    const fans = await ctx.db
      .query("affinities")
      .withIndex("by_performer", (q) => q.eq("performerId", performer._id))
      .take(FAN_LIMIT);
    for (const affinity of fans) {
      if (alerted.has(affinity.userId)) {
        if (affinity.lastNotifiedEventId !== eventId) await ctx.db.patch(affinity._id, { lastNotifiedEventId: eventId });
        continue;
      }
      if (await alertFan(ctx, affinity, performer, event, engaged, now)) alerted.add(affinity.userId);
    }
  }
}

/**
 * Daily catch-up (ALGORITHM.md 4.2): people who started liking or following a performer after the
 * performer's event was imported. Reads affinities changed in the last 25 hours and applies the same
 * alert rule to that performer's next events. Run by a cron in convex/crons.ts.
 */
export const alertRecentFans = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ checked: number; alerted: number }> => {
    const now = Date.now();
    const recent = await ctx.db
      .query("affinities")
      .withIndex("by_updatedAt", (q) => q.gte("updatedAt", now - CATCH_UP_WINDOW_MS))
      .take(CATCH_UP_LIMIT);
    const engagedByEvent = new Map<Id<"events">, Set<Id<"users">>>();
    const alertedFor = new Set<string>();
    let alerted = 0;
    for (const affinity of recent) {
      if (!affinity.following && !(affinity.score >= ALERT_MIN_AFFINITY && (affinity.nRankings ?? 0) >= 1)) continue;
      const performer = await ctx.db.get(affinity.performerId);
      if (!performer) continue;
      const links = await ctx.db
        .query("eventPerformers")
        .withIndex("by_performer", (q) => q.eq("performerId", affinity.performerId).gt("start", now))
        .take(CATCH_UP_EVENTS);
      for (const link of links) {
        const key = `${affinity.userId}|${link.eventId}`;
        if (alertedFor.has(key)) continue;
        const event = await ctx.db.get(link.eventId);
        if (!event || !withinHorizon(event, now)) continue;
        let engaged = engagedByEvent.get(event._id);
        if (!engaged) engagedByEvent.set(event._id, (engaged = await engagedWith(ctx, event._id)));
        if (await alertFan(ctx, affinity, performer, event, engaged, now)) {
          alertedFor.add(key);
          alerted++;
          break;
        }
      }
    }
    return { checked: recent.length, alerted };
  },
});

// ───────────────────────────── public ─────────────────────────────

// INTEGRATION (Brain): events carry `performerNames` (for NearbyItem.performers) and `venueName`;
// VenueDetail.performerCards can come from `forEvent` below; the performer term of the event score
// is `performerBoost(effectiveAffinity(...))` in convex/lib/performers.ts, read from `affinities`
// by `by_user_performer`; `otherUrls` on an event lists the same event's pages on other sources;
// places now carry `website` and `phone` for VenueDetail.
type Viewer = { userId: Id<"users">; under21: boolean; now: number };

async function viewerOf(ctx: QueryCtx): Promise<Viewer | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  const now = Date.now();
  return { userId, under21: isUnder21(user.birthday, now), now };
}

type UpcomingEvent = { id: Id<"events">; title: string; startsAt: number; venueName?: string };

/** A performer's next events, soonest first. Under-21 viewers never get nightlife. */
async function upcomingOf(ctx: QueryCtx, performerId: Id<"performers">, viewer: Viewer, limit: number): Promise<UpcomingEvent[]> {
  const links = await ctx.db
    .query("eventPerformers")
    .withIndex("by_performer", (q) => q.eq("performerId", performerId).gte("start", viewer.now))
    .take(limit + NEXT_EVENT_SCAN);
  const upcoming: UpcomingEvent[] = [];
  for (const link of links) {
    if (upcoming.length >= limit) break;
    const event = await ctx.db.get(link.eventId);
    if (!event || event.start < viewer.now) continue;
    if (viewer.under21 && adultsOnly(event)) continue;
    if (upcoming.some((e) => e.id === event._id)) continue;
    upcoming.push({ id: event._id, title: event.title, startsAt: event.start, venueName: event.venueName });
  }
  return upcoming;
}

async function cardOf(ctx: QueryCtx, performer: Doc<"performers">, viewer: Viewer, affinity?: Affinity | null): Promise<PerformerCard> {
  const mine = affinity === undefined ? await affinityFor(ctx, viewer.userId, performer._id) : affinity;
  const [nextEvent] = await upcomingOf(ctx, performer._id, viewer, 1);
  return {
    performerId: performer._id,
    name: performer.name,
    imageUrl: performer.imageUrl,
    genres: performer.genres ?? [],
    following: mine?.following ?? false,
    affinity: mine && (mine.nRankings ?? 0) >= 1 ? Math.round(mine.score * 10) / 10 : undefined,
    nextEvent,
  };
}

export const search = query({
  args: { text: v.string() },
  handler: async (ctx, { text }): Promise<PerformerCard[]> => {
    const viewer = await viewerOf(ctx);
    const wanted = text.trim().slice(0, 80);
    if (viewer === null || wanted === "") return [];
    const hits = await ctx.db
      .query("performers")
      .withSearchIndex("search_name", (q) => q.search("name", wanted))
      .take(SEARCH_LIMIT);
    return await Promise.all(hits.map((performer) => cardOf(ctx, performer, viewer)));
  },
});

export const get = query({
  args: { performerId: v.id("performers") },
  handler: async (ctx, { performerId }): Promise<(PerformerCard & { upcoming: UpcomingEvent[] }) | null> => {
    const viewer = await viewerOf(ctx);
    const performer = viewer === null ? null : await ctx.db.get(performerId);
    if (viewer === null || performer === null) return null;
    const card = await cardOf(ctx, performer, viewer);
    return { ...card, upcoming: await upcomingOf(ctx, performerId, viewer, UPCOMING_LIMIT) };
  },
});

export const forEvent = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }): Promise<PerformerCard[]> => {
    const viewer = await viewerOf(ctx);
    const event = viewer === null ? null : await ctx.db.get(eventId);
    if (viewer === null || event === null) return [];
    if (viewer.under21 && adultsOnly(event)) return [];
    const performers = await performersOf(ctx, event);
    return await Promise.all(performers.map((performer) => cardOf(ctx, performer, viewer)));
  },
});

/** People I follow or rated highly, the ones I like most first, each with their next event. */
export const following = query({
  args: {},
  handler: async (ctx): Promise<PerformerCard[]> => {
    const viewer = await viewerOf(ctx);
    if (viewer === null) return [];
    const rows = await ctx.db
      .query("affinities")
      .withIndex("by_user", (q) => q.eq("userId", viewer.userId))
      .take(FOLLOWING_SCAN);
    const liked = rows
      .filter((row) => row.following || (row.score >= ALERT_MIN_AFFINITY && (row.nRankings ?? 0) >= 1))
      .sort((a, b) => effectiveAffinity(b.score, b.following) - effectiveAffinity(a.score, a.following))
      .slice(0, FOLLOWING_LIMIT);
    const cards: PerformerCard[] = [];
    for (const row of liked) {
      const performer = await ctx.db.get(row.performerId);
      if (performer) cards.push(await cardOf(ctx, performer, viewer, row));
    }
    return cards;
  },
});

export const follow = mutation({
  args: { performerId: v.id("performers"), follow: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { performerId, follow }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if ((await ctx.db.get(performerId)) === null) throw new Error("That performer no longer exists");
    const row = await affinityFor(ctx, userId, performerId);
    const now = Date.now();
    if (row) {
      if (row.following !== follow) await ctx.db.patch(row._id, { following: follow, updatedAt: now });
    } else if (follow) {
      await ctx.db.insert("affinities", {
        userId,
        performerId,
        score: AFFINITY_NEUTRAL,
        following: true,
        updatedAt: now,
        nRankings: 0,
      });
    }
    return null;
  },
});

/** Performers with a similar sound, most similar first (from the genre vectors). Not in the contract yet: see the Data report. */
export const similar = query({
  args: { performerId: v.id("performers"), limit: v.optional(v.number()) },
  handler: async (ctx, { performerId, limit }): Promise<PerformerCard[]> => {
    const viewer = await viewerOf(ctx);
    const performer = viewer === null ? null : await ctx.db.get(performerId);
    if (viewer === null || performer === null) return [];
    const vectorOf = (p: Doc<"performers">) =>
      p.vector?.length === FEATURES.length ? p.vector : genresToVector(p.genres ?? []);
    if (!performer.genres?.length) return [];
    const mine = vectorOf(performer);
    const pool = await ctx.db.query("performers").take(SIMILAR_SCAN);
    const best = pool
      .filter((p) => p._id !== performerId && (p.genres?.length ?? 0) > 0)
      .map((p) => ({ p, sim: performerSimilarity(mine, vectorOf(p)) }))
      .filter(({ sim }) => sim >= SIMILAR_MIN)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, Math.min(Math.max(1, Math.floor(limit ?? SIMILAR_LIMIT)), 20));
    return await Promise.all(best.map(({ p }) => cardOf(ctx, p, viewer)));
  },
});
