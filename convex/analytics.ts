// Owner: Data session. Venue analytics for us, the developers: what a venue would pay to know about
// its visitors. Internal only: nothing here is reachable from the app, only from the dashboard or
// `npx convex run analytics:venues '{"limit": 20}'` and `npx convex run analytics:venue '{"name": "Third Rail"}'`.
// Everything is a count or an average over the people who ranked, saved or compared a venue. No row
// names a person, and a breakdown by age or by local/visitor is left out (null) until at least
// MIN_AUDIENCE different people are behind it, so no single person can be read out of a report.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery, type QueryCtx } from "./_generated/server";

const SCAN = 8000;
const MIN_AUDIENCE = 5;
const DEFAULT_VENUES = 25;
const MAX_VENUES = 200;
const MAX_AUDIENCE_USERS = 400;
const TOP_TAGS = 6;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

type TargetId = Id<"places"> | Id<"events">;
const round = (x: number, digits = 1) => Math.round(x * 10 ** digits) / 10 ** digits;
const share = (part: number, whole: number) => (whole === 0 ? 0 : round(part / whole, 2));
const partOfDay = (hour: number) => (hour < 5 ? "late night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 22 ? "evening" : "late night");
const ageBand = (age: number) => (age < 21 ? "under 21" : age < 25 ? "21-24" : age < 30 ? "25-29" : age < 40 ? "30-39" : "40+");

type Activity = {
  rankings: Doc<"rankings">[];
  want: number;
  going: number;
  wins: number;
  losses: number;
  posts: number;
};

/** Everything people did, grouped by the venue or event it was about. Each table is read once, newest first, up to SCAN rows. */
async function loadActivity(ctx: QueryCtx) {
  const [rankings, saves, comparisons, posts] = await Promise.all([
    ctx.db.query("rankings").order("desc").take(SCAN),
    ctx.db.query("saves").order("desc").take(SCAN),
    ctx.db.query("comparisons").order("desc").take(SCAN),
    ctx.db.query("posts").order("desc").take(SCAN),
  ]);
  const byTarget = new Map<string, Activity>();
  const of = (id: string) => {
    let entry = byTarget.get(id);
    if (!entry) byTarget.set(id, (entry = { rankings: [], want: 0, going: 0, wins: 0, losses: 0, posts: 0 }));
    return entry;
  };
  for (const ranking of rankings) {
    const id = ranking.placeId ?? ranking.eventId;
    if (id !== undefined) of(id).rankings.push(ranking);
  }
  for (const save of saves) of(save.targetId)[save.type]++;
  for (const comparison of comparisons) {
    of(comparison.winnerId).wins++;
    of(comparison.loserId).losses++;
  }
  for (const post of posts) of(post.targetId).posts++;
  const truncated = [rankings, saves, comparisons, posts].some((rows) => rows.length === SCAN);
  return { byTarget, truncated, totals: { rankings: rankings.length, saves: saves.length, comparisons: comparisons.length, posts: posts.length } };
}

/** One venue's numbers. `audience` (age, local or visitor) needs MIN_AUDIENCE different people. */
async function report(ctx: QueryCtx, id: TargetId, doc: Doc<"places"> | Doc<"events">, activity: Activity, now: number) {
  const { rankings } = activity;
  const n = rankings.length;
  const people = [...new Set(rankings.map((ranking) => ranking.userId))];
  const count = <K extends string>(keys: K[]) => keys.reduce<Record<string, number>>((tally, key) => ((tally[key] = (tally[key] ?? 0) + 1), tally), {});
  const timed = rankings.filter((ranking) => ranking.dayOfWeek !== undefined && ranking.hour !== undefined);
  const groups = rankings.flatMap((ranking) => (ranking.groupSize === undefined ? [] : [ranking.groupSize]));
  const tags = Object.entries(count(rankings.flatMap((ranking) => ranking.tags ?? [])))
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_TAGS)
    .map(([tag, uses]) => ({ tag, uses }));
  let audience: { people: number; localShare: number; ages: Record<string, number> | null } | null = null;
  if (people.length >= MIN_AUDIENCE) {
    const users = await Promise.all(people.slice(0, MAX_AUDIENCE_USERS).map((userId) => ctx.db.get(userId)));
    const ages = users.flatMap((user) => {
      const born = user?.birthday ? Date.parse(user.birthday) : NaN;
      return Number.isFinite(born) ? [ageBand(Math.floor((now - born) / YEAR_MS))] : [];
    });
    audience = {
      people: people.length,
      localShare: share(rankings.filter((ranking) => ranking.wasLocal).length, n),
      ages: ages.length >= MIN_AUDIENCE ? count(ages) : null,
    };
  }
  return {
    id,
    kind: "name" in doc ? ("place" as const) : ("event" as const),
    name: "name" in doc ? doc.name : doc.title,
    category: doc.category,
    subcategory: doc.subcategory,
    city: doc.city,
    rankings: n,
    people: people.length,
    averageScore: n === 0 ? null : round(rankings.reduce((sum, ranking) => sum + ranking.score, 0) / n),
    lovedShare: share(rankings.filter((ranking) => ranking.bucket === "loved").length, n),
    fineShare: share(rankings.filter((ranking) => ranking.bucket === "fine").length, n),
    didntShare: share(rankings.filter((ranking) => ranking.bucket === "didnt").length, n),
    savedForLater: activity.want,
    going: activity.going,
    posts: activity.posts,
    headToHead: { wins: activity.wins, losses: activity.losses, winRate: share(activity.wins, activity.wins + activity.losses) },
    visitsByDay: count(timed.map((ranking) => DAYS[ranking.dayOfWeek!])),
    visitsByPartOfDay: count(timed.map((ranking) => partOfDay(ranking.hour!))),
    averageGroupSize: groups.length === 0 ? null : round(groups.reduce((sum, size) => sum + size, 0) / groups.length),
    topTags: tags,
    googleRating: "externalRating" in doc ? (doc.externalRating ?? null) : null,
    audience,
  };
}

