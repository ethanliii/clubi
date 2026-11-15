import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { NotificationItem } from "./lib/contract";

export const list = query({
  args: {},
  handler: async (): Promise<NotificationItem[]> => {
    return [];
  },
});

export const unreadCount = query({
  args: {},
  handler: async (): Promise<number> => {
    return 0;
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.null(),
  handler: async () => {
    return null;
  },
});
