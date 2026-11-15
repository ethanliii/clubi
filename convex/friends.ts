// Owner: People session. Friend requests, search and suggestions.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type {
  FriendItem,
  FriendRequestItem,
  FriendStatus,
  FriendSuggestion,
  FriendsOverview,
  UserCard,
  UserSearchResult,
} from "./lib/contract";
import { avatarUrlOf, displayNameOf, sameCity, tasteOf } from "./lib/discovery";
import { similarity } from "./lib/recs";
import {
  adamicAdar,
  coRankAgreement,
  friendStatus,
  friendSuggestionScore,
  suggestionReason,
  tasteMatchPct,
} from "./lib/social";
import { notify } from "./notifications";
import { targetIdOfRanking, targetOf } from "./rankings";

const SEARCH_LIMIT = 20;
const MAX_FRIENDS_LISTED = 500;
const MAX_REQUESTS_LISTED = 50;
/** Friends whose ranking count we read for the list, and how far each count goes. */
const RANKED_COUNT_FRIENDS = 50;
const RANKED_COUNT_CAP = 50;
const DEFAULT_SUGGESTIONS = 10;
const MAX_SUGGESTIONS = 30;
/** The two-hop walk: this many of my friends, this many friends of each (ALGORITHM.md §6). */
const WALK_FRIENDS = 50;
const WALK_FRIENDS_OF_FRIEND = 50;
const MAX_TWO_HOP_CANDIDATES = 200;
const CITY_SCAN = 100;
/** Agreement on shared places is only worked out for the best candidates so far: one rankings read each. */
const CO_RANK_CANDIDATES = 20;
const CO_RANK_RANKINGS = 100;
const MY_RANKINGS_FOR_CO_RANK = 300;
const MAX_MY_FRIENDSHIP_ROWS = 600;

export const cardOf = (user: Doc<"users">): UserCard => ({
  userId: user._id,
  username: user.username ?? "",
  displayName: displayNameOf(user),
  avatarUrl: avatarUrlOf(user),
  homeCity: user.homeCity,
});

/** Every "% taste match" between two people. */
export const tasteMatchOf = (a: Doc<"users"> | null, b: Doc<"users"> | null) =>
  tasteMatchPct(similarity(tasteOf(a), tasteOf(b)));

/** The one friendship row of a pair, whichever of them asked first. */
export async function friendshipBetween(
  ctx: QueryCtx,
  a: Id<"users">,
  b: Id<"users">,
): Promise<Doc<"friendships"> | null> {
  return (
    (await ctx.db
      .query("friendships")
      .withIndex("by_pair", (q) => q.eq("userA", a).eq("userB", b))
      .first()) ??
    (await ctx.db
      .query("friendships")
      .withIndex("by_pair", (q) => q.eq("userA", b).eq("userB", a))
      .first())
  );
}

export async function areFriends(ctx: QueryCtx, a: Id<"users">, b: Id<"users">) {
  return (await friendshipBetween(ctx, a, b))?.status === "accepted";
}

/** My status with someone, and the request to answer or cancel when one is pending. */
export async function statusWith(
  ctx: QueryCtx,
  me: Id<"users"> | null,
  other: Id<"users">,
): Promise<{ status: FriendStatus; requestId?: Id<"friendships"> }> {
  if (me === null) {
    return { status: "none" };
  }
  if (me === other) {
    return { status: "self" };
  }
  const row = await friendshipBetween(ctx, me, other);
  const status = friendStatus(row, me);
  return {
    status,
    requestId:
      row !== null && (status === "incoming" || status === "outgoing")
        ? row._id
        : undefined,
  };
}

