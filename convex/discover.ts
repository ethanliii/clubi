import { v } from "convex/values";
import { query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import type {
  Category, GroupItem, GroupResult, NearbyItem, NearbyResult, PlanMember, PlanResult, PlanSlot, PlanStop,
} from "./lib/contract";
import {
  ALGO, ATTRIBUTION, AffinityRow, Candidate, DEFAULT_LIMIT, DEFAULT_RADIUS_METERS, EVENT_DEFAULT_LENGTH_MS, MAX_CANDIDATES,
  Scored, TONIGHT_WINDOW_MS, UserLoader, Viewer,
  affinitiesOf, avatarUrlOf, displayNameOf, friendIdsOf, getCandidate, haversineMeters, isUnder21, isVisibleTo,
  loadEventsBetween, loadInRadius, loadLikedPerformerEvents, loadViewer, matchesFilter, nearestMatching, newestRankingsOf,
  postOfRanking, rankItems, sameCity, scoreAll, tasteOf, tierForRank, userLoader, venueVectorOf, withTag,
} from "./lib/discovery";
import { VoteTally, fairWeights, groupScoreV2, groupWhy, tallyVotes } from "./lib/group";
import {
  FEATURES, clip, effectiveAffinity, mapRank, matchPct, mayShowRanking, performerTerm, predict, similarValue, similarity,
  takeAcross, topFeatures, whyFromFeatures,
} from "./lib/recs";

const TOP_PICKS = 6;
const SECTION_SIZE = 10;
/** Members whose own score is worked out for every candidate. */
const MAX_PLAN_MEMBERS = 8;
/** Members a group is checked over: the under-21 rule and the trip's votes cover all of these, scored or not. */
const MAX_GROUP_READ = 64;
/** A member's own rankings read per category that has a candidate, newest first. */
const MAX_MEMBER_RANKINGS_PER_CATEGORY = 150;
const MAX_TRIP_VOTES = 500;
const GROUP_MAX_CANDIDATES = 80;
const GROUP_DEFAULT_LIMIT = 30;
const UPCOMING_RADIUS_METERS = 60_000;
const UPCOMING_DEFAULT_DAYS = 14;
const UPCOMING_MAX_DAYS = 60;
const UPCOMING_DEFAULT_LIMIT = 30;
/** The window is read in this many equal parts, so its last days get candidates as well as its first. */
const UPCOMING_SLICES = 40;
const UPCOMING_SCAN_PER_SLICE = 10;
const SIMILAR_RADIUS_METERS = 5000;
const SIMILAR_DEFAULT_LIMIT = 8;
const SIMILAR_POOL_SIZE = 40;
const MAX_LIST_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
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
      // What friends marked "going" comes first, then what friends have ranked.
      friendsGoing: renumber([
        ...rankItems(scored.filter((s) => s.terms.friendsGoing > 0), SECTION_SIZE),
        ...rankItems(scored.filter((s) => s.terms.friendsGoing === 0 && s.item.friends.length > 0), SECTION_SIZE),
      ].slice(0, SECTION_SIZE)),
      events: rankItems(scored.filter((s) => eventishIds.has(s.item.id)), SECTION_SIZE),
    };
  },
});

const renumber = (items: NearbyItem[]): NearbyItem[] =>
  items.map((item, i) => ({ ...item, rank: i + 1, tier: tierForRank(i + 1) }));

const round1 = (x: number) => Math.round(x * 10) / 10;

const memberOf = (user: Doc<"users">): PlanMember => ({
  userId: user._id,
  displayName: displayNameOf(user),
  avatarUrl: avatarUrlOf(user),
});

type Group = {
  /** The members scored one by one: the caller first, at most MAX_PLAN_MEMBERS. */
  members: Doc<"users">[];
  trip: Doc<"trips"> | null;
  votes: Map<string, VoteTally>;
  /** True when anyone in the whole group (not only the scored members) is under 21: no nightlife then. */
  anyUnder21: boolean;
};

