// Owner: Brain session. Post-rating questions, venue insights and the venue dashboard (docs/CONTRACT.md,
// docs/ALGORITHM.md section 3). Answers are stored per person so they can be replaced; only totals leave.
import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internalQuery, mutation, query, QueryCtx } from "./_generated/server";
import type { Category, InsightAnswer, InsightQuestion, VenueDashboard, VenueInsights } from "./lib/contract";
import { Candidate, getCandidate, isUnder21, sameCity, venueVectorOf } from "./lib/discovery";
import {
  ALSO_LOVED_SIZE, ALSO_MIN_SUPPORT, Counts, MAX_ANSWERS_PER_SUBMIT, addAnswers, audienceProfile, blendVector, bucketCounts,
  cleanAnswers, coLoved, hasObservations, histogram, lift, observedVector, pickQuestions, removeAnswers, summarize,
  weeklyTrend, winRecord,
} from "./lib/insights";
import { FEATURES } from "./lib/recs";

const MAX_OPTIONS_PER_ANSWER = 12;
const MAX_MY_ANSWER_ROWS = 40;        // more than the whole bank, so one read replaces everything I said
const MAX_MY_RANKINGS_SCANNED = 300;
const MAX_RANKINGS = 500;             // per venue, newest first
const MAX_AUDIENCE_USERS = 150;
const COMPARISON_SCAN = 2000;         // comparisons has no index by item yet (ALGORITHM.md 3e)
const MAX_BEATS = 10;
const ALSO_MAX_LOVERS = 50;
const ALSO_LISTS_PER_LOVER = 30;
const ALSO_MAX_CANDIDATES = 8;
const ALSO_RATERS_PER_CANDIDATE = 150;

const kindValidator = v.union(v.literal("place"), v.literal("event"));
const answerValidator = v.object({ questionId: v.string(), optionIds: v.array(v.string()) });

type ItemId = Id<"places"> | Id<"events">;

const statsOf = (ctx: QueryCtx, targetId: ItemId) =>
  ctx.db.query("venueStats").withIndex("by_target", (q) => q.eq("targetId", targetId)).first();

/** The newest rankings of one place or event, capped. */
function rankingsOf(ctx: QueryCtx, candidate: Candidate, limit: number): Promise<Doc<"rankings">[]> {
  if (candidate.kind === "place") {
    const placeId = candidate.doc._id;
    return ctx.db.query("rankings").withIndex("by_place", (q) => q.eq("placeId", placeId)).order("desc").take(limit);
  }
  const eventId = candidate.doc._id;
  return ctx.db.query("rankings").withIndex("by_event", (q) => q.eq("eventId", eventId)).order("desc").take(limit);
}

/** Under-21 users never get nightlife, here as everywhere else. */
async function hiddenFrom(ctx: QueryCtx, userId: Id<"users"> | null, category: Category): Promise<boolean> {
  if (category !== "nightlife" || userId === null) return false;
  const user = await ctx.db.get(userId);
  return user !== null && isUnder21(user.birthday, Date.now());
}

function insightsOf(candidate: Candidate, stats: Doc<"venueStats"> | null, rankings: Doc<"rankings">[]): VenueInsights {
  const nAnswers = stats?.nAnswers ?? 0;
  const summary = summarize(candidate.doc.category, stats?.counts as Counts | undefined, nAnswers);
  const nRatings = rankings.length;
  return {
    kind: candidate.kind,
    id: candidate.doc._id,
    nRatings,
    avgScore: nRatings === 0 ? undefined : Math.round((rankings.reduce((s, r) => s + r.score, 0) / nRatings) * 10) / 10,
    nAnswers,
    ...summary,
  };
}

/** The 3-4 questions to ask me about this venue: where we know least, always one universal. */
export const questionsFor = query({
  args: { kind: kindValidator, id: v.string() },
  handler: async (ctx, args): Promise<InsightQuestion[]> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const candidate = await getCandidate(ctx, args.kind, args.id);
    if (candidate === null || (await hiddenFrom(ctx, userId, candidate.doc.category))) return [];
    const stats = await statsOf(ctx, candidate.doc._id);
    return pickQuestions(candidate.doc.category, stats?.counts as Counts | undefined, { seed: userId });
  },
});

/**
 * Saves my answers for one venue, replacing whatever I answered there before, then re-measures the venue:
 * totals in venueStats, and the blended vector in `learnedVector` on the place or event (the only field
 * this touches there).
 */