/** Accepted friends of a user, capped. */
async function friendList(ctx: QueryCtx, userId: Id<"users">, cap: number) {
  const asA = await ctx.db
    .query("friendships")
    .withIndex("by_userA", (q) => q.eq("userA", userId).eq("status", "accepted"))
    .take(cap);
  const asB = await ctx.db
    .query("friendships")
    .withIndex("by_userB", (q) => q.eq("userB", userId).eq("status", "accepted"))
    .take(cap);
  return [
    ...asA.map((row) => ({ userId: row.userB, since: row._creationTime })),
    ...asB.map((row) => ({ userId: row.userA, since: row._creationTime })),
  ].slice(0, cap);
}

export async function friendCountOf(ctx: QueryCtx, userId: Id<"users">) {
  return (await friendList(ctx, userId, MAX_FRIENDS_LISTED)).length;
}

async function mutualCountWith(
  ctx: QueryCtx,
  myFriends: Set<Id<"users">>,
  other: Id<"users">,
) {
  const theirs = await friendList(ctx, other, WALK_FRIENDS_OF_FRIEND);
  return theirs.filter((friend) => myFriends.has(friend.userId)).length;
}

export const list = query({
  args: {},
  handler: async (ctx): Promise<FriendsOverview> => {
    const userId = await getAuthUserId(ctx);
    const me = userId === null ? null : await ctx.db.get("users", userId);
    if (userId === null || me === null) {
      return { friends: [], incoming: [], outgoing: [] };
    }
    const accepted = await friendList(ctx, userId, MAX_FRIENDS_LISTED);
    const myFriends = new Set(accepted.map((friend) => friend.userId));
    const friends: FriendItem[] = [];
    for (const { userId: friendId, since } of accepted) {
      const friend = await ctx.db.get("users", friendId);
      if (friend === null) {
        continue;
      }
      const item: FriendItem = {
        ...cardOf(friend),
        since,
        tasteMatchPct: tasteMatchOf(me, friend),
      };
      if (friends.length < RANKED_COUNT_FRIENDS) {
        const ranked = await ctx.db
          .query("rankings")
          .withIndex("by_user_category", (q) => q.eq("userId", friendId))
          .take(RANKED_COUNT_CAP);
        item.rankedCount = ranked.length;
      }
      friends.push(item);
    }
    friends.sort((a, b) => a.displayName.localeCompare(b.displayName));

    const requestItems = async (rows: Doc<"friendships">[], mine: "userA" | "userB") => {
      const items: FriendRequestItem[] = [];
      for (const row of rows) {
        const otherId = mine === "userA" ? row.userB : row.userA;
        const other = await ctx.db.get("users", otherId);
        if (other === null) {
          continue;
        }
        items.push({
          requestId: row._id,
          user: cardOf(other),
          createdAt: row._creationTime,
          mutualCount: await mutualCountWith(ctx, myFriends, otherId),
        });
      }
      return items.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    };
    const incoming = await ctx.db
      .query("friendships")
      .withIndex("by_userB", (q) => q.eq("userB", userId).eq("status", "pending"))
      .take(MAX_REQUESTS_LISTED);
    const outgoing = await ctx.db
      .query("friendships")
      .withIndex("by_userA", (q) => q.eq("userA", userId).eq("status", "pending"))
      .take(MAX_REQUESTS_LISTED);
    return {
      friends,
      incoming: await requestItems(incoming, "userB"),
      outgoing: await requestItems(outgoing, "userA"),
    };
  },
});