/**
 * Who is being planned for. With a trip: its owner and joined members, with the trip's votes; null when the
 * caller is not one of them (checked by a direct lookup, so a big trip cannot lose the caller). Without: the
 * caller and the picked accepted friends. Signed out: nobody. The under-21 rule and the votes cover everyone
 * read (MAX_GROUP_READ); a trip with more joined members than that is treated as having someone under 21.
 */
async function resolveGroup(
  ctx: QueryCtx, viewer: Viewer, getUser: UserLoader, memberIds: Id<"users">[] | undefined, tripId: Id<"trips"> | undefined,
  now: number,
): Promise<Group | null> {
  const me = viewer.userId;
  let wanted: Id<"users">[] = [];
  let trip: Doc<"trips"> | null = null;
  let overflow = false;
  if (tripId !== undefined) {
    trip = await ctx.db.get(tripId);
    if (trip === null || me === null) return null;
    if (trip.ownerId !== me) {
      const mine = await ctx.db
        .query("tripMembers")
        .withIndex("by_user", (q) => q.eq("userId", me).eq("status", "joined"))
        .filter((q) => q.eq(q.field("tripId"), tripId))
        .first();
      if (mine === null) return null;
    }
    const joined = await ctx.db
      .query("tripMembers")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId).eq("status", "joined"))
      .take(MAX_GROUP_READ + 1);
    overflow = joined.length > MAX_GROUP_READ;
    wanted = [me, trip.ownerId, ...joined.map((m) => m.userId)];
  } else if (me !== null) {
    wanted = [me, ...(memberIds ?? []).filter((id) => viewer.friendIds.has(id))];
  }
  const everyone: Doc<"users">[] = [];
  for (const id of [...new Set(wanted)].slice(0, MAX_GROUP_READ + 2)) {
    const user = await getUser(id);
    if (user !== null) everyone.push(user);
  }
  const members = everyone.slice(0, MAX_PLAN_MEMBERS);
  let votes = new Map<string, VoteTally>();
  if (tripId !== undefined) {
    const rows = await ctx.db
      .query("tripVotes")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId))
      .take(MAX_TRIP_VOTES);
    for (const [targetId, tally] of tallyVotes(rows, everyone.map((m) => m._id))) votes.set(targetId, { ...tally, of: everyone.length });
  }
  const anyUnder21 = viewer.under21 || overflow || everyone.some((user) => isUnder21(user.birthday, now));
  return { members, trip, votes, anyUnder21 };
}

/**
 * Each member's own score for an item the viewer's query already scored: their own ranking when they have
 * one the viewer may see, else the same prediction the map would show them (their taste, their friends among
 * the loaded raters, whether they are a local, their performer affinities). A ranking is as visible as its
 * post: a member's "Only me" ranking is theirs alone, and a trip member who is not the viewer's friend shows
 * only public ones. For the rest the group gets the prediction, never the score they gave.
 */
