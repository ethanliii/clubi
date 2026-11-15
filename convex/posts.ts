// Owner: People session. The friend feed: posts, photos, reactions, comments.
import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator, type PaginationResult } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { CommentItem, FeedItem } from "./lib/contract";
import { avatarUrlOf, displayNameOf, friendIdsOf, isUnder21, userLoader } from "./lib/discovery";
import {
  MAX_POST_PHOTOS,
  canSeePost,
  cleanCaption,
  cleanComment,
  rankLabel,
} from "./lib/social";
import { blockedIdsOf, cardOf } from "./friends";
import { answerChips } from "./lib/insights";
import { notify } from "./notifications";
import {
  deletePostCascade,
  overallPositions,
  rankingsOf,
  targetIdOfRanking,
  targetOf,
} from "./rankings";
import { visibilityValidator } from "./tables/people";

const FRIENDS_FEED_LIMIT = 30;
/** friendsFeed first looks at this many of the newest posts by anyone; see the comment there. */
const FRIENDS_FEED_SCAN = 200;
const FRIENDS_FEED_AUTHORS = 50;
const MAX_PAGE_SIZE = 50;
/** One feed call scans at most this many posts looking for mine and my friends'. */
const FEED_MAX_ROWS_READ = 1000;
/** Above this many friends the author filter is applied after the read instead of inside it. */
const FEED_FILTER_MAX_AUTHORS = 100;
const COUNT_CAP = 500;
const COMMENTS_LIMIT = 200;
const DEFAULT_EMOJI = "❤️";
const MAX_EMOJI_LENGTH = 16;
const NOTIFICATION_TEXT_MAX = 80;
/** How many of my recent notifications-as-actor we check so a re-reaction doesn't notify twice. */
const REACTION_DEDUPE_SCAN = 200;

export type PostViewer = {
  userId: Id<"users"> | null;
  friendIds: Set<Id<"users">>;
  /** People the viewer blocked and people who blocked the viewer. */
  blockedIds: Set<Id<"users">>;
  under21: boolean;
};

export async function postViewer(ctx: QueryCtx): Promise<PostViewer> {
  const userId = await getAuthUserId(ctx);
  const user = userId === null ? null : await ctx.db.get("users", userId);
  if (userId === null || user === null) {
    return { userId: null, friendIds: new Set(), blockedIds: new Set(), under21: false };
  }
  return {
    userId,
    friendIds: await friendIdsOf(ctx, userId),
    blockedIds: await blockedIdsOf(ctx, userId),
    under21: isUnder21(user.birthday, Date.now()),
  };
}

/**
 * The one place that decides who can see a post: the author always; `public` anyone signed in;
 * `friends` (and unset) accepted friends only; `private` nobody else; and nothing at all between two
 * people when either has blocked the other. Every function in this file, and the profile, goes through it.
 */
export const canSee = (viewer: PostViewer, post: Doc<"posts">) =>
  !viewer.blockedIds.has(post.userId) &&
  canSeePost({
    viewerId: viewer.userId,
    authorId: post.userId,
    visibility: post.visibility,
    isFriend: viewer.friendIds.has(post.userId),
  });

/**
 * Returns the function that turns a post row into a `FeedItem` for this viewer, or null when the viewer
 * may not see it (or its author or venue is gone). Lookups repeated across a page (authors, each
 * author's rankings in a category, my own scores) are read once.
 */