export const submit = mutation({
  args: {
    kind: kindValidator,
    id: v.string(),
    rankingId: v.optional(v.id("rankings")),
    answers: v.array(answerValidator),
  },
  handler: async (ctx, args): Promise<{ saved: number; highlights: string[] }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if (args.answers.length > MAX_ANSWERS_PER_SUBMIT) throw new Error(`At most ${MAX_ANSWERS_PER_SUBMIT} answers at a time`);
    if (args.answers.some((a) => a.optionIds.length > MAX_OPTIONS_PER_ANSWER)) throw new Error("Too many options in one answer");
    const candidate = await getCandidate(ctx, args.kind, args.id);
    if (candidate === null) throw new Error("That place or event no longer exists");
    const { doc } = candidate;
    const targetId: ItemId = doc._id;
    const user = await ctx.db.get(userId);
    if (user === null) throw new Error("Not signed in");
    if (doc.category === "nightlife" && isUnder21(user.birthday, Date.now())) throw new Error("That place or event no longer exists");

    // My ranking of this target carries the context of the visit. A rankingId that is not mine, or is for
    // somewhere else, is ignored rather than trusted.
    let ranking: Doc<"rankings"> | null = null;
    if (args.rankingId !== undefined) {
      const given = await ctx.db.get(args.rankingId);
      if (given !== null && given.userId === userId && (given.placeId ?? given.eventId) === targetId) ranking = given;
    }
    if (ranking === null) {
      const mine = await ctx.db
        .query("rankings")
        .withIndex("by_user_category", (q) => q.eq("userId", userId).eq("category", doc.category))
        .take(MAX_MY_RANKINGS_SCANNED);
      ranking = mine.find((r) => (r.placeId ?? r.eventId) === targetId) ?? null;
    }
    const wasLocal = ranking?.wasLocal ?? sameCity(user.homeCity, doc.city);

    const stats = await statsOf(ctx, targetId);
    let counts = addAnswers(stats?.counts as Counts | undefined, []);
    let localCounts = addAnswers(stats?.localCounts as Counts | undefined, []);

    const old = await ctx.db
      .query("visitAnswers")
      .withIndex("by_user_target", (q) => q.eq("userId", userId).eq("targetId", targetId))
      .take(MAX_MY_ANSWER_ROWS);
    for (const row of old) {
      const earlier: InsightAnswer[] = [{ questionId: row.questionId, optionIds: row.optionIds }];
      counts = removeAnswers(counts, earlier);
      if (row.wasLocal === true) localCounts = removeAnswers(localCounts, earlier);
      await ctx.db.delete(row._id);
    }

    const answers = cleanAnswers(doc.category, args.answers);
    const now = Date.now();
    for (const answer of answers) {
      await ctx.db.insert("visitAnswers", {
        userId,
        targetKind: candidate.kind,
        targetId,
        category: doc.category,
        questionId: answer.questionId,
        optionIds: answer.optionIds,
        createdAt: now,
        rankingId: ranking?._id,
        wasLocal,
        dayOfWeek: ranking?.dayOfWeek,
        hour: ranking?.hour,
      });
    }
    counts = addAnswers(counts, answers);
    if (wasLocal) localCounts = addAnswers(localCounts, answers);

    const nAnswers = Math.max(0, (stats?.nAnswers ?? 0) - (old.length > 0 ? 1 : 0) + (answers.length > 0 ? 1 : 0));
    const observed = observedVector(counts, localCounts);
    const totals = {
      nAnswers, counts, localCounts, observedVector: observed.vector, observedWeight: observed.weight, updatedAt: now,
    };
    if (stats === null) await ctx.db.insert("venueStats", { targetKind: candidate.kind, targetId, ...totals });
    else await ctx.db.patch(stats._id, totals);

    // The prior is the featurizer's guess (venueVector or the category preset), never an earlier blend,
    // so re-submitting cannot compound. With nothing measured the field is cleared and the prior is used.
    const prior = venueVectorOf({ venueVector: doc.venueVector, category: doc.category });
    const learnedVector = hasObservations(observed.weight) && prior.length === FEATURES.length
      ? blendVector(prior, observed.vector, observed.weight)
      : undefined;
    if (candidate.kind === "place") await ctx.db.patch(candidate.doc._id, { learnedVector });
    else await ctx.db.patch(candidate.doc._id, { learnedVector });

    return { saved: answers.length, highlights: summarize(doc.category, counts, nAnswers).highlights };
  },
});

/** Totals per question, highlights and "best for" for one venue. Nothing is stated under 5 respondents. */
export const venue = query({
  args: { kind: kindValidator, id: v.string() },
  handler: async (ctx, args): Promise<VenueInsights | null> => {
    const candidate = await getCandidate(ctx, args.kind, args.id);
    if (candidate === null) return null;
    if (await hiddenFrom(ctx, await getAuthUserId(ctx), candidate.doc.category)) return null;
    const stats = await statsOf(ctx, candidate.doc._id);
    return insightsOf(candidate, stats, await rankingsOf(ctx, candidate, MAX_RANKINGS));
  },
});