async function memberScorer(ctx: QueryCtx, viewer: Viewer, group: Doc<"users">[], candidates: Candidate[]) {
  const friendsOf = new Map<string, Set<Id<"users">>>();
  const ownScores = new Map<string, Map<string, number>>();
  const affinities = new Map<string, Map<string, AffinityRow>>();
  const candidateIds = new Set<string>(candidates.map((c) => c.doc._id));
  const categories = [...new Set(candidates.map((c) => c.doc.category))];
  for (const user of group) {
    if (user._id === viewer.userId) continue;
    friendsOf.set(user._id, await friendIdsOf(ctx, user._id));
    affinities.set(user._id, await affinitiesOf(ctx, user._id));
    const rankings = await newestRankingsOf(ctx, user._id, MAX_MEMBER_RANKINGS_PER_CATEGORY, categories);
    const scores = new Map<string, number>();
    for (const r of rankings) {
      const itemId = r.placeId ?? r.eventId;
      if (itemId === undefined || !candidateIds.has(itemId)) continue;
      const post = await postOfRanking(ctx, r._id);
      if (mayShowRanking(post?.visibility, viewer.friendIds.has(user._id))) scores.set(itemId, clip(r.score, 1, 10));
    }
    ownScores.set(user._id, scores);
  }
  const cityOf = new Map<string, string | undefined>(candidates.map((c) => [c.doc._id, c.doc.city]));
  const me = group.find((user) => user._id === viewer.userId);

  return (s: Scored, user: Doc<"users">): number => {
    if (user._id === viewer.userId) return s.terms.score;
    const own = ownScores.get(user._id)?.get(s.item.id);
    if (own !== undefined) return own;
    const city = cityOf.get(s.item.id);
    const everyone = s.mine === null || me === undefined ? s.raters : [...s.raters, {
      userId: me._id,
      taste: tasteOf(me),
      score: clip(s.mine.score, 1, 10),
      given: s.mine.score,
      local: me.homeCity !== undefined && city !== undefined ? sameCity(me.homeCity, city) : s.mine.wasLocal ?? false,
      friend: false,
      name: displayNameOf(me),
    }];
    const friends = friendsOf.get(user._id);
    const raters = everyone
      .filter((r) => r.userId !== user._id)
      .map((r) => ({ ...r, friend: friends?.has(r.userId) ?? false }));
    const theirs = affinities.get(user._id);
    const liked = s.performerIds.flatMap((id) => {
      const row = theirs?.get(id);
      return row === undefined ? [] : [effectiveAffinity(row)];
    });
    const performer = performerTerm(liked.length === 0 ? undefined : Math.max(...liked));
    return predict(tasteOf(user), s.vector, s.terms.elo, raters, sameCity(user.homeCity, city), { performer }).score;
  };
}

/**
 * One list ranked for a whole group: every member's own score, combined by groupScoreV2 (average and least
 * happy member, minus disagreement, plus the trip's votes; dropped when anyone would hate it).
 */
export const forGroup = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    memberIds: v.optional(v.array(v.id("users"))),
    tripId: v.optional(v.id("trips")),
    filter: v.optional(filterValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<GroupResult> => {
    const now = Date.now();
    const filter = args.filter ?? "all";
    const limit = clip(Math.round(args.limit ?? GROUP_DEFAULT_LIMIT), 1, MAX_LIST_LIMIT);
    const viewer = await loadViewer(ctx, now);
    const group = await resolveGroup(ctx, viewer, userLoader(ctx), args.memberIds, args.tripId, now);
    const center = { lat: group?.trip?.lat ?? args.lat, lng: group?.trip?.lng ?? args.lng };
    if (group === null) return { items: [], members: [], center, algo: ALGO, generatedAt: now };
    const { members, votes, anyUnder21 } = group;

    const pool = await loadInRadius(ctx, center.lat, center.lng, DEFAULT_RADIUS_METERS, now);
    // A trip is planned ahead, so a place that is closed right now still belongs on its list.
    const candidates = nearestMatching(pool, (c) =>
      !(anyUnder21 && c.doc.category === "nightlife")
      && (group.trip !== null || isVisibleTo(c, viewer, now))
      && matchesFilter(c, filter, now)).slice(0, GROUP_MAX_CANDIDATES);
    const scored = await scoreAll(ctx, candidates, viewer, center.lat, center.lng, now);
    const scoreFor = await memberScorer(ctx, viewer, members, candidates);

    const extras = new Map<string, Pick<GroupItem, "memberScores" | "agreement">>();
    const together: Scored[] = [];
    for (const s of scored) {
      const scores = members.length === 0 ? [s.terms.score] : members.map((user) => scoreFor(s, user));
      const result = groupScoreV2(scores, { votes: votes.get(s.item.id) });
      if (result === null) continue;
      const score = round1(result.score);
      const reason = members.length < 2
        ? s.reason
        : groupWhy(members.map((user, i) => ({ name: displayNameOf(user), score: scores[i] })));
      extras.set(s.item.id, {
        memberScores: members.map((user, i) => ({ ...memberOf(user), score: round1(scores[i]) })),
        agreement: Math.round(result.agreement * 100) / 100,
      });
      together.push({
        ...s,
        reason,
        // Same distance, time, exploration and friends terms as the map, around the group score.
        order: s.order - s.terms.score + result.score,
        item: { ...s.item, score, matchPct: matchPct(score), why: withTag(reason, s.tag) },
      });
    }
    return {
      items: rankItems(together, limit).map((item) => ({ ...item, ...extras.get(item.id)! })),
      members: members.map(memberOf),
      center,
      algo: ALGO,
      generatedAt: now,
    };
  },
});

