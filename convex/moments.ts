import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    return await ctx.db
      .query("moments")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .order("desc")
      .collect();
  },
});

export const add = mutation({
  args: { text: v.string() },
  returns: v.id("moments"),
  handler: async (ctx, { text }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    return await ctx.db.insert("moments", { authorId: userId, text });
  },
});
