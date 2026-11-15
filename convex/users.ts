import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
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
