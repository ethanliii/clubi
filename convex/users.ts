import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { deletePostCascade } from "./rankings";
import { FEATURES, quizToVector } from "./scoring";

const QUIZ_OPTION_COUNTS = [6, 4, 4, 4, 4, 4];
const NIGHT_PEAK_CARD = 3;
const NIGHT_OWL_BY_OPTION = [0.2, 0.5, 0.8, 1];

/** The four meters on a profile. `answers` are the quiz answers (the night-owl meter comes from them). */
export function tasteSummary(taste: number[], answers: number[][]) {
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

const UNREAD_COUNT_CAP = 99;

export async function quizAnswersOf(ctx: QueryCtx, userId: Id<"users">) {
  const quiz = await ctx.db
    .query("quizAnswers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return quiz?.answers ?? [];
}

/** A user's meters, or none before they have taken the quiz. */
export async function tasteSummaryOf(ctx: QueryCtx, user: Doc<"users">) {
  return user.tasteVector === undefined
    ? []
    : tasteSummary(user.tasteVector, await quizAnswersOf(ctx, user._id));
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
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", userId).eq("read", false))
      .take(UNREAD_COUNT_CAP);
    return {
      userId,
      username,
      displayName: user.displayName ?? username,
      avatarUrl: user.avatar,
      homeCity: user.homeCity,
      onboarded: user.tasteVector !== undefined,
      tasteSummary: await tasteSummaryOf(ctx, user),
      // v2, optional: the same number as notifications.unreadCount, so the tab bar needs one query.
      bio: user.bio,
      unreadCount: unread.length,
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
/** Rows deleted per table in one run of deleteUserRows; a user with more is finished by the next run. */
const DELETE_BATCH = 150;

/**
 * Deletes everything a user wrote or received, a batch per table: quiz, rankings, comparisons,
 * notifications (both directions), posts with their photos, reactions and comments, moments,
 * friendships, blocks, saves, trips they own (with members and votes), trip memberships and votes, answers to
 * venue questions, performer affinities and their avatar. Returns true when nothing is left, false when
 * a table still has rows (call again). Shared by `purgeTestUsers`, `settings.deleteAccount` and the
 * demo seed's `clear`.
 */
export async function deleteUserRows(ctx: MutationCtx, userId: Id<"users">): Promise<boolean> {
  let done = true;
  const drop = async (rows: { _id: Id<any> }[]) => {
    if (rows.length >= DELETE_BATCH) {
      done = false;
    }
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  };

  const posts = await ctx.db
    .query("posts")
    .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
    .take(DELETE_BATCH);
  if (posts.length >= DELETE_BATCH) {
    done = false;
  }
  for (const post of posts) {
    await deletePostCascade(ctx, post);
  }
  const trips = await ctx.db
    .query("trips")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .take(DELETE_BATCH);
  for (const trip of trips) {
    await drop(await ctx.db.query("tripMembers").withIndex("by_trip", (q) => q.eq("tripId", trip._id)).take(DELETE_BATCH));
    await drop(await ctx.db.query("tripVotes").withIndex("by_trip", (q) => q.eq("tripId", trip._id)).take(DELETE_BATCH));
  }
  if (done) {
    await drop(trips);
  }

  await drop(await ctx.db.query("quizAnswers").withIndex("by_user", (q) => q.eq("userId", userId)).take(DELETE_BATCH));
  await drop(await ctx.db.query("rankings").withIndex("by_user_category", (q) => q.eq("userId", userId)).take(DELETE_BATCH));
  await drop(await ctx.db.query("comparisons").withIndex("by_user", (q) => q.eq("userId", userId)).take(DELETE_BATCH));
  await drop(await ctx.db.query("notifications").withIndex("by_user_createdAt", (q) => q.eq("userId", userId)).take(DELETE_BATCH));
  await drop(await ctx.db.query("notifications").withIndex("by_actor", (q) => q.eq("actorId", userId)).take(DELETE_BATCH));
  await drop(await ctx.db.query("moments").withIndex("by_author", (q) => q.eq("authorId", userId)).take(DELETE_BATCH));
  await drop(await ctx.db.query("friendships").withIndex("by_userA", (q) => q.eq("userA", userId)).take(DELETE_BATCH));
  await drop(await ctx.db.query("friendships").withIndex("by_userB", (q) => q.eq("userB", userId)).take(DELETE_BATCH));
  await drop(await ctx.db.query("blocks").withIndex("by_blocker", (q) => q.eq("blockerId", userId)).take(DELETE_BATCH));
  await drop(await ctx.db.query("blocks").withIndex("by_blocked", (q) => q.eq("blockedId", userId)).take(DELETE_BATCH));
  await drop(await ctx.db.query("reactions").withIndex("by_user", (q) => q.eq("userId", userId)).take(DELETE_BATCH));
  await drop(await ctx.db.query("comments").withIndex("by_user", (q) => q.eq("userId", userId)).take(DELETE_BATCH));
  await drop(await ctx.db.query("saves").withIndex("by_user", (q) => q.eq("userId", userId)).take(DELETE_BATCH));
  await drop(await ctx.db.query("tripMembers").withIndex("by_user", (q) => q.eq("userId", userId)).take(DELETE_BATCH));
  await drop(await ctx.db.query("tripVotes").withIndex("by_user", (q) => q.eq("userId", userId)).take(DELETE_BATCH));
  // Rows in tables other sessions own. INTEGRATION (Brain): venueStats totals still count these answers.
  await drop(await ctx.db.query("visitAnswers").withIndex("by_user", (q) => q.eq("userId", userId)).take(DELETE_BATCH));
  await drop(await ctx.db.query("affinities").withIndex("by_user", (q) => q.eq("userId", userId)).take(DELETE_BATCH));

  if (done) {
    const user = await ctx.db.get("users", userId);
    if (user?.avatarStorageId !== undefined) {
      await ctx.storage.delete(user.avatarStorageId);
      await ctx.db.patch("users", userId, { avatarStorageId: undefined, avatar: undefined });
    }
  }
  return done;
}

/** Signs the user out everywhere. */
export async function revokeSessionsOf(ctx: MutationCtx, userId: Id<"users">) {
  const sessions = await ctx.runQuery(components.auth.public.listSessions, { userId });
  await ctx.runMutation(components.auth.public.revokeSessions, {
    sessionIds: sessions.map((session) => session.sessionId),
  });
}

/** The last step, once deleteUserRows returned true: sessions, the username, the user row. */
export async function finishUserDelete(ctx: MutationCtx, userId: Id<"users">) {
  await revokeSessionsOf(ctx, userId);
  await ctx.runMutation(components.authUsername.public.deleteUsername, { userId });
  if ((await ctx.db.get("users", userId)) !== null) {
    await ctx.db.delete("users", userId);
  }
}

/** Finishes an account deletion that was too big for one mutation. Scheduled by settings.deleteAccount. */
export const continueDelete = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    if (await deleteUserRows(ctx, userId)) {
      await finishUserDelete(ctx, userId);
    } else {
      await ctx.scheduler.runAfter(0, internal.users.continueDelete, { userId });
    }
    return null;
  },
});

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

    let unfinished = false;
    let deletedUsers = 0;
    for (const userId of batch) {
      if (await deleteUserRows(ctx, userId)) {
        await finishUserDelete(ctx, userId);
        deletedUsers += 1;
      } else {
        unfinished = true;
      }
    }

    const more =
      unfinished || victims.size > batch.length || batch.length === PURGE_USERS_PER_RUN;
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
    return { deletedUsers, continuing: more };
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