/**
 * The venues with the most activity (rankings, saves, comparisons and posts together), each with its
 * report: `npx convex run analytics:venues '{"limit": 20, "category": "nightlife"}'`.
 */
export const venues = internalQuery({
  args: { limit: v.optional(v.number()), category: v.optional(v.string()) },
  handler: async (ctx, { limit, category }) => {
    const now = Date.now();
    const { byTarget, truncated, totals } = await loadActivity(ctx);
    const max = Math.min(MAX_VENUES, Math.max(1, Math.round(limit ?? DEFAULT_VENUES)));
    const busiest = [...byTarget.entries()]
      .map(([id, activity]) => ({ id, activity, weight: activity.rankings.length * 3 + activity.want + activity.going + activity.wins + activity.losses + activity.posts }))
      .sort((a, b) => b.weight - a.weight);
    const rows = [];
    for (const { id, activity } of busiest) {
      if (rows.length >= max) break;
      const doc = await ctx.db.get(id as TargetId);
      if (doc === null || (category !== undefined && doc.category !== category)) continue;
      rows.push(await report(ctx, id as TargetId, doc, activity, now));
    }
    return { generatedAt: now, venuesWithActivity: byTarget.size, totals, truncated, minAudience: MIN_AUDIENCE, venues: rows };
  },
});

/** One venue's report, by exact name or by id: `npx convex run analytics:venue '{"name": "Third Rail"}'`. */
export const venue = internalQuery({
  args: { name: v.optional(v.string()), placeId: v.optional(v.id("places")), eventId: v.optional(v.id("events")) },
  handler: async (ctx, { name, placeId, eventId }) => {
    let doc: Doc<"places"> | Doc<"events"> | null = placeId ? await ctx.db.get(placeId) : eventId ? await ctx.db.get(eventId) : null;
    if (doc === null && name !== undefined) {
      doc = (await ctx.db.query("places").withSearchIndex("search_name", (q) => q.search("name", name)).take(20)).find((place) => place.name === name) ?? null;
    }
    if (doc === null) return null;
    const { byTarget, truncated } = await loadActivity(ctx);
    const activity = byTarget.get(doc._id) ?? { rankings: [], want: 0, going: 0, wins: 0, losses: 0, posts: 0 };
    return { truncated, minAudience: MIN_AUDIENCE, ...(await report(ctx, doc._id, doc, activity, Date.now())) };
  },
});