/**
 * Three stops for the viewer and the accepted friends they pick (or a trip's members), each chosen by the
 * group score and by how well its energy fits the vibe and the hour. Between stops the fairness weights
 * shift toward whoever compromised most so far.
 */
export const plan = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    memberIds: v.optional(v.array(v.id("users"))),
    vibe: v.optional(v.string()),
    tripId: v.optional(v.id("trips")),
  },
  handler: async (ctx, args): Promise<PlanResult> => {
    const now = Date.now();
    const viewer = await loadViewer(ctx, now);
    const resolved = await resolveGroup(ctx, viewer, userLoader(ctx), args.memberIds, args.tripId, now);
    const wantedVibe = args.vibe ?? resolved?.trip?.vibe;
    const vibe = wantedVibe !== undefined && Object.hasOwn(VIBE_ENERGY, wantedVibe) ? wantedVibe : DEFAULT_VIBE;
    const center = { lat: resolved?.trip?.lat ?? args.lat, lng: resolved?.trip?.lng ?? args.lng };
    if (resolved === null) return { stops: [], members: [], vibe, center, algo: ALGO, generatedAt: now };
    const { members: group, votes, anyUnder21 } = resolved;

    const pool = await loadInRadius(ctx, center.lat, center.lng, DEFAULT_RADIUS_METERS, now);
    const candidates = nearestMatching(pool, (c) =>
      !(anyUnder21 && c.doc.category === "nightlife") && (c.kind === "place" || c.doc.start <= now + TONIGHT_WINDOW_MS));
    const scored = await scoreAll(ctx, candidates, viewer, center.lat, center.lng, now);
    const scoreFor = await memberScorer(ctx, viewer, group, candidates);

    // The veto does not depend on the fairness weights, so it is applied once.
    const options = scored.flatMap((s) => {
      const scores = group.length === 0 ? [s.terms.score] : group.map((user) => scoreFor(s, user));
      return groupScoreV2(scores) === null ? [] : [{ s, scores }];
    });
    const groupTaste = FEATURES.map((_, k) => group.reduce((sum, user) => sum + tasteOf(user)[k], 0) / Math.max(1, group.length));

    const stops: PlanStop[] = [];
    const used = new Set<string>();
    const chosenScores: number[][] = [];
    let from = center;
    for (const [index, def] of PLAN_SLOTS.entries()) {
      const weights = fairWeights(chosenScores);
      const free = options
        .filter((o) => !used.has(o.s.item.id))
        .map((o) => ({ ...o, together: groupScoreV2(o.scores, { votes: votes.get(o.s.item.id), weights })?.score ?? 1 }));
      const fitting = free.filter((o) => def.categories.includes(o.s.item.category));
      const value = (o: (typeof free)[number]) =>
        mapRank(o.together, haversineMeters(from.lat, from.lng, o.s.item.lat, o.s.item.lng), 0)
        - PLAN_VIBE_WEIGHT * Math.abs(o.s.vector[ENERGY] - VIBE_ENERGY[vibe][index]);
      const best = (fitting.length > 0 ? fitting : free).sort((a, b) => value(b) - value(a))[0];
      if (best === undefined) break;
      const { item, vector } = best.s;
      used.add(item.id);
      chosenScores.push(best.scores);
      from = { lat: item.lat, lng: item.lng };
      const score = round1(best.together);
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
        memberScores: group.map((user, i) => ({ ...memberOf(user), score: round1(best.scores[i]) })),
      });
    }
    return { stops, members: group.map(memberOf), vibe, center, algo: ALGO, generatedAt: now };
  },
});

/**
 * Events in the next days within 60 km, best for me first; a performer I like pushes an event up.
 * Only MAX_CANDIDATES events can be scored, so they are chosen to cover the whole window: first the events
 * of performers I follow or rated well, then the soonest events of each of UPCOMING_SLICES equal parts of
 * the window in turn. A busy first weekend cannot push day 9 out.
 */
