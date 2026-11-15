import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { FEATURES, quizToVector } from "./scoring";

const QUIZ_OPTION_COUNTS = [6, 4, 4, 4, 4, 4];
const NIGHT_PEAK_CARD = 3;
const NIGHT_OWL_BY_OPTION = [0.2, 0.5, 0.8, 1];

function tasteSummary(taste: number[], answers: number[][]) {
  const feature = (name: (typeof FEATURES)[number]) =>
    taste[FEATURES.indexOf(name)] ?? 0;
  const pct = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 100);
  return [
    {
      label: "Chill",
      pct: pct(1 - (feature("energy") + feature("loudness")) / 2),
    },
    {
      label: "Music-first",
      pct: pct(
        Math.max(
          feature("dancing"),
          feature("liveMusic"),
          feature("pop"),
          feature("hiphop"),
          feature("electronic"),
          feature("indie"),
        ),
      ),
    },
    {
      label: "Night owl",
      pct: pct(NIGHT_OWL_BY_OPTION[answers[NIGHT_PEAK_CARD]?.[0] ?? 1] ?? 0.5),
    },
    { label: "Budget-minded", pct: pct(1 - feature("price")) },
  ];
}

const vMethod = v.object({
  name: v.literal("usernamePassword"),
  profile: v.object({}),
});

export const createUser = internalMutation({
  args: { method: vMethod },
  returns: v.id("users"),
  handler: async (ctx) => {
    return await ctx.db.insert("users", {});
  },
});

export const onSignIn = internalMutation({
  args: { method: vMethod, userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get("users", userId);
    if (user === null || user.username !== undefined) {
      return null;
    }
    const username = await ctx.runQuery(
      components.authUsername.public.getUsername,
      { userId },
    );
    if (username !== null) {
      await ctx.db.patch("users", userId, {
        username,
        displayName: user.displayName ?? username,
      });
    }
    return null;
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const user = await ctx.db.get("users", userId);
    if (user === null) {
      return null;
    }
    const username =
      user.username ??
      (await ctx.runQuery(components.authUsername.public.getUsername, {
        userId,
      })) ??
      "";
    const quiz = await ctx.db
      .query("quizAnswers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return {
      userId,
      username,
      displayName: user.displayName ?? username,
      avatarUrl: user.avatar,
      homeCity: user.homeCity,
      onboarded: user.tasteVector !== undefined,
      tasteSummary:
        user.tasteVector === undefined
          ? []
          : tasteSummary(user.tasteVector, quiz?.answers ?? []),
    };
  },
});

export const saveQuiz = mutation({
  args: { answers: v.array(v.array(v.number())) },
  handler: async (ctx, { answers }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const valid =
      answers.length >= 1 &&
      answers.length <= QUIZ_OPTION_COUNTS.length &&
      answers.every((picked, card) =>
        picked.every(
          (option) =>
            Number.isInteger(option) &&
            option >= 0 &&
            option < QUIZ_OPTION_COUNTS[card],
        ),
      );
    if (!valid) {
      throw new Error(
        "answers must be up to 6 arrays of option indexes, one per quiz card",
      );
    }
    const tasteVector = quizToVector(answers);
    const existing = await ctx.db
      .query("quizAnswers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing === null) {
      await ctx.db.insert("quizAnswers", { userId, answers });
    } else {
      await ctx.db.patch("quizAnswers", existing._id, { answers });
    }
    await ctx.db.patch("users", userId, {
      tasteVector,
      tastePrior: tasteVector,
    });
    return { tasteSummary: tasteSummary(tasteVector, answers) };
  },
});

const PURGE_USERS_PER_RUN = 10;
const ELO_RESET_PAGE = 300;