export const search = query({
  args: { text: v.string() },
  handler: async (ctx, args): Promise<UserSearchResult[]> => {
    const userId = await getAuthUserId(ctx);
    const text = args.text.trim().replace(/^@/, "");
    if (userId === null || text === "") {
      return [];
    }
    const found = new Map<Id<"users">, Doc<"users">>();
    // Usernames first (an exact prefix, as typed and lower-cased), then display names.
    for (const prefix of new Set([text, text.toLowerCase()])) {
      const byUsername = await ctx.db
        .query("users")
        .withIndex("by_username", (q) =>
          q.gte("username", prefix).lt("username", prefix + "￿"),
        )
        .take(SEARCH_LIMIT);
      for (const user of byUsername) {
        found.set(user._id, user);
      }
    }
    const byName = await ctx.db
      .query("users")
      .withSearchIndex("search_displayName", (q) => q.search("displayName", text))
      .take(SEARCH_LIMIT);
    for (const user of byName) {
      if (!found.has(user._id)) {
        found.set(user._id, user);
      }
    }
    const myFriends = new Set(
      (await friendList(ctx, userId, MAX_FRIENDS_LISTED)).map((friend) => friend.userId),
    );
    const results: UserSearchResult[] = [];
    for (const user of found.values()) {
      if (results.length >= SEARCH_LIMIT) {
        break;
      }
      if (user._id === userId) {
        continue;
      }
      const { status, requestId } = await statusWith(ctx, userId, user._id);
      if (user.discoverable === false && status !== "friends") {
        continue;
      }
      results.push({
        ...cardOf(user),
        status,
        requestId,
        mutualCount:
          myFriends.size === 0 ? 0 : await mutualCountWith(ctx, myFriends, user._id),
      });
    }
    return results;
  },
});

export const request = mutation({
  args: { username: v.optional(v.string()), userId: v.optional(v.id("users")) },
  handler: async (
    ctx,
    args,
  ): Promise<{ requestId: Id<"friendships">; status: FriendStatus }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const username = args.username?.trim().replace(/^@/, "");
    let other: Doc<"users"> | null = null;
    if (args.userId !== undefined) {
      other = await ctx.db.get("users", args.userId);
    } else if (username) {
      other = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", username))
        .first();
    } else {
      throw new Error("Say who you want to add");
    }
    if (other === null) {
      throw new Error("We couldn't find that person");
    }
    if (other._id === userId) {
      throw new Error("You can't add yourself");
    }
    const me = await ctx.db.get("users", userId);
    const myName = me === null ? "Someone" : displayNameOf(me);
    const row = await friendshipBetween(ctx, userId, other._id);

    if (row !== null && row.status === "accepted") {
      return { requestId: row._id, status: "friends" };
    }
    if (row !== null && row.status === "pending" && row.userA === userId) {
      return { requestId: row._id, status: "outgoing" };
    }
    if (row !== null && row.status === "pending") {
      // They already asked me: asking back is a yes.
      await ctx.db.patch("friendships", row._id, { status: "accepted" });
      await notify(ctx, {
        userId: other._id,
        type: "friend_accepted",
        title: `${myName} accepted your friend request`,
        body: "You can now see each other's rankings",
        link: `/user/${userId}`,
        actorId: userId,
      });
      return { requestId: row._id, status: "friends" };
    }
    let requestId: Id<"friendships">;
    if (row !== null) {
      // A declined pair may ask again. The row is reused, so there is still one per pair.
      requestId = row._id;
      await ctx.db.patch("friendships", row._id, {
        userA: userId,
        userB: other._id,
        status: "pending",
      });
    } else {
      requestId = await ctx.db.insert("friendships", {
        userA: userId,
        userB: other._id,
        status: "pending",
      });
    }
    await notify(ctx, {
      userId: other._id,
      type: "friend_request",
      title: `${myName} wants to be friends`,
      body: "Accept to see each other's rankings",
      link: "/friends",
      actorId: userId,
    });
    return { requestId, status: "outgoing" };
  },
});

export const respond = mutation({
  args: { requestId: v.id("friendships"), accept: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { requestId, accept }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const row = await ctx.db.get("friendships", requestId);
    if (row === null || row.userB !== userId || row.status !== "pending") {
      throw new Error("That friend request is no longer open");
    }
    await ctx.db.patch("friendships", requestId, {
      status: accept ? "accepted" : "declined",
    });
    if (accept) {
      const me = await ctx.db.get("users", userId);
      await notify(ctx, {
        userId: row.userA,
        type: "friend_accepted",
        title: `${me === null ? "Someone" : displayNameOf(me)} accepted your friend request`,
        body: "You can now see each other's rankings",
        link: `/user/${userId}`,
        actorId: userId,
      });
    }
    return null;
  },
});