export function feedItemBuilder(ctx: QueryCtx, viewer: PostViewer) {
  const getUser = userLoader(ctx);
  const positions = new Map<string, Promise<ReturnType<typeof overallPositions>>>();
  let myScores: Promise<Map<string, number>> | undefined;

  const myScoreFor = async (targetId: string) => {
    if (viewer.userId === null) {
      return undefined;
    }
    myScores ??= rankingsOf(ctx, viewer.userId).then(
      (rows) =>
        new Map(
          rows.flatMap((row) => {
            const id = targetIdOfRanking(row);
            return id === undefined ? [] : [[id as string, row.score] as const];
          }),
        ),
    );
    return (await myScores).get(targetId);
  };

  return async (post: Doc<"posts">): Promise<FeedItem | null> => {
    if (!canSee(viewer, post)) {
      return null;
    }
    const author = await getUser(post.userId);
    const target = await targetOf(ctx, post.targetKind, post.targetId);
    if (author === null || target === null) {
      return null;
    }
    const isMine = viewer.userId === post.userId;
    // Privacy: someone under 21 never gets nightlife, in the feed as anywhere else.
    if (viewer.under21 && target.category === "nightlife" && !isMine) {
      return null;
    }
    const ranking =
      post.rankingId === undefined ? null : await ctx.db.get("rankings", post.rankingId);
    let position = 0;
    if (ranking !== null) {
      const key = `${post.userId}|${ranking.category}`;
      let overall = positions.get(key);
      if (overall === undefined) {
        overall = rankingsOf(ctx, post.userId, ranking.category).then(overallPositions);
        positions.set(key, overall);
      }
      position = (await overall).get(ranking._id)?.position ?? ranking.position;
    }
    const score = ranking?.score ?? 0;
    const photoUrls: string[] = [];
    for (const photo of post.photos ?? []) {
      const url = await ctx.storage.getUrl(photo);
      if (url !== null) {
        photoUrls.push(url);
      }
    }
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_post", (q) => q.eq("postId", post._id))
      .take(COUNT_CAP);
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_post", (q) => q.eq("postId", post._id))
      .take(COUNT_CAP);
    // Counts leave out anyone on either side of a block with the viewer, like everything else.
    const shown = <T extends { userId: Id<"users"> }>(rows: T[]) =>
      rows.filter((row) => !viewer.blockedIds.has(row.userId));
    const mine = reactions.find((reaction) => reaction.userId === viewer.userId);
    return {
      postId: post._id,
      author: {
        userId: author._id,
        displayName: displayNameOf(author),
        avatarUrl: avatarUrlOf(author),
      },
      target: {
        kind: post.targetKind,
        id: post.targetId,
        name: target.name,
        category: target.category,
        imageUrl: target.imageUrl,
      },
      score,
      position,
      label:
        ranking === null
          ? target.name
          : rankLabel(isMine ? "your" : "their", position, ranking.category, score),
      caption: post.caption,
      photoUrls,
      tags: ranking?.tags ?? [],
      createdAt: post.createdAt,
      myScoreForIt: isMine ? undefined : await myScoreFor(post.targetId),
      rankingId: ranking?._id,
      visibility: post.visibility ?? "friends",
      reactionCount: shown(reactions).length,
      myReaction: mine === undefined ? undefined : (mine.emoji ?? DEFAULT_EMOJI),
      commentCount: shown(comments).length,
      insightChips: await insightChipsFor(ctx, ranking?._id),
    };
  };
}

/** Short answers from the questions asked after the ranking, e.g. "Packed", "Mostly 20s". Unset when there are none. */
async function insightChipsFor(ctx: QueryCtx, rankingId: Id<"rankings"> | undefined) {
  if (rankingId === undefined) return undefined;
  const rows = await ctx.db.query("visitAnswers").withIndex("by_ranking", (q) => q.eq("rankingId", rankingId)).take(8);
  const chips = answerChips(rows.map((row) => ({ questionId: row.questionId, optionIds: row.optionIds })));
  return chips.length > 0 ? chips : undefined;
}

async function buildAll(ctx: QueryCtx, viewer: PostViewer, posts: Doc<"posts">[]) {
  const build = feedItemBuilder(ctx, viewer);
  const items: FeedItem[] = [];
  for (const post of posts) {
    const item = await build(post);
    if (item !== null) {
      items.push(item);
    }
  }
  return items;
}

const emptyPage = <T>(): PaginationResult<T> => ({ page: [], isDone: true, continueCursor: "" });

export const feed = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }): Promise<PaginationResult<FeedItem>> => {
    const viewer = await postViewer(ctx);
    if (viewer.userId === null) {
      return emptyPage();
    }
    // Plain newest-first (ALGORITHM.md §7). We page through every post by creation time, on the
    // database's own cursor, so paging is stable and a friend's new post is at the top of the first
    // page the moment it is written. (Merging one index read per friend would need a hand-made
    // cursor, and those leave gaps when a live page shifts.)
    //
    // The "is it by me or a friend" test runs inside the database, before the page size is counted.
    // Without that, posts by strangers used up the page: with enough of them newer than my friends'
    // posts, the first page came back empty and the feed looked blank. `maximumRowsRead` bounds the
    // scan; only past that many stranger posts in a row can a page come back short, and the cursor
    // still moves on. Past that scale the fix is a per-friend feed row written at post time.
    const numItems = Math.min(MAX_PAGE_SIZE, Math.max(1, paginationOpts.numItems));
    const opts = {
      ...paginationOpts,
      numItems,
      maximumRowsRead: Math.min(FEED_MAX_ROWS_READ, paginationOpts.maximumRowsRead ?? FEED_MAX_ROWS_READ),
    };
    const me = viewer.userId;
    const friends = [...viewer.friendIds];
    const newest = ctx.db.query("posts").withIndex("by_createdAt").order("desc");
    const result =
      friends.length > FEED_FILTER_MAX_AUTHORS
        ? await newest.paginate(opts)
        : await newest
            .filter((q) =>
              q.or(
                q.eq(q.field("userId"), me),
                q.and(
                  q.neq(q.field("visibility"), "private"),
                  q.or(...friends.map((friend) => q.eq(q.field("userId"), friend))),
                ),
              ),
            )
            .paginate(opts);
    const mine = result.page.filter(
      (post) => post.userId === me || viewer.friendIds.has(post.userId),
    );
    return { ...result, page: await buildAll(ctx, viewer, mine) };
  },
});

