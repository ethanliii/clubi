// Owner: People session. Trips and groups: any named group ("Friday night", "NYC in March"), its
// members and its shortlist. What the group should do is Brain's (discover.forGroup / plan read these tables).
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type {
  TripDetail,
  TripMemberStatus,
  TripMemberSuggestion,
  TripShortlistItem,
  TripSummary,
} from "./lib/contract";
import { displayNameOf, isUnder21, sameCity, tasteOf, userLoader, type UserLoader } from "./lib/discovery";
import { similarity } from "./lib/recs";
import {
  TRIP_UPDATE_COOLDOWN_MS,
  centroid,
  shortlistOrder,
  tallyVotes,
  tripFit,
  type ShortlistTally,
} from "./lib/social";
import { areFriends, cardOf } from "./friends";
import { notify } from "./notifications";
import { targetIdOfRanking, targetOf, type TargetId } from "./rankings";

const NAME_MAX = 60;
const CITY_MAX = 60;
const MAX_MEMBERS = 30;
const MAX_INVITES_PER_CALL = 20;
const MAX_TRIPS_LISTED = 100;
const MAX_VOTES_READ = 1000;
const VIBES = ["chill", "balanced", "wild"];
/** suggestMembers: how many friends are considered, and the reads behind "ranked the same places". */
const SUGGEST_FRIENDS = 50;
const SUGGEST_GROUP = 8;
const SUGGEST_GROUP_RANKINGS = 100;
const SUGGEST_SHARED_CANDIDATES = 15;
const SUGGEST_CANDIDATE_RANKINGS = 50;
const SUGGEST_LIMIT = 20;
const COOLDOWN_SCAN = 50;

const vKind = v.union(v.literal("place"), v.literal("event"));
const vTargetId = v.union(v.id("places"), v.id("events"));
const tripFields = {
  name: v.optional(v.string()),
  city: v.optional(v.string()),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  startDate: v.optional(v.number()),
  endDate: v.optional(v.number()),
  vibe: v.optional(v.string()),
};
type TripFields = {
  name?: string; city?: string; lat?: number; lng?: number; startDate?: number; endDate?: number; vibe?: string;
};
type Role = "owner" | TripMemberStatus;

/** Checks and tidies the fields of a trip. `current` is the saved trip when this is an update. */
function cleanTripFields(args: TripFields, current?: Doc<"trips">) {
  const patch: TripFields = {};
  if (args.name !== undefined) {
    const name = args.name.trim().replace(/\s+/g, " ");
    if (name.length < 1 || name.length > NAME_MAX) {
      throw new Error(`Give it a name of 1 to ${NAME_MAX} characters`);
    }
    patch.name = name;
  }
  if (args.city !== undefined) {
    const city = args.city.trim();
    if (city.length > CITY_MAX) {
      throw new Error(`A city name can be at most ${CITY_MAX} characters`);
    }
    patch.city = city || undefined;
  }
  if ((args.lat === undefined) !== (args.lng === undefined)) {
    throw new Error("A location needs both a latitude and a longitude");
  }
  if (args.lat !== undefined && args.lng !== undefined) {
    if (!(Math.abs(args.lat) <= 90) || !(Math.abs(args.lng) <= 180)) {
      throw new Error("That location isn't on the map");
    }
    patch.lat = args.lat;
    patch.lng = args.lng;
  }
  for (const key of ["startDate", "endDate"] as const) {
    const value = args[key];
    if (value !== undefined) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("That date isn't valid");
      }
      patch[key] = value;
    }
  }
  const start = patch.startDate ?? current?.startDate;
  const end = patch.endDate ?? current?.endDate;
  if (start !== undefined && end !== undefined && end < start) {
    throw new Error("The end date can't be before the start date");
  }
  if (args.vibe !== undefined) {
    if (!VIBES.includes(args.vibe)) {
      throw new Error(`Vibe must be one of: ${VIBES.join(", ")}`);
    }
    patch.vibe = args.vibe;
  }
  return patch;
}

const memberRows = (ctx: QueryCtx, tripId: Id<"trips">) =>
  ctx.db
    .query("tripMembers")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .take(MAX_MEMBERS * 2);