export const cancel = mutation({
  args: { requestId: v.id("friendships") },
  returns: v.null(),
  handler: async (ctx, { requestId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const row = await ctx.db.get("friendships", requestId);
    if (row === null) {
      return null;
    }
    if (row.userA !== userId || row.status !== "pending") {
      throw new Error("You can only take back a request you sent that is still waiting");
    }
    await ctx.db.delete("friendships", requestId);
    return null;
  },
});

export const remove = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const row = await friendshipBetween(ctx, userId, args.userId);
    if (row !== null && row.status === "accepted") {
      await ctx.db.delete("friendships", row._id);
    }
    return null;
  },
});

export const suggestions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<FriendSuggestion[]> => {
    const userId = await getAuthUserId(ctx);
    const me = userId === null ? null : await ctx.db.get("users", userId);
    if (userId === null || me === null) {
      return [];
    }
    const limit = Math.min(
      MAX_SUGGESTIONS,
      Math.max(1, Math.round(args.limit ?? DEFAULT_SUGGESTIONS)),
    );

    // Never suggested: me, and anyone I already have a row with (friends, a pending request either
    // way, or a declined one either way).
    const rows = [
      ...(await ctx.db
        .query("friendships")
        .withIndex("by_userA", (q) => q.eq("userA", userId))
        .take(MAX_MY_FRIENDSHIP_ROWS)),
      ...(await ctx.db
        .query("friendships")
        .withIndex("by_userB", (q) => q.eq("userB", userId))
        .take(MAX_MY_FRIENDSHIP_ROWS)),
    ];
    const excluded = new Set<Id<"users">>([userId]);
    const myFriends: Id<"users">[] = [];
    for (const row of rows) {
      const other = row.userA === userId ? row.userB : row.userA;
      excluded.add(other);
      if (row.status === "accepted") {
        myFriends.push(other);
      }
    }

    // Two hops: friends of my friends. For each candidate, remember which of my friends know them and
    // how many friends each of those has (Adamic–Adar needs that).
    const mutuals = new Map<Id<"users">, { via: Id<"users">; degree: number }[]>();
    for (const friendId of myFriends.slice(0, WALK_FRIENDS)) {
      const theirs = await friendList(ctx, friendId, WALK_FRIENDS_OF_FRIEND);
      for (const { userId: candidate } of theirs) {
        if (excluded.has(candidate)) {
          continue;
        }
        if (!mutuals.has(candidate) && mutuals.size >= MAX_TWO_HOP_CANDIDATES) {
          continue;
        }
        mutuals.set(candidate, [
          ...(mutuals.get(candidate) ?? []),
          { via: friendId, degree: theirs.length },
        ]);
      }
    }
    const candidates = new Map<Id<"users">, Doc<"users">>();
    for (const candidateId of mutuals.keys()) {
      const user = await ctx.db.get("users", candidateId);
      if (user !== null && user.discoverable !== false) {
        candidates.set(candidateId, user);
      }
    }
    // Not enough people two hops away: add people from my home city (a bounded read of one index).
    if (candidates.size < limit && me.homeCity !== undefined && me.homeCity.trim() !== "") {
      const locals = await ctx.db
        .query("users")
        .withIndex("by_homeCity", (q) => q.eq("homeCity", me.homeCity))
        .take(CITY_SCAN);
      for (const user of locals) {
        if (!excluded.has(user._id) && user.discoverable !== false && user.username !== undefined) {
          candidates.set(user._id, user);
        }
      }
    }

    const myTaste = tasteOf(me);
    const partial = [...candidates.values()].map((user) => {
      const via = mutuals.get(user._id) ?? [];
      const sim = similarity(myTaste, tasteOf(user));
      const inMyCity = sameCity(me.homeCity, user.homeCity);
      return {
        user,
        via,
        sim,
        inMyCity,
        aa: adamicAdar(via.map((mutual) => mutual.degree)),
        firstPass: 0,
      };
    });
    for (const row of partial) {
      row.firstPass = friendSuggestionScore({ aa: row.aa, taste: row.sim, coRank: 0, sameCity: row.inMyCity });
    }
    partial.sort((a, b) => b.firstPass - a.firstPass);

    // Agreement on places we both ranked, for the best candidates only.
    const myRankings = await ctx.db
      .query("rankings")
      .withIndex("by_user_category", (q) => q.eq("userId", userId))
      .take(MY_RANKINGS_FOR_CO_RANK);
    const myScores = new Map(
      myRankings.flatMap((ranking) => {
        const id = targetIdOfRanking(ranking);
        return id === undefined ? [] : [[id as string, ranking] as const];
      }),
    );
    const suggestions: FriendSuggestion[] = [];
    for (const [index, row] of partial.entries()) {
      const shared: { mine: Doc<"rankings">; theirs: Doc<"rankings"> }[] = [];
      if (index < CO_RANK_CANDIDATES && myScores.size > 0) {
        const theirs = await ctx.db
          .query("rankings")
          .withIndex("by_user_category", (q) => q.eq("userId", row.user._id))
          .take(CO_RANK_RANKINGS);
        for (const ranking of theirs) {
          const mine = myScores.get(targetIdOfRanking(ranking) ?? "");
          if (mine !== undefined) {
            shared.push({ mine, theirs: ranking });
          }
        }
      }
      shared.sort((a, b) => b.mine.score - a.mine.score);
      const score = friendSuggestionScore({
        aa: row.aa,
        taste: row.sim,
        coRank: coRankAgreement(
          shared.map((pair) => ({ mine: pair.mine.score, theirs: pair.theirs.score })),
        ),
        sameCity: row.inMyCity,
      });
      suggestions.push({
        ...cardOf(row.user),
        reason: "",
        mutualCount: row.via.length,
        tasteMatchPct: tasteMatchPct(row.sim),
        sharedPlaces: shared.length,
        score,
      });
    }
    suggestions.sort((a, b) => b.score - a.score || b.mutualCount - a.mutualCount);
    const top = suggestions.slice(0, limit);

    // Reasons need two names (the one mutual friend, the place we both ranked): only read them for
    // the rows that are returned.
    const byId = new Map(partial.map((row) => [row.user._id, row]));
    for (const suggestion of top) {
      const row = byId.get(suggestion.userId);
      let mutualName: string | undefined;
      if (row !== undefined && row.via.length === 1) {
        const mutual = await ctx.db.get("users", row.via[0].via);
        mutualName = mutual === null ? undefined : displayNameOf(mutual);
      }
      let sharedPlaceName: string | undefined;
      if (suggestion.mutualCount === 0 && suggestion.sharedPlaces >= 2) {
        const theirs = await ctx.db
          .query("rankings")
          .withIndex("by_user_category", (q) => q.eq("userId", suggestion.userId))
          .take(CO_RANK_RANKINGS);
        const best = theirs
          .flatMap((ranking) => {
            const mine = myScores.get(targetIdOfRanking(ranking) ?? "");
            return mine === undefined ? [] : [mine];
          })
          .sort((a, b) => b.score - a.score)[0];
        const id = best === undefined ? undefined : targetIdOfRanking(best);
        if (best !== undefined && id !== undefined) {
          sharedPlaceName = (
            await targetOf(ctx, best.placeId !== undefined ? "place" : "event", id)
          )?.name;
        }
      }
      suggestion.reason = suggestionReason({
        mutualCount: suggestion.mutualCount,
        mutualName,
        sharedPlaces: suggestion.sharedPlaces,
        sharedPlaceName,
        sameCity: row?.inMyCity ?? false,
        city: suggestion.homeCity,
        tasteMatchPct: suggestion.tasteMatchPct,
      });
    }
    return top;
  },
});