export const friendsFeed = query({
  args: {},
  handler: async (ctx): Promise<FeedItem[]> => {
    const viewer = await postViewer(ctx);
    const { userId } = viewer;
    if (userId === null) {
      return [];
    }
    const inMyFeed = (post: Doc<"posts">) =>
      (post.userId === userId || viewer.friendIds.has(post.userId)) && canSee(viewer, post);
    // Usually the newest posts by anyone already hold 30 of mine and my friends', and then those 30
    // are exactly the newest. Only when they don't (many strangers posting) do we read per author.
    const newest = await ctx.db
      .query("posts")
      .withIndex("by_createdAt")
      .order("desc")
      .take(FRIENDS_FEED_SCAN);
    let posts = newest.filter(inMyFeed);
    if (posts.length < FRIENDS_FEED_LIMIT && newest.length === FRIENDS_FEED_SCAN) {
      const byId = new Map<Id<"posts">, Doc<"posts">>();
      const authors = [userId, ...[...viewer.friendIds].slice(0, FRIENDS_FEED_AUTHORS)];
      for (const author of authors) {
        const theirs = await ctx.db
          .query("posts")
          .withIndex("by_user_createdAt", (q) => q.eq("userId", author))
          .order("desc")
          .take(FRIENDS_FEED_LIMIT);
        for (const post of theirs) {
          byId.set(post._id, post);
        }
      }
      posts = [...byId.values()].filter(inMyFeed).sort((a, b) => b.createdAt - a.createdAt);
    }
    const items = await buildAll(ctx, viewer, posts.slice(0, FRIENDS_FEED_LIMIT + 10));
    return items.slice(0, FRIENDS_FEED_LIMIT);
  },
});

export const byUser = query({
  args: { userId: v.id("users"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { userId, paginationOpts }): Promise<PaginationResult<FeedItem>> => {
    const viewer = await postViewer(ctx);
    if (viewer.userId === null) {
      return emptyPage();
    }
    const result = await ctx.db
      .query("posts")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate({
        ...paginationOpts,
        numItems: Math.min(MAX_PAGE_SIZE, Math.max(1, paginationOpts.numItems)),
      });
    return { ...result, page: await buildAll(ctx, viewer, result.page) };
  },
});

export const get = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }): Promise<FeedItem | null> => {
    const viewer = await postViewer(ctx);
    const post = await ctx.db.get("posts", postId);
    if (post === null) {
      return null;
    }
    return await feedItemBuilder(ctx, viewer)(post);
  },
});

/** The post, when it exists and this viewer may see it. */
async function visiblePost(ctx: QueryCtx, viewer: PostViewer, postId: Id<"posts">) {
  const post = await ctx.db.get("posts", postId);
  return post !== null && canSee(viewer, post) ? post : null;
}

async function myPost(ctx: QueryCtx, postId: Id<"posts">) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Not signed in");
  }
  const post = await ctx.db.get("posts", postId);
  if (post === null || post.userId !== userId) {
    throw new Error("You can only change your own posts");
  }
  return post;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    if ((await getAuthUserId(ctx)) === null) {
      throw new Error("Not signed in");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const attachPhoto = mutation({
  args: { postId: v.id("posts"), storageId: v.id("_storage") },
  handler: async (ctx, { postId, storageId }): Promise<{ photoUrls: string[] }> => {
    const post = await myPost(ctx, postId);
    const photos = post.photos ?? [];
    if (!photos.includes(storageId)) {
      if (photos.length >= MAX_POST_PHOTOS) {
        throw new Error(`A post can have at most ${MAX_POST_PHOTOS} photos`);
      }
      if ((await ctx.storage.getUrl(storageId)) === null) {
        throw new Error("That photo didn't finish uploading. Try again");
      }
      photos.push(storageId);
      await ctx.db.patch("posts", postId, { photos });
    }
    const photoUrls: string[] = [];
    for (const photo of photos) {
      const url = await ctx.storage.getUrl(photo);
      if (url !== null) {
        photoUrls.push(url);
      }
    }
    return { photoUrls };
  },
});

export const update = mutation({
  args: {
    postId: v.id("posts"),
    caption: v.optional(v.string()),
    visibility: v.optional(visibilityValidator),
  },
  returns: v.null(),
  handler: async (ctx, { postId, caption, visibility }) => {
    await myPost(ctx, postId);
    // An empty caption clears it; a caption that isn't passed is left alone.
    if (caption !== undefined) {
      await ctx.db.patch("posts", postId, { caption: cleanCaption(caption) });
    }
    if (visibility !== undefined) {
      await ctx.db.patch("posts", postId, { visibility });
    }
    return null;
  },
});

export const remove = mutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, { postId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const post = await ctx.db.get("posts", postId);
    if (post === null) {
      return null;
    }
    if (post.userId !== userId) {
      throw new Error("You can only change your own posts");
    }
    await deletePostCascade(ctx, post);
    return null;
  },
});