/** The trip, everyone's membership rows, and what the caller is to it (null = nothing). */
async function tripFor(ctx: QueryCtx, tripId: Id<"trips">, userId: Id<"users"> | null) {
  const trip = await ctx.db.get("trips", tripId);
  if (trip === null || userId === null) {
    return null;
  }
  const rows = await memberRows(ctx, tripId);
  const mine = rows.find((row) => row.userId === userId);
  const role: Role | null = trip.ownerId === userId ? "owner" : (mine?.status ?? null);
  return { trip, rows, mine, role };
}

/** Owner and joined members: the people who plan, vote and invite. */
const isIn = (role: Role | null) => role === "owner" || role === "joined";

async function requireTrip(ctx: QueryCtx, tripId: Id<"trips">) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Not signed in");
  }
  const found = await tripFor(ctx, tripId, userId);
  if (found === null || found.role === null || found.role === "declined") {
    throw new Error("That trip isn't available");
  }
  return { ...found, userId, role: found.role };
}

const groupIdsOf = (trip: Doc<"trips">, rows: Doc<"tripMembers">[]) => [
  trip.ownerId,
  ...rows.filter((row) => row.status === "joined").map((row) => row.userId),
];

/**
 * Tells the rest of the group something changed. At most one `trip_update` per trip per receiver per
 * hour, so a burst of votes or joins is one notification, not ten.
 */
async function notifyTripUpdate(
  ctx: MutationCtx,
  trip: Doc<"trips">,
  rows: Doc<"tripMembers">[],
  actorId: Id<"users">,
  title: string,
  body: string,
) {
  const now = Date.now();
  const link = `/trip/${trip._id}`;
  for (const receiver of new Set(groupIdsOf(trip, rows))) {
    if (receiver === actorId) {
      continue;
    }
    const recent = await ctx.db
      .query("notifications")
      .withIndex("by_user_createdAt", (q) =>
        q.eq("userId", receiver).gt("createdAt", now - TRIP_UPDATE_COOLDOWN_MS),
      )
      .order("desc")
      .take(COOLDOWN_SCAN);
    if (recent.some((row) => row.type === "trip_update" && row.link === link)) {
      continue;
    }
    await notify(ctx, { userId: receiver, type: "trip_update", title, body, link, actorId });
  }
}

/** Invites friends of `inviter`. Returns how many new invites went out. */
async function inviteAll(
  ctx: MutationCtx,
  trip: Doc<"trips">,
  inviter: Doc<"users">,
  userIds: Id<"users">[],
) {
  const rows = await memberRows(ctx, trip._id);
  const byUser = new Map(rows.map((row) => [row.userId, row]));
  let size = 1 + rows.filter((row) => row.status !== "declined").length;
  let invited = 0;
  for (const userId of new Set(userIds)) {
    const row = byUser.get(userId);
    if (userId === trip.ownerId || userId === inviter._id || (row !== undefined && row.status !== "declined")) {
      continue;
    }
    if (!(await areFriends(ctx, inviter._id, userId))) {
      throw new Error("You can only invite your friends");
    }
    if (size >= MAX_MEMBERS) {
      throw new Error(`A trip can have at most ${MAX_MEMBERS} people`);
    }
    if (row !== undefined) {
      await ctx.db.patch("tripMembers", row._id, { status: "invited", invitedBy: inviter._id });
    } else {
      await ctx.db.insert("tripMembers", {
        tripId: trip._id,
        userId,
        status: "invited",
        createdAt: Date.now(),
        invitedBy: inviter._id,
      });
    }
    size += 1;
    invited += 1;
    await notify(ctx, {
      userId,
      type: "trip_invite",
      title: `${displayNameOf(inviter)} invited you to ${trip.name}`,
      body: trip.city ? `A trip in ${trip.city}` : "Tap to join and vote on where to go",
      link: `/trip/${trip._id}`,
      actorId: inviter._id,
    });
  }
  return invited;
}