/** Everything a venue would want to know about itself (ALGORITHM.md 3e). One venue at a time; never called from a list. */
export const dashboard = query({
  args: { kind: kindValidator, id: v.string() },
  handler: async (ctx, args): Promise<VenueDashboard | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const candidate = await getCandidate(ctx, args.kind, args.id);
    if (candidate === null || (await hiddenFrom(ctx, userId, candidate.doc.category))) return null;
    const itemId: ItemId = candidate.doc._id;
    const stats = await statsOf(ctx, itemId);
    const rankings = await rankingsOf(ctx, candidate, MAX_RANKINGS);

    // Audience: the taste of the people who loved it, against everyone who rated it.
    const raterIds = [...new Set(rankings.map((r) => r.userId))].slice(0, MAX_AUDIENCE_USERS);
    const raters = await Promise.all(raterIds.map((id) => ctx.db.get(id)));
    const tasteById = new Map<Id<"users">, number[]>();
    for (const u of raters) if (u !== null && u.tasteVector?.length === FEATURES.length) tasteById.set(u._id, u.tasteVector);
    const loverIds = [...new Set(rankings.filter((r) => r.bucket === "loved").map((r) => r.userId))];
    const loverTastes = loverIds.flatMap((id) => (tasteById.has(id) ? [tasteById.get(id)!] : []));

    // Head to head. INTEGRATION: when People adds by_winner / by_loser indexes on comparisons, read those instead of scanning.
    const recent = await ctx.db.query("comparisons").order("desc").take(COMPARISON_SCAN);
    const record = winRecord(itemId, recent);
    const beats: VenueDashboard["beats"] = [];
    for (const o of record.opponents.slice(0, MAX_BEATS)) {
      const other = await ctx.db.get(o.id as ItemId);
      if (other !== null) beats.push({ id: other._id, name: "name" in other ? other.name : other.title, wins: o.wins, losses: o.losses });
    }

    // Also loved: what else the people who loved this loved, as lift over how loved those places are anyway.
    const lovedLists: string[][] = [];
    const seenUsers = new Set<Id<"users">>(rankings.map((r) => r.userId));
    for (const loverId of loverIds.slice(0, ALSO_MAX_LOVERS)) {
      const theirs = await ctx.db
        .query("rankings")
        .withIndex("by_user_category", (q) => q.eq("userId", loverId))
        .order("desc")
        .take(ALSO_LISTS_PER_LOVER);
      lovedLists.push(theirs.filter((r) => r.bucket === "loved").flatMap((r) => r.placeId ?? r.eventId ?? []));
    }
    const candidates = coLoved(itemId, lovedLists, ALSO_MIN_SUPPORT).slice(0, ALSO_MAX_CANDIDATES);
    const loaded: { doc: Doc<"places"> | Doc<"events">; kind: "place" | "event"; both: number; lovers: number }[] = [];
    for (const c of candidates) {
      const placeId = ctx.db.normalizeId("places", c.id);
      const eventId = placeId === null ? ctx.db.normalizeId("events", c.id) : null;
      const other: Candidate | null = placeId !== null
        ? await getCandidate(ctx, "place", placeId)
        : eventId !== null ? await getCandidate(ctx, "event", eventId) : null;
      if (other === null) continue;
      const theirRatings = await rankingsOf(ctx, other, ALSO_RATERS_PER_CANDIDATE);
      for (const r of theirRatings) seenUsers.add(r.userId);
      const lovers = new Set(theirRatings.filter((r) => r.bucket === "loved").map((r) => r.userId)).size;
      loaded.push({ doc: other.doc, kind: other.kind, both: c.both, lovers: Math.max(lovers, c.both) });
    }
    // N = the raters seen in this sample: a lower bound on "users with a ranking", so lift is never overstated.
    const alsoLoved: VenueDashboard["alsoLoved"] = loaded
      .map((o) => ({
        kind: o.kind,
        id: o.doc._id,
        name: "name" in o.doc ? o.doc.name : o.doc.title,
        lift: Math.round(lift(o.both, loverIds.length, o.lovers, seenUsers.size) * 100) / 100,
      }))
      .sort((a, b) => b.lift - a.lift)
      .slice(0, ALSO_LOVED_SIZE);

    return {
      ...insightsOf(candidate, stats, rankings),
      audience: audienceProfile(loverTastes, [...tasteById.values()]),
      localsPct: rankings.length === 0 ? 0 : Math.round((rankings.filter((r) => r.wasLocal === true).length / rankings.length) * 100),
      buckets: bucketCounts(rankings.map((r) => r.bucket)),
      visitsByHour: histogram(rankings.map((r) => r.hour), 24),
      visitsByDay: histogram(rankings.map((r) => r.dayOfWeek), 7),
      winRate: record.winRate,
      beats,
      alsoLoved,
      trend: weeklyTrend(rankings.map((r) => ({ at: r.visitedAt ?? r._creationTime, score: r.score }))),
    };
  },
});

/** For building a dataset: every answer, oldest first, with no user id. Internal and paginated. */
export const exportAnswers = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("visitAnswers").order("asc").paginate(args.paginationOpts);
    return {
      isDone: result.isDone,
      continueCursor: result.continueCursor,
      page: result.page.map((row) => ({
        targetId: row.targetId,
        targetKind: row.targetKind,
        category: row.category,
        questionId: row.questionId,
        optionIds: row.optionIds,
        wasLocal: row.wasLocal,
        dayOfWeek: row.dayOfWeek,
        hour: row.hour,
        createdAt: row.createdAt,
      })),
    };
  },
});
