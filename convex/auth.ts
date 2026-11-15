import { v } from "convex/values";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { setupConvexAuth } from "@convex-dev/auth/server";
import {
  setupUsernamePassword,
  type SignUpResult,
} from "@convex-dev/auth/methods/username-password/server";

const auth = setupConvexAuth({ component: components.auth });
export const { signOut, refreshSession, isAuthenticated } = auth;

const usernamePassword = setupUsernamePassword(auth, {
  component: components.authPassword,
  usernameComponent: components.authUsername,
}).attachUserCallbacks({
  createUser: internal.users.createUser,
  onSignIn: internal.users.onSignIn,
});

export const { signInWithUsernamePassword, changePassword } = usernamePassword;

export const signUpCredentials = usernamePassword.signUpWithUsernamePassword;

export const signUpWithUsernamePassword = mutation({
  args: {
    username: v.string(),
    password: v.string(),
    displayName: v.optional(v.string()),
    birthday: v.optional(v.string()),
    homeCity: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { username, password, displayName, birthday, homeCity },
  ): Promise<SignUpResult> => {
    if (birthday !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      throw new Error("birthday must be YYYY-MM-DD");
    }
    const result: SignUpResult = await ctx.runMutation(
      api.auth.signUpCredentials,
      { username, password },
    );
    if (result.status === "complete") {
      await ctx.db.patch("users", result.tokens.userId as Id<"users">, {
        username,
        displayName: displayName?.trim() || username,
        birthday,
        homeCity: homeCity?.trim() || undefined,
      });
    }
    return result;
  },
});