async function summaryOf(
  ctx: QueryCtx,
  trip: Doc<"trips">,
  rows: Doc<"tripMembers">[],
  role: Role,
  getUser: UserLoader,
): Promise<TripSummary> {
  const owner = await getUser(trip.ownerId);
  return {
    tripId: trip._id,
    name: trip.name,
    city: trip.city,
    startDate: trip.startDate,
    endDate: trip.endDate,
    memberCount: 1 + rows.filter((row) => row.status === "joined").length,
    myStatus: role,
    ownerName: owner === null ? "Someone" : displayNameOf(owner),
  };
}

async function shortlistItemOf(
  ctx: QueryCtx,
  tally: ShortlistTally,
  getUser: UserLoader,
): Promise<TripShortlistItem | null> {
  const target = await targetOf(ctx, tally.kind, tally.targetId as TargetId);
  if (target === null) {
    return null;
  }
  const addedBy = tally.addedBy === undefined ? null : await getUser(tally.addedBy as Id<"users">);
  return {
    kind: tally.kind,
    id: tally.targetId as TargetId,
    name: target.name,
    category: target.category,
    votesUp: tally.votesUp,
    votesDown: tally.votesDown,
    myVote: tally.myVote,
    addedBy: addedBy === null ? undefined : cardOf(addedBy),
    imageUrl: target.imageUrl,
  };
}

export const create = mutation({
  args: {
    ...tripFields,
    name: v.string(),
    memberIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, { memberIds, ...fields }): Promise<{ tripId: Id<"trips"> }> => {
    const userId = await getAuthUserId(ctx);
    const me = userId === null ? null : await ctx.db.get("users", userId);
    if (userId === null || me === null) {
      throw new Error("Not signed in");
    }
    if ((memberIds?.length ?? 0) > MAX_INVITES_PER_CALL) {
      throw new Error(`Invite at most ${MAX_INVITES_PER_CALL} people at a time`);
    }
    const clean = cleanTripFields(fields);
    const tripId = await ctx.db.insert("trips", {
      ...clean,
      name: clean.name ?? fields.name,
      ownerId: userId,
      createdAt: Date.now(),
    });
    const trip = await ctx.db.get("trips", tripId);
    if (trip !== null && memberIds !== undefined) {
      await inviteAll(ctx, trip, me, memberIds);
    }
    return { tripId };
  },
});

export const list = query({
  args: {},
  handler: async (ctx): Promise<TripSummary[]> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const getUser = userLoader(ctx);
    const found: { trip: Doc<"trips">; role: Role }[] = [];
    const owned = await ctx.db
      .query("trips")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .take(MAX_TRIPS_LISTED);
    for (const trip of owned) {
      found.push({ trip, role: "owner" });
    }
    for (const status of ["joined", "invited"] as const) {
      const memberships: Doc<"tripMembers">[] = await ctx.db
        .query("tripMembers")
        .withIndex("by_user", (q) => q.eq("userId", userId).eq("status", status))
        .take(MAX_TRIPS_LISTED);
      for (const membership of memberships) {
        const trip: Doc<"trips"> | null = await ctx.db.get("trips", membership.tripId);
        if (trip !== null && trip.ownerId !== userId) {
          found.push({ trip, role: status });
        }
      }
    }
    // Soonest dated trips first, then the newest undated ones.
    found.sort(
      (a, b) =>
        (a.trip.startDate ?? Infinity) - (b.trip.startDate ?? Infinity) ||
        b.trip.createdAt - a.trip.createdAt,
    );
    const summaries: TripSummary[] = [];
    for (const { trip, role } of found.slice(0, MAX_TRIPS_LISTED)) {
      summaries.push(await summaryOf(ctx, trip, await memberRows(ctx, trip._id), role, getUser));
    }
    return summaries;
  },
});