export const upcoming = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<NearbyItem[]> => {
    const now = Date.now();
    const days = clip(args.days ?? UPCOMING_DEFAULT_DAYS, 1, UPCOMING_MAX_DAYS);
    const limit = clip(Math.round(args.limit ?? UPCOMING_DEFAULT_LIMIT), 1, MAX_LIST_LIMIT);
    const viewer = await loadViewer(ctx, now);
    const from = now - EVENT_DEFAULT_LENGTH_MS, to = now + days * DAY_MS;
    const allowed = (c: Candidate) => !(viewer.under21 && c.doc.category === "nightlife");
    const liked = (await loadLikedPerformerEvents(ctx, viewer, args.lat, args.lng, UPCOMING_RADIUS_METERS, from, to, now))
      .filter(allowed)
      .slice(0, MAX_CANDIDATES);
    const likedIds = new Set<string>(liked.map((c) => c.doc._id));
    const width = (to - from) / UPCOMING_SLICES;
    const slices = await Promise.all(Array.from({ length: UPCOMING_SLICES }, (_, k) => loadEventsBetween(
      ctx, args.lat, args.lng, UPCOMING_RADIUS_METERS,
      Math.floor(from + k * width), k === UPCOMING_SLICES - 1 ? to : Math.floor(from + (k + 1) * width) - 1, now, UPCOMING_SCAN_PER_SLICE,
    )));
    const rest = takeAcross(slices.map((events) => events.filter((c) => allowed(c) && !likedIds.has(c.doc._id))), MAX_CANDIDATES - liked.length);
    const scored = await scoreAll(ctx, [...liked, ...rest], viewer, args.lat, args.lng, now);
    // Ordered by the score itself (plus the friends bump): across a whole metro area distance should not decide.
    const value = (s: Scored) => s.terms.score + s.terms.social;
    return renumber(scored
      .sort((a, b) => value(b) - value(a) || (a.item.startsAt ?? 0) - (b.item.startsAt ?? 0))
      .slice(0, limit)
      .map((s) => ({ ...s.item, rank: 0, tier: "other" as const })));
  },
});

/** "More like this": the nearest in feature space around the item, minus what I already ranked, mixed with my own score. */
export const similar = query({
  args: {
    kind: v.union(v.literal("place"), v.literal("event")),
    id: v.string(),
    lat: v.number(),
    lng: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<NearbyItem[]> => {
    const now = Date.now();
    const limit = clip(Math.round(args.limit ?? SIMILAR_DEFAULT_LIMIT), 1, SIMILAR_POOL_SIZE);
    const target = await getCandidate(ctx, args.kind, args.id);
    if (target === null) return [];
    const viewer = await loadViewer(ctx, now);
    if (viewer.under21 && target.doc.category === "nightlife") return [];
    const targetVector = venueVectorOf(target.doc);
    const rankedByMe = (id: string) => (viewer.knownRankings.get(id) ?? []).some((r) => r.userId === viewer.userId);

    const pool = await loadInRadius(ctx, target.doc.lat, target.doc.lng, SIMILAR_RADIUS_METERS, now);
    const closest = pool
      .filter((c) => c.doc._id !== target.doc._id && !(viewer.under21 && c.doc.category === "nightlife") && !rankedByMe(c.doc._id))
      .map((c) => ({ c, sim: similarity(targetVector, venueVectorOf(c.doc)) }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, SIMILAR_POOL_SIZE);
    const simOf = new Map<string, number>(closest.map((x) => [x.c.doc._id, x.sim]));
    const scored = await scoreAll(ctx, closest.map((x) => x.c), viewer, args.lat, args.lng, now);
    const value = (s: Scored) => similarValue(simOf.get(s.item.id) ?? 0, s.terms.score);
    return renumber(scored
      .sort((a, b) => value(b) - value(a))
      .slice(0, limit)
      .map((s) => ({ ...s.item, rank: 0, tier: "other" as const })));
  },
});
