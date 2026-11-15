// Owner: Bryan (UI merge, decisions D1 and Q7). Extra onboarding data the 6-card quiz doesn't cover.
// Tables: convex/tables/ui.ts.
//
// INTEGRATION (People/Brain): users.saveQuiz still builds the taste vector from the 6 cards. Brain can read
// quizExtras (song stars, scenarios, hot takes, nights) to refine the prior; nothing here changes scoring.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { targetOf } from "./rankings";

const MAX_QUIZ_BYTES = 20_000;
const MAX_SEED = 12;
const MAX_PINS = 9;

const vKind = v.union(v.literal("place"), v.literal("event"));
const vTargetId = v.union(v.id("places"), v.id("events"));
const vBucket = v.union(v.literal("loved"), v.literal("fine"), v.literal("didnt"));

/** Stores the full quiz answers (see QuizAnswers in src/features/quiz.ts). Replaces my earlier answers. */
export const saveExtendedQuiz = mutation({
  args: { answers: v.any() },
  handler: async (ctx, { answers }): Promise<null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    if (typeof answers !== "object" || answers === null || JSON.stringify(answers).length > MAX_QUIZ_BYTES) {
      throw new Error("Quiz answers are too large");
    }
    const row = await ctx.db
      .query("quizExtras")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (row === null) {
      await ctx.db.insert("quizExtras", { userId, answers, updatedAt: Date.now() });
    } else {
      await ctx.db.patch("quizExtras", row._id, { answers, updatedAt: Date.now() });
    }
    return null;
  },
});

export const myExtendedQuiz = query({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const row = await ctx.db
      .query("quizExtras")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return row?.answers ?? null;
  },
});

/**
 * "Been here?" from onboarding (Q7): each pick becomes a real ranking through rankings.rank, placed at the
 * bottom of its bucket with no comparisons and posted as private, so the feed isn't flooded on day one.
 * Skips places I already ranked and anything I can't see.
 */
export const seedRatings = mutation({
  args: { items: v.array(v.object({ kind: vKind, id: vTargetId, bucket: vBucket })) },
  handler: async (ctx, { items }): Promise<{ saved: number }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    let saved = 0;
    for (const item of items.slice(0, MAX_SEED)) {
      const target = await targetOf(ctx, item.kind, item.id);
      if (target === null) continue;
      const list: { id: Id<"places"> | Id<"events"> }[] = await ctx.runQuery(api.rankings.listInBucket, {
        category: target.category,
        bucket: item.bucket,
      });
      if (list.some((row) => row.id === item.id)) continue;
      try {
        await ctx.runMutation(api.rankings.rank, {
          kind: item.kind,
          id: item.id,
          bucket: item.bucket,
          position: list.length + 1,
          comparisons: [],
          tags: [],
          visibility: "private",
        });
        saved += 1;
      } catch {
        // Nightlife for under-21s, or a place that went away: skip it, keep the rest.
      }
    }
    return { saved };
  },
});

/** Pinned favorites on my profile (E13): up to 9 of my own posts, in this order. */
export const setPins = mutation({
  args: { postIds: v.array(v.id("posts")) },
  handler: async (ctx, { postIds }): Promise<{ postIds: Id<"posts">[] }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const unique = [...new Set(postIds)].slice(0, MAX_PINS);
    for (const postId of unique) {
      const post = await ctx.db.get("posts", postId);
      if (post === null || post.userId !== userId) {
        throw new Error("You can only pin your own posts");
      }
    }
    const row = await ctx.db
      .query("profilePins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (row === null) {
      await ctx.db.insert("profilePins", { userId, postIds: unique });
    } else {
      await ctx.db.patch("profilePins", row._id, { postIds: unique });
    }
    return { postIds: unique };
  },
});

/** A user's pinned post ids, in order. The app shows them from profile.get's posts. */
export const pins = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args): Promise<Id<"posts">[]> => {
    const me = await getAuthUserId(ctx);
    const userId = args.userId ?? me;
    if (userId === null) return [];
    const row = await ctx.db
      .query("profilePins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return row?.postIds ?? [];
  },
});