export const get = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }): Promise<TripDetail | null> => {
    const userId = await getAuthUserId(ctx);
    const found = await tripFor(ctx, tripId, userId);
    if (userId === null || found === null || found.role === null || found.role === "declined") {
      return null;
    }
    const { trip, rows, role } = found;
    const getUser = userLoader(ctx);
    const me = await getUser(userId);
    const members: TripDetail["members"] = [];
    const owner = await getUser(trip.ownerId);
    if (owner !== null) {
      members.push({
        ...cardOf(owner),
        status: "joined",
        isOwner: true,
        isLocal: sameCity(owner.homeCity, trip.city),
      });
    }
    const statusOrder: TripMemberStatus[] = ["joined", "invited", "declined"];
    const sorted = [...rows].sort(
      (a, b) =>
        statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status) || a.createdAt - b.createdAt,
    );
    for (const row of sorted) {
      const user = row.userId === trip.ownerId ? null : await getUser(row.userId);
      if (user !== null) {
        members.push({
          ...cardOf(user),
          status: row.status,
          isOwner: false,
          isLocal: sameCity(user.homeCity, trip.city),
        });
      }
    }
    const votes = await ctx.db
      .query("tripVotes")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId))
      .take(MAX_VOTES_READ);
    const under21 = isUnder21(me?.birthday, Date.now());
    const shortlist: TripShortlistItem[] = [];
    for (const tally of shortlistOrder(tallyVotes(votes, userId))) {
      const item = await shortlistItemOf(ctx, tally, getUser);
      // Privacy: someone under 21 never gets nightlife, even when the group shortlisted it.
      if (item !== null && !(under21 && item.category === "nightlife")) {
        shortlist.push(item);
      }
    }
    return {
      ...(await summaryOf(ctx, trip, rows, role, getUser)),
      lat: trip.lat,
      lng: trip.lng,
      vibe: trip.vibe,
      members,
      shortlist,
    };
  },
});

export const update = mutation({
  args: { tripId: v.id("trips"), ...tripFields },
  returns: v.null(),
  handler: async (ctx, { tripId, ...fields }) => {
    const { trip, role } = await requireTrip(ctx, tripId);
    if (role !== "owner") {
      throw new Error("Only the person who made the trip can change it");
    }
    await ctx.db.patch("trips", tripId, cleanTripFields(fields, trip));
    return null;
  },
});

export const invite = mutation({
  args: { tripId: v.id("trips"), userIds: v.array(v.id("users")) },
  handler: async (ctx, { tripId, userIds }): Promise<{ invited: number }> => {
    const { trip, role, userId } = await requireTrip(ctx, tripId);
    if (!isIn(role)) {
      throw new Error("Join the trip before inviting people");
    }
    if (userIds.length > MAX_INVITES_PER_CALL) {
      throw new Error(`Invite at most ${MAX_INVITES_PER_CALL} people at a time`);
    }
    const me = await ctx.db.get("users", userId);
    if (me === null) {
      throw new Error("Not signed in");
    }
    return { invited: await inviteAll(ctx, trip, me, userIds) };
  },
});

export const respond = mutation({
  args: { tripId: v.id("trips"), accept: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { tripId, accept }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const found = await tripFor(ctx, tripId, userId);
    if (found === null || found.mine === undefined || found.mine.status !== "invited") {
      throw new Error("You don't have an open invite to that trip");
    }
    await ctx.db.patch("tripMembers", found.mine._id, { status: accept ? "joined" : "declined" });
    if (accept) {
      const me = await ctx.db.get("users", userId);
      await notifyTripUpdate(
        ctx,
        found.trip,
        found.rows,
        userId,
        `${me === null ? "Someone" : displayNameOf(me)} joined ${found.trip.name}`,
        "See who's in and what's on the shortlist",
      );
    }
    return null;
  },
});

async function deleteVotesOf(ctx: MutationCtx, tripId: Id<"trips">, userId: Id<"users">) {
  const votes = await ctx.db
    .query("tripVotes")
    .withIndex("by_trip_user", (q) => q.eq("tripId", tripId).eq("userId", userId))
    .take(MAX_VOTES_READ);
  for (const vote of votes) {
    await ctx.db.delete("tripVotes", vote._id);
  }
}

