// Owner: Bryan (UI merge, decision Q20). Public accounts and followers.
// Private accounts (the default) keep the friend-request flow in friends.ts; this file only adds
// one-way follows for accounts that opted into public. Tables: convex/tables/ui.ts.
//
// INTEGRATION (People): profile.get should treat a public account as `canSee: true` for everyone,
// and users.deleteUserRows should drop this user's rows from follows, accountPrivacy, quizExtras
// and profilePins. Neither file is edited here.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { FollowStatus, UserCard } from "./lib/contract";
import { avatarUrlOf, displayNameOf } from "./lib/discovery";

const COUNT_LIMIT = 5000;
const LIST_LIMIT = 200;
const MAX_FOLLOWING = 2000;

export async function isPublicAccount(ctx: QueryCtx, userId: Id<"users">): Promise<boolean> {
  const row = await ctx.db
    .query("accountPrivacy")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return row?.isPublic ?? false;
}

async function followRow(ctx: QueryCtx, followerId: Id<"users">, followeeId: Id<"users">) {
  return ctx.db
    .query("follows")
    .withIndex("by_pair", (q) => q.eq("followerId", followerId).eq("followeeId", followeeId))
    .first();
}

/** Turn my account public (followable) or back to private. */
export const setPublic = mutation({
  args: { isPublic: v.boolean() },
  handler: async (ctx, { isPublic }): Promise<{ isPublic: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const row = await ctx.db
      .query("accountPrivacy")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (row === null) {
      await ctx.db.insert("accountPrivacy", { userId, isPublic });
    } else {
      await ctx.db.patch("accountPrivacy", row._id, { isPublic });
    }
    return { isPublic };
  },
});

export const follow = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{ following: boolean }> => {
    const me = await getAuthUserId(ctx);
    if (me === null) {
      throw new Error("Not signed in");
    }
    if (me === args.userId) {
      throw new Error("You can't follow yourself");
    }
    const target = await ctx.db.get("users", args.userId);
    if (target === null) {
      throw new Error("This person isn't on Vioma anymore");
    }
    if (!(await isPublicAccount(ctx, args.userId))) {
      throw new Error("This account is private. Send a friend request instead");
    }
    if ((await followRow(ctx, me, args.userId)) === null) {
      const mine = await ctx.db
        .query("follows")
        .withIndex("by_follower", (q) => q.eq("followerId", me))
        .take(MAX_FOLLOWING);
      if (mine.length >= MAX_FOLLOWING) {
        throw new Error("You're following too many accounts. Unfollow someone first");
      }
      await ctx.db.insert("follows", { followerId: me, followeeId: args.userId, createdAt: Date.now() });
    }
    return { following: true };
  },
});

export const unfollow = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{ following: boolean }> => {
    const me = await getAuthUserId(ctx);
    if (me === null) {
      throw new Error("Not signed in");
    }
    const row = await followRow(ctx, me, args.userId);
    if (row !== null) {
      await ctx.db.delete("follows", row._id);
    }
    return { following: false };
  },
});

/** Public or private, follower counts, and whether I follow them. Leave `userId` out for me. */
export const status = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args): Promise<FollowStatus | null> => {
    const me = await getAuthUserId(ctx);
    const userId = args.userId ?? me;
    if (userId === null || (await ctx.db.get("users", userId)) === null) {
      return null;
    }
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_followee", (q) => q.eq("followeeId", userId))
      .take(COUNT_LIMIT);
    const following = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", userId))
      .take(COUNT_LIMIT);
    return {
      isPublic: await isPublicAccount(ctx, userId),
      followers: followers.length,
      following: following.length,
      iFollow: me !== null && me !== userId && followers.some((row) => row.followerId === me),
      isMe: me === userId,
    };
  },
});

/** Who follows a user, newest first. Visible for public accounts and for my own list. */
export const followers = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<UserCard[]> => {
    const me = await getAuthUserId(ctx);
    if (me === null || (me !== userId && !(await isPublicAccount(ctx, userId)))) {
      return [];
    }
    const rows = await ctx.db
      .query("follows")
      .withIndex("by_followee", (q) => q.eq("followeeId", userId))
      .take(LIST_LIMIT);
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const cards: UserCard[] = [];
    for (const row of rows) {
      const user = await ctx.db.get("users", row.followerId);
      if (user === null) continue;
      cards.push({
        userId: user._id,
        username: user.username ?? "",
        displayName: displayNameOf(user),
        avatarUrl: avatarUrlOf(user),
        homeCity: user.homeCity,
      });
    }
    return cards;
  },
});
