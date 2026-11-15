// Owner: People session. A person's profile, and "compare with me".
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import type { Category, CompareResult, ProfileResult, RankedListItem } from "./lib/contract";
import { tasteOf } from "./lib/discovery";
import { BUCKET_ORDER, CATEGORY_NOUN, agreePct, compareSummary } from "./lib/social";
import { cardOf, friendCountOf, statusWith, tasteMatchOf } from "./friends";
import { canSee, feedItemBuilder, postViewer, type PostViewer } from "./posts";
import { MAX_RANKINGS_PER_USER, rankedListOf } from "./rankings";
import { quizAnswersOf, tasteSummary, tasteSummaryOf } from "./users";

const CATEGORY_ORDER: Category[] = ["nightlife", "food", "live", "culture", "outdoors", "popup"];
const RECENT_POSTS = 10;
/** A person's posts we read to count them and to know which rankings are private. */
const POSTS_SCAN = 500;
const SHARED_LIMIT = 50;
const NEW_TO_ME_LIMIT = 10;

/**
 * A person's ranked list as this viewer may see it. A ranking is as visible as its post: friends don't
 * see the private ones, a non-friend sees only the public ones. A ranking whose post was deleted is
 * for friends. Someone under 21 never gets another person's nightlife.
 */
async function visibleRankedList(
  ctx: QueryCtx,
  viewer: PostViewer,
  userId: Id<"users">,
  posts: Doc<"posts">[],
): Promise<RankedListItem[]> {
  const all = await rankedListOf(ctx, userId);
  if (viewer.userId === userId) {
    return all;
  }
  const postOf = new Map(
    posts.flatMap((post) => (post.rankingId === undefined ? [] : [[post.rankingId, post] as const])),
  );
  return all.filter((item) => {
    if (viewer.under21 && item.category === "nightlife") {
      return false;
    }
    const post = postOf.get(item.rankingId);
    return post === undefined ? viewer.friendIds.has(userId) : canSee(viewer, post);
  });
}

const postsOf = (ctx: QueryCtx, userId: Id<"users">) =>
  ctx.db
    .query("posts")
    .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
    .order("desc")
    .take(POSTS_SCAN);

export const get = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args): Promise<ProfileResult | null> => {
    const viewer = await postViewer(ctx);
    if (viewer.userId === null) {
      return null;
    }
    const userId = args.userId ?? viewer.userId;
    const user = await ctx.db.get("users", userId);
    if (user === null) {
      return null;
    }
    const isMe = userId === viewer.userId;
    const { status, requestId } = await statusWith(ctx, viewer.userId, userId);
    const visible = isMe || status === "friends" || user.defaultVisibility === "public";
    const posts = await postsOf(ctx, userId);
    const ranked = await ctx.db
      .query("rankings")
      .withIndex("by_user_category", (q) => q.eq("userId", userId))
      .take(MAX_RANKINGS_PER_USER);
    const result: ProfileResult = {
      user: { ...cardOf(user), bio: user.bio, isMe, status, requestId },
      canSee: visible,
      counts: {
        ranked: ranked.length,
        friends: await friendCountOf(ctx, userId),
        posts: posts.length,
      },
      tasteSummary: [],
      lists: [],
      recentPosts: [],
    };
    if (!visible) {
      return result;
    }
    result.tasteSummary = await tasteSummaryOf(ctx, user);
    const items = await visibleRankedList(ctx, viewer, userId, posts);
    for (const category of CATEGORY_ORDER) {
      const inCategory = items
        .filter((item) => item.category === category)
        .sort((a, b) => a.position - b.position);
      if (inCategory.length > 0) {
        result.lists.push({ category, noun: CATEGORY_NOUN[category], items: inCategory });
      }
    }
    const build = feedItemBuilder(ctx, viewer);
    for (const post of posts) {
      if (result.recentPosts.length >= RECENT_POSTS) {
        break;
      }
      const item = await build(post);
      if (item !== null) {
        result.recentPosts.push(item);
      }
    }
    return result;
  },
});

export const compare = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<CompareResult | null> => {
    const viewer = await postViewer(ctx);
    const myId = viewer.userId;
    // Friends only: comparing shows their scores.
    if (myId === null || myId === userId || !viewer.friendIds.has(userId)) {
      return null;
    }
    const me = await ctx.db.get("users", myId);
    const them = await ctx.db.get("users", userId);
    if (me === null || them === null) {
      return null;
    }
    const matchPct = tasteMatchOf(me, them);
    // The same four meters users.me returns; someone who hasn't taken the quiz reads as neutral.
    const myDims = tasteSummary(tasteOf(me), await quizAnswersOf(ctx, myId));
    const theirDims = tasteSummary(tasteOf(them), await quizAnswersOf(ctx, userId));
    const dims = myDims.map((dim, index) => ({
      label: dim.label,
      me: dim.pct,
      them: theirDims[index]?.pct ?? 0,
    }));

    const mine = await rankedListOf(ctx, myId);
    const theirs = await visibleRankedList(ctx, viewer, userId, await postsOf(ctx, userId));
    const mineById = new Map(mine.map((item) => [item.id as string, item]));
    const both = theirs.flatMap((their) => {
      const my = mineById.get(their.id);
      return my === undefined ? [] : [{ my, their }];
    });
    both.sort((a, b) => b.my.score - a.my.score);
    const shared = both.slice(0, SHARED_LIMIT).map(({ my, their }) => ({
      kind: their.kind,
      id: their.id,
      name: their.name,
      category: their.category,
      myScore: my.score,
      theirScore: their.score,
    }));
    const theirTopNewToMe = theirs
      .filter((item) => !mineById.has(item.id))
      .sort(
        (a, b) =>
          b.score - a.score ||
          BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket),
      )
      .slice(0, NEW_TO_ME_LIMIT);
    return {
      me: cardOf(me),
      them: cardOf(them),
      tasteMatchPct: matchPct,
      agreePct: agreePct(both.map(({ my, their }) => ({ mine: my.bucket, theirs: their.bucket }))),
      dims,
      shared,
      theirTopNewToMe,
      summary: compareSummary(
        both.map(({ my, their }) => ({
          category: their.category,
          myScore: my.score,
          theirScore: their.score,
        })),
        matchPct,
      ),
    };
  },
});