export const leave = mutation({
  args: { tripId: v.id("trips") },
  returns: v.null(),
  handler: async (ctx, { tripId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const found = await tripFor(ctx, tripId, userId);
    if (found === null) {
      return null;
    }
    if (found.role === "owner") {
      throw new Error("You made this trip. Delete it instead of leaving");
    }
    if (found.mine !== undefined) {
      await ctx.db.delete("tripMembers", found.mine._id);
      await deleteVotesOf(ctx, tripId, userId);
    }
    return null;
  },
});

export const remove = mutation({
  args: { tripId: v.id("trips") },
  returns: v.null(),
  handler: async (ctx, { tripId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const trip = await ctx.db.get("trips", tripId);
    if (trip === null) {
      return null;
    }
    if (trip.ownerId !== userId) {
      throw new Error("Only the person who made the trip can delete it");
    }
    for (const row of await memberRows(ctx, tripId)) {
      await ctx.db.delete("tripMembers", row._id);
    }
    const votes = await ctx.db
      .query("tripVotes")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId))
      .take(MAX_VOTES_READ);
    for (const vote of votes) {
      await ctx.db.delete("tripVotes", vote._id);
    }
    await ctx.db.delete("trips", tripId);
    return null;
  },
});

export const vote = mutation({
  args: { tripId: v.id("trips"), kind: vKind, id: vTargetId, vote: v.number() },
  handler: async (ctx, args): Promise<TripShortlistItem> => {
    const { trip, rows, role, userId } = await requireTrip(ctx, args.tripId);
    if (!isIn(role)) {
      throw new Error("Join the trip to vote");
    }
    if (args.vote !== 1 && args.vote !== -1 && args.vote !== 0) {
      throw new Error("A vote is 1, -1, or 0 to clear it");
    }
    const target = await targetOf(ctx, args.kind, args.id);
    const me = await ctx.db.get("users", userId);
    if (
      target === null ||
      (target.category === "nightlife" && isUnder21(me?.birthday, Date.now()))
    ) {
      throw new Error("That place or event isn't available");
    }
    const before = await ctx.db
      .query("tripVotes")
      .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
      .take(MAX_VOTES_READ);
    const onItem = before.filter((row) => row.targetId === args.id);
    const mine = onItem.find((row) => row.userId === userId);
    const wasShortlisted = onItem.some((row) => row.vote === 1);
    const now = Date.now();
    let after = onItem.filter((row) => row !== mine);
    if (args.vote === 0) {
      if (mine !== undefined) {
        await ctx.db.delete("tripVotes", mine._id);
      }
    } else if (mine !== undefined) {
      // Changing a vote keeps its time, so "added by" stays with whoever was first.
      await ctx.db.patch("tripVotes", mine._id, { vote: args.vote });
      after = [...after, { ...mine, vote: args.vote }];
    } else {
      const row = {
        tripId: trip._id,
        userId,
        targetKind: args.kind,
        targetId: args.id,
        vote: args.vote,
        createdAt: now,
      };
      await ctx.db.insert("tripVotes", row);
      after = [...after, row as Doc<"tripVotes">];
    }
    if (!wasShortlisted && args.vote === 1) {
      await notifyTripUpdate(
        ctx,
        trip,
        rows,
        userId,
        `${me === null ? "Someone" : displayNameOf(me)} added ${target.name} to ${trip.name}`,
        "Vote it up or down",
      );
    }
    const tally: ShortlistTally = tallyVotes(after, userId)[0] ?? {
      kind: args.kind,
      targetId: args.id,
      votesUp: 0,
      votesDown: 0,
      firstAt: now,
    };
    const item = await shortlistItemOf(ctx, tally, userLoader(ctx));
    if (item === null) {
      throw new Error("That place or event isn't available");
    }
    return item;
  },
});

