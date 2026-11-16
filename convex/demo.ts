// Demo set-up, hard-coded on purpose (turn DEMO_FRIENDS_FOR_EVERYONE off after the demo):
//  - whoever finishes the quiz is made friends with the demo people (seedSocial's "demo_" users), so
//    a brand-new account opens on a feed that already has friends in it;
//  - `npx convex run demo:befriend '{"username": "ethan"}'` does the same for an existing account;
//  - `npx convex run demo:addFeedPhotos '{}'` puts photos on the demo people's newest posts.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx } from "./_generated/server";

export const DEMO_FRIENDS_FOR_EVERYONE = true;
const DEMO_PREFIX = "demo_";
const MAX_DEMO_USERS = 20;
const POSTS_PER_FRIEND = 6;
const MINUTE = 60 * 1000;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

async function demoUsers(ctx: MutationCtx): Promise<Doc<"users">[]> {
  return await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.gte("username", DEMO_PREFIX).lt("username", DEMO_PREFIX + "￿"))
    .take(MAX_DEMO_USERS);
}

/** Accepted friendships between `userId` and every demo person. Pairs that already have a row are left as they are. */
export async function befriendDemoPeople(ctx: MutationCtx, userId: Id<"users">): Promise<number> {
  let made = 0;
  for (const demo of await demoUsers(ctx)) {
    if (demo._id === userId) continue;
    const forward = await ctx.db.query("friendships").withIndex("by_pair", (q) => q.eq("userA", demo._id).eq("userB", userId)).first();
    const backward = forward ?? (await ctx.db.query("friendships").withIndex("by_pair", (q) => q.eq("userA", userId).eq("userB", demo._id)).first());
    if (backward !== null) continue;
    await ctx.db.insert("friendships", { userA: demo._id, userB: userId, status: "accepted" });
    made++;
  }
  return made;
}

/** Make an existing account friends with the demo people: `npx convex run demo:befriend '{"username": "ethan"}'`. */
export const befriend = internalMutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const user = await ctx.db.query("users").withIndex("by_username", (q) => q.eq("username", username)).first();
    if (user === null) throw new Error(`No user named ${username}`);
    return { friendshipsMade: await befriendDemoPeople(ctx, user._id) };
  },
});

/** The demo people's newest posts without a photo of their own, with the category of the place each is about. */
export const postsWantingPhotos = internalMutation({
  args: {},
  handler: async (ctx) => {
    const out: { postId: Id<"posts">; author: string; place: string; category: string; score: number | null }[] = [];
    for (const demo of await demoUsers(ctx)) {
      const posts = await ctx.db.query("posts").withIndex("by_user_createdAt", (q) => q.eq("userId", demo._id)).order("desc").take(POSTS_PER_FRIEND);
      for (const post of posts) {
        if ((post.photos ?? []).length > 0) continue;
        const target = await ctx.db.get(post.targetId);
        const ranking = post.rankingId ? await ctx.db.get(post.rankingId) : null;
        if (target === null) continue;
        out.push({
          postId: post._id, author: demo.displayName ?? demo.username ?? "", place: "name" in target ? target.name : target.title,
          category: target.category, score: ranking?.score ?? null,
        });
      }
    }
    return out;
  },
});

/** Put stored photos on posts and move those posts to the last few hours, newest first in the order given. */
export const attachPhotos = internalMutation({
  args: { items: v.array(v.object({ postId: v.id("posts"), storageId: v.id("_storage") })) },
  handler: async (ctx, { items }) => {
    const now = Date.now();
    let attached = 0;
    for (const [index, { postId, storageId }] of items.entries()) {
      const post = await ctx.db.get(postId);
      if (post === null) continue;
      // 12 minutes ago, then 49, then 86…: a feed that reads as tonight and last night.
      await ctx.db.patch(postId, { photos: [...(post.photos ?? []), storageId], createdAt: now - (12 + index * 37) * MINUTE });
      attached++;
    }
    return { attached };
  },
});

/** A one-time upload address, for a photo from this computer: `npx convex run demo:uploadUrl`. */
export const uploadUrl = internalMutation({ args: {}, handler: async (ctx) => await ctx.storage.generateUploadUrl() });

/** Free stock photos (Unsplash License) by what the post is about. The same ids the stand-in photos use, plus a few. */
const PHOTO_IDS: Record<string, string[]> = {
  nightlife: ["FrLPeW1urbQ", "5swSzW-stAA", "ubwn8GI9-2o"],
  live: ["bo8XlhXNrE8", "mGUmPLH_c5k"],
  food: ["727R1em0tUA", "tfoRoSoSH_k", "e5pi0nt_UpI"],
  culture: ["AgKI5STbPU4", "5yPvSf3bc6g"],
  outdoors: ["tYgVCTgJdEg"],
};
const photoUrl = (id: string) => `https://unsplash.com/photos/${id}/download?w=1200`;

/**
 * Give the demo people's newest posts a photo each: `npx convex run demo:addFeedPhotos '{"limit": 12}'`.
 * Each photo is used once, on a post about a place of the matching kind, the best-scored posts first;
 * `first` are storage ids already uploaded (demo:uploadUrl) that go on the very top posts.
 */
export const addFeedPhotos = internalAction({
  args: { limit: v.optional(v.number()), first: v.optional(v.array(v.id("_storage"))) },
  handler: async (ctx, { limit, first }): Promise<{ attached: number; failed: string[]; posts: string[] }> => {
    const wanting = await ctx.runMutation(internal.demo.postsWantingPhotos, {});
    wanting.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const max = Math.min(30, Math.max(1, limit ?? 12));
    const items: { postId: Id<"posts">; storageId: Id<"_storage"> }[] = [];
    const used: string[] = [];
    const failed: string[] = [];
    const taken = new Set<string>();
    const authors = new Map<string, number>();
    // The uploaded photos lead, one per friend.
    for (const storageId of first ?? []) {
      const post = wanting.find((p) => !taken.has(p.postId) && (authors.get(p.author) ?? 0) === 0);
      if (!post) break;
      taken.add(post.postId);
      authors.set(post.author, 1);
      items.push({ postId: post.postId, storageId });
      used.push(`${post.author} at ${post.place} (your photo)`);
    }
    const pools = new Map(Object.entries(PHOTO_IDS).map(([category, ids]) => [category, [...ids]]));
    for (const post of wanting) {
      if (items.length >= max) break;
      if (taken.has(post.postId) || (authors.get(post.author) ?? 0) >= 2) continue;
      const id = pools.get(post.category === "popup" ? "food" : post.category)?.shift();
      if (id === undefined) continue;
      try {
        const response = await fetch(photoUrl(id), { redirect: "follow" });
        const blob = await response.blob();
        if (!response.ok || !blob.type.startsWith("image/") || blob.size === 0 || blob.size > MAX_PHOTO_BYTES) throw new Error(String(response.status));
        const storageId = await ctx.storage.store(blob);
        taken.add(post.postId);
        authors.set(post.author, (authors.get(post.author) ?? 0) + 1);
        items.push({ postId: post.postId, storageId });
        used.push(`${post.author} at ${post.place}`);
      } catch (error) {
        failed.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const { attached } = await ctx.runMutation(internal.demo.attachPhotos, { items });
    return { attached, failed, posts: used };
  },
});
