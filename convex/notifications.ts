import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { avatarUrlOf, displayNameOf } from "./lib/discovery";
import type { NotificationItem } from "./lib/contract";

const LIST_LIMIT = 50;
const UNREAD_COUNT_CAP = 99;

export async function notify(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    type: NotificationItem["type"];
    title: string;
    body: string;
    link?: string;
    actorId?: Id<"users">;
  },
) {
  return await ctx.db.insert("notifications", {
    ...args,
    read: false,
    createdAt: Date.now(),
  });
}

export const list = query({
  args: {},
  handler: async (ctx): Promise<NotificationItem[]> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(LIST_LIMIT);
    const actors = new Map<Id<"users">, NotificationItem["actor"]>();
    for (const { actorId } of rows) {
      if (actorId === undefined || actors.has(actorId)) {
        continue;
      }
      const actor = await ctx.db.get("users", actorId);
      actors.set(
        actorId,
        actor === null
          ? undefined
          : {
              userId: actorId,
              displayName: displayNameOf(actor),
              avatarUrl: avatarUrlOf(actor),
            },
      );
    }
    return rows.map((row) => ({
      id: row._id,
      type: row.type,
      title: row.title,
      body: row.body,
      link: row.link,
      read: row.read,
      createdAt: row.createdAt,
      actor: row.actorId === undefined ? undefined : actors.get(row.actorId),
    }));
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return 0;
    }
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", userId).eq("read", false))
      .take(UNREAD_COUNT_CAP);
    return unread.length;
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", userId).eq("read", false))
      .collect();
    for (const row of unread) {
      await ctx.db.patch("notifications", row._id, { read: true });
    }
    return null;
  },
});