export const purgeTestUsers = internalMutation({
  args: { prefixes: v.array(v.string()), resetElo: v.optional(v.boolean()) },
  handler: async (ctx, { prefixes, resetElo }) => {
    if (prefixes.length === 0 || prefixes.some((prefix) => prefix === "")) {
      throw new Error("prefixes must be non-empty strings");
    }
    const victims = new Map<Id<"users">, true>();
    for (const prefix of prefixes) {
      const named = await ctx.db
        .query("users")
        .withIndex("by_username", (q) =>
          q.gte("username", prefix).lt("username", prefix + "\uffff"),
        )
        .take(PURGE_USERS_PER_RUN);
      for (const user of named) {
        victims.set(user._id, true);
      }
    }
    const unnamed = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", undefined))
      .collect();
    for (const user of unnamed) {
      const username = await ctx.runQuery(
        components.authUsername.public.getUsername,
        { userId: user._id },
      );
      if (prefixes.some((prefix) => username?.startsWith(prefix))) {
        victims.set(user._id, true);
      }
    }
    const batch = [...victims.keys()].slice(0, PURGE_USERS_PER_RUN);

    for (const userId of batch) {
      const quizzes = await ctx.db
        .query("quizAnswers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const rankings = await ctx.db
        .query("rankings")
        .withIndex("by_user_category", (q) => q.eq("userId", userId))
        .collect();
      const comparisons = await ctx.db
        .query("comparisons")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const received = await ctx.db
        .query("notifications")
        .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
        .collect();
      const sent = await ctx.db
        .query("notifications")
        .withIndex("by_actor", (q) => q.eq("actorId", userId))
        .collect();
      const posts = await ctx.db
        .query("posts")
        .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
        .collect();
      const moments = await ctx.db
        .query("moments")
        .withIndex("by_author", (q) => q.eq("authorId", userId))
        .collect();
      const friendships = [
        ...(await ctx.db
          .query("friendships")
          .withIndex("by_userA", (q) => q.eq("userA", userId))
          .collect()),
        ...(await ctx.db
          .query("friendships")
          .withIndex("by_userB", (q) => q.eq("userB", userId))
          .collect()),
      ];
      const reactions = await ctx.db
        .query("reactions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const post of posts) {
        reactions.push(
          ...(await ctx.db
            .query("reactions")
            .withIndex("by_post", (q) => q.eq("postId", post._id))
            .collect()),
        );
        for (const photo of post.photos ?? []) {
          await ctx.storage.delete(photo);
        }
      }
      const rows = [
        ...quizzes,
        ...rankings,
        ...comparisons,
        ...received,
        ...sent,
        ...posts,
        ...moments,
        ...friendships,
        ...reactions,
      ];
      for (const id of new Set(rows.map((row) => row._id))) {
        await ctx.db.delete(id);
      }

      const sessions = await ctx.runQuery(components.auth.public.listSessions, {
        userId,
      });
      await ctx.runMutation(components.auth.public.revokeSessions, {
        sessionIds: sessions.map((session) => session.sessionId),
      });
      await ctx.runMutation(components.authUsername.public.deleteUsername, {
        userId,
      });
      await ctx.db.delete(userId);
    }

    const more = victims.size > batch.length || batch.length === PURGE_USERS_PER_RUN;
    if (more) {
      await ctx.scheduler.runAfter(0, internal.users.purgeTestUsers, {
        prefixes,
        resetElo,
      });
    } else if (resetElo) {
      await ctx.scheduler.runAfter(0, internal.users.resetElo, {
        table: "places",
        cursor: null,
      });
    }
    return { deletedUsers: batch.length, continuing: more };
  },
});

export const resetElo = internalMutation({
  args: {
    table: v.union(v.literal("places"), v.literal("events")),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { table, cursor }) => {
    const page = await ctx.db
      .query(table)
      .paginate({ numItems: ELO_RESET_PAGE, cursor });
    for (const doc of page.page) {
      if ((doc.elo ?? 0) !== 0 || (doc.nComparisons ?? 0) !== 0) {
        await ctx.db.patch(doc._id, { elo: 0, nComparisons: 0 });
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.users.resetElo, {
        table,
        cursor: page.continueCursor,
      });
    } else if (table === "places") {
      await ctx.scheduler.runAfter(0, internal.users.resetElo, {
        table: "events",
        cursor: null,
      });
    }
    return null;
  },
});
