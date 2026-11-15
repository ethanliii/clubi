// Owner: People session. Settings: profile fields, privacy, notification switches, avatar, account deletion.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { SettingsResult } from "./lib/contract";
import { avatarUrlOf } from "./lib/discovery";
import { cleanBio, cleanBirthday, cleanDisplayName, fullNotifPrefs } from "./lib/social";
import { notifPrefsValidator, visibilityValidator } from "./tables/people";
import { deleteUserRows, finishUserDelete, revokeSessionsOf } from "./users";

const HOME_CITY_MAX = 60;

async function usernameOf(ctx: QueryCtx, user: Doc<"users">) {
  return (
    user.username ??
    (await ctx.runQuery(components.authUsername.public.getUsername, { userId: user._id })) ??
    ""
  );
}

async function settingsOf(ctx: QueryCtx, user: Doc<"users">): Promise<SettingsResult> {
  const username = await usernameOf(ctx, user);
  return {
    username,
    displayName: user.displayName ?? username,
    bio: user.bio,
    avatarUrl: avatarUrlOf(user),
    homeCity: user.homeCity,
    birthday: user.birthday,
    defaultVisibility: user.defaultVisibility ?? "friends",
    discoverable: user.discoverable !== false,
    notifPrefs: fullNotifPrefs(user.notifPrefs),
  };
}

async function signedIn(ctx: MutationCtx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  const user = userId === null ? null : await ctx.db.get("users", userId);
  if (user === null) {
    throw new Error("Not signed in");
  }
  return user;
}

export const get = query({
  args: {},
  handler: async (ctx): Promise<SettingsResult | null> => {
    const userId = await getAuthUserId(ctx);
    const user = userId === null ? null : await ctx.db.get("users", userId);
    return user === null ? null : await settingsOf(ctx, user);
  },
});

export const update = mutation({
  args: {
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    homeCity: v.optional(v.string()),
    birthday: v.optional(v.string()),
    defaultVisibility: v.optional(visibilityValidator),
    discoverable: v.optional(v.boolean()),
    notifPrefs: v.optional(notifPrefsValidator),
  },
  handler: async (ctx, args): Promise<SettingsResult> => {
    const user = await signedIn(ctx);
    // Only the fields that were passed change. An empty bio or home city clears it.
    const patch: Partial<Doc<"users">> = {};
    if (args.displayName !== undefined) {
      patch.displayName = cleanDisplayName(args.displayName);
    }
    if (args.bio !== undefined) {
      patch.bio = cleanBio(args.bio) || undefined;
    }
    if (args.homeCity !== undefined) {
      const homeCity = args.homeCity.trim();
      if (homeCity.length > HOME_CITY_MAX) {
        throw new Error(`A city name can be at most ${HOME_CITY_MAX} characters`);
      }
      patch.homeCity = homeCity || undefined;
    }
    if (args.birthday !== undefined) {
      patch.birthday = cleanBirthday(args.birthday);
    }
    if (args.defaultVisibility !== undefined) {
      patch.defaultVisibility = args.defaultVisibility;
    }
    if (args.discoverable !== undefined) {
      patch.discoverable = args.discoverable;
    }
    if (args.notifPrefs !== undefined) {
      // Switches that weren't passed keep their value.
      patch.notifPrefs = { ...user.notifPrefs, ...args.notifPrefs };
    }
    await ctx.db.patch("users", user._id, patch);
    const saved = await ctx.db.get("users", user._id);
    return await settingsOf(ctx, saved ?? user);
  },
});

export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await signedIn(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setAvatar = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }): Promise<{ avatarUrl: string }> => {
    const user = await signedIn(ctx);
    const avatarUrl = await ctx.storage.getUrl(storageId);
    if (avatarUrl === null) {
      throw new Error("That photo didn't finish uploading. Try again");
    }
    if (user.avatarStorageId !== undefined && user.avatarStorageId !== storageId) {
      await ctx.storage.delete(user.avatarStorageId);
    }
    // `avatar` holds the URL because that is what avatarUrlOf (and every card in the app) reads.
    await ctx.db.patch("users", user._id, { avatarStorageId: storageId, avatar: avatarUrl });
    return { avatarUrl };
  },
});

export const deleteAccount = mutation({
  args: { confirmUsername: v.string() },
  returns: v.null(),
  handler: async (ctx, { confirmUsername }) => {
    const user = await signedIn(ctx);
    const userId: Id<"users"> = user._id;
    const username = await usernameOf(ctx, user);
    if (
      username === "" ||
      confirmUsername.trim().replace(/^@/, "").toLowerCase() !== username.toLowerCase()
    ) {
      throw new Error("Type your username exactly to delete your account");
    }
    if (await deleteUserRows(ctx, userId)) {
      await finishUserDelete(ctx, userId);
    } else {
      // More rows than one mutation should delete: sign out now, hide the account, finish in the background.
      await revokeSessionsOf(ctx, userId);
      await ctx.db.patch("users", userId, { discoverable: false });
      await ctx.scheduler.runAfter(0, internal.users.continueDelete, { userId });
    }
    return null;
  },
});