export const react = mutation({
  args: { postId: v.id("posts"), emoji: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ reactionCount: number; myReaction?: string }> => {
    const viewer = await postViewer(ctx);
    const { userId } = viewer;
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const emoji = (args.emoji ?? DEFAULT_EMOJI).trim();
    if (emoji === "" || emoji.length > MAX_EMOJI_LENGTH) {
      throw new Error("Pick one emoji");
    }
    const post = await visiblePost(ctx, viewer, args.postId);
    if (post === null) {
      throw new Error("That post isn't available");
    }
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_post", (q) => q.eq("postId", post._id))
      .take(COUNT_CAP);
    const mine = reactions.find((reaction) => reaction.userId === userId);
    let myReaction: string | undefined = emoji;
    let reactionCount = reactions.length;
    if (mine !== undefined && (mine.emoji ?? DEFAULT_EMOJI) === emoji) {
      await ctx.db.delete("reactions", mine._id);
      myReaction = undefined;
      reactionCount -= 1;
    } else if (mine !== undefined) {
      await ctx.db.patch("reactions", mine._id, { emoji });
    } else {
      await ctx.db.insert("reactions", { postId: post._id, userId, emoji, createdAt: Date.now() });
      reactionCount += 1;
      // The author hears about my reaction to this post the first time only, however often I toggle it.
      const link = `/post/${post._id}`;
      const sentBefore = (
        await ctx.db
          .query("notifications")
          .withIndex("by_actor", (q) => q.eq("actorId", userId))
          .order("desc")
          .take(REACTION_DEDUPE_SCAN)
      ).some((row) => row.type === "post_reaction" && row.link === link);
      if (!sentBefore) {
        const me = await ctx.db.get("users", userId);
        const target = await targetOf(ctx, post.targetKind, post.targetId);
        await notify(ctx, {
          userId: post.userId,
          type: "post_reaction",
          title: `${me === null ? "Someone" : displayNameOf(me)} reacted ${emoji} to your post`,
          body: target?.name ?? "Your post",
          link,
          actorId: userId,
        });
      }
    }
    return { reactionCount, myReaction };
  },
});

export const comments = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }): Promise<CommentItem[]> => {
    const viewer = await postViewer(ctx);
    if ((await visiblePost(ctx, viewer, postId)) === null) {
      return [];
    }
    const rows = await ctx.db
      .query("comments")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .take(COMMENTS_LIMIT);
    const getUser = userLoader(ctx);
    const items: CommentItem[] = [];
    for (const row of rows) {
      const author = viewer.blockedIds.has(row.userId) ? null : await getUser(row.userId);
      if (author === null) {
        continue;
      }
      items.push({
        id: row._id,
        author: cardOf(author),
        text: row.text,
        createdAt: row.createdAt,
        mine: row.userId === viewer.userId,
      });
    }
    return items;
  },
});

export const addComment = mutation({
  args: { postId: v.id("posts"), text: v.string() },
  handler: async (ctx, args): Promise<CommentItem> => {
    const viewer = await postViewer(ctx);
    const { userId } = viewer;
    const me = userId === null ? null : await ctx.db.get("users", userId);
    if (userId === null || me === null) {
      throw new Error("Not signed in");
    }
    const text = cleanComment(args.text);
    const post = await visiblePost(ctx, viewer, args.postId);
    if (post === null) {
      throw new Error("That post isn't available");
    }
    const createdAt = Date.now();
    const id = await ctx.db.insert("comments", { postId: post._id, userId, text, createdAt });
    await notify(ctx, {
      userId: post.userId,
      type: "post_comment",
      title: `${displayNameOf(me)} commented on your post`,
      body:
        text.length > NOTIFICATION_TEXT_MAX
          ? `${text.slice(0, NOTIFICATION_TEXT_MAX - 1)}…`
          : text,
      link: `/post/${post._id}`,
      actorId: userId,
    });
    return { id, author: cardOf(me), text, createdAt, mine: true };
  },
});

export const removeComment = mutation({
  args: { commentId: v.id("comments") },
  returns: v.null(),
  handler: async (ctx, { commentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const comment = await ctx.db.get("comments", commentId);
    if (comment === null) {
      return null;
    }
    const post = await ctx.db.get("posts", comment.postId);
    if (comment.userId !== userId && post?.userId !== userId) {
      throw new Error("You can only remove your own comments, or comments on your posts");
    }
    await ctx.db.delete("comments", commentId);
    return null;
  },
});