export const suggestMembers = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }): Promise<TripMemberSuggestion[]> => {
    const userId = await getAuthUserId(ctx);
    const found = await tripFor(ctx, tripId, userId);
    if (userId === null || found === null || !isIn(found.role)) {
      return [];
    }
    const { trip, rows } = found;
    const getUser = userLoader(ctx);
    const friendsOf = async (id: Id<"users">) => {
      const asA = await ctx.db
        .query("friendships")
        .withIndex("by_userA", (q) => q.eq("userA", id).eq("status", "accepted"))
        .take(SUGGEST_FRIENDS);
      const asB = await ctx.db
        .query("friendships")
        .withIndex("by_userB", (q) => q.eq("userB", id).eq("status", "accepted"))
        .take(SUGGEST_FRIENDS);
      return new Set([...asA.map((row) => row.userB), ...asB.map((row) => row.userA)]);
    };

    // The group: the owner and everyone who joined. Their mean taste is what a newcomer should fit.
    const groupIds = groupIdsOf(trip, rows).slice(0, SUGGEST_GROUP);
    const group: { user: Doc<"users">; friends: Set<Id<"users">>; ranked: Set<string> }[] = [];
    for (const id of groupIds) {
      const user = await getUser(id);
      if (user === null) {
        continue;
      }
      const rankings = await ctx.db
        .query("rankings")
        .withIndex("by_user_category", (q) => q.eq("userId", id))
        .take(SUGGEST_GROUP_RANKINGS);
      group.push({
        user,
        friends: await friendsOf(id),
        ranked: new Set(rankings.flatMap((ranking) => targetIdOfRanking(ranking) ?? [])),
      });
    }
    const groupTaste = centroid(group.map((member) => tasteOf(member.user)));

    // Candidates: my friends who aren't on the trip in any way (a declined invite stays declined).
    const onTrip = new Set<Id<"users">>([trip.ownerId, ...rows.map((row) => row.userId)]);
    const mine = group.find((member) => member.user._id === userId)?.friends ?? (await friendsOf(userId));
    const candidates: {
      user: Doc<"users">; tasteSim: number; isLocal: boolean; friendsOnTrip: number;
      sharedPlaces: number; sharedWithName?: string; firstPass: number;
    }[] = [];
    for (const friendId of mine) {
      const user = onTrip.has(friendId) ? null : await getUser(friendId);
      if (user === null) {
        continue;
      }
      const tasteSim = group.length === 0 ? 0 : similarity(tasteOf(user), groupTaste);
      const isLocal = sameCity(user.homeCity, trip.city);
      const friendsOnTrip = group.filter((member) => member.friends.has(friendId)).length;
      candidates.push({
        user,
        tasteSim,
        isLocal,
        friendsOnTrip,
        sharedPlaces: 0,
        firstPass: tripFit({
          tasteSim,
          isLocal,
          sharedPlaces: 0,
          friendShare: group.length === 0 ? 0 : friendsOnTrip / group.length,
        }).fitPct,
      });
    }
    // "Ranked the same places" costs a read per candidate, so only the best so far get it.
    candidates.sort((a, b) => b.firstPass - a.firstPass);
    for (const candidate of candidates.slice(0, SUGGEST_SHARED_CANDIDATES)) {
      const rankings = await ctx.db
        .query("rankings")
        .withIndex("by_user_category", (q) => q.eq("userId", candidate.user._id))
        .take(SUGGEST_CANDIDATE_RANKINGS);
      const theirs = rankings.flatMap((ranking) => targetIdOfRanking(ranking) ?? []);
      candidate.sharedPlaces = theirs.filter((id) => group.some((member) => member.ranked.has(id))).length;
      let most = 0;
      for (const member of group) {
        const overlap = theirs.filter((id) => member.ranked.has(id)).length;
        if (overlap > most) {
          most = overlap;
          candidate.sharedWithName = member.user._id === userId ? "you" : displayNameOf(member.user);
        }
      }
    }
    return candidates
      .map((candidate) => {
        const fit = tripFit({
          tasteSim: candidate.tasteSim,
          isLocal: candidate.isLocal,
          sharedPlaces: candidate.sharedPlaces,
          friendShare: group.length === 0 ? 0 : candidate.friendsOnTrip / group.length,
          city: trip.city,
          sharedWithName: candidate.sharedWithName,
          friendsOnTrip: candidate.friendsOnTrip,
        });
        return { ...cardOf(candidate.user), reason: fit.reason, fitPct: fit.fitPct, isLocal: candidate.isLocal };
      })
      .sort((a, b) => b.fitPct - a.fitPct || a.displayName.localeCompare(b.displayName))
      .slice(0, SUGGEST_LIMIT);
  },
});
