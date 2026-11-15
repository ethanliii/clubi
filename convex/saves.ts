// Owner: People session. Saved places ("want") and events I'm going to ("going").
// Privacy: `going` on an event is visible to my friends by design (Brain reads it for "friends going"
// on the home screen); `want` is private and nothing in this file returns anyone's saves but my own.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { SavedItem } from "./lib/contract";
import { isUnder21 } from "./lib/discovery";
import { targetOf } from "./rankings";

const MAX_SAVES = 500;
const LIST_LIMIT = 200;

const vKind = v.union(v.literal("place"), v.literal("event"));
const vTargetId = v.union(v.id("places"), v.id("events"));
const vType = v.union(v.literal("want"), v.literal("going"));

export const toggle = mutation({
  args: { kind: vKind, id: vTargetId, type: vType },
  handler: async (ctx, { kind, id, type }): Promise<{ saved: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const mine = await ctx.db
      .query("saves")
      .withIndex("by_user", (q) => q.eq("userId", userId).eq("type", type))
      .take(MAX_SAVES);
    const existing = mine.filter((row) => row.targetId === id);
    if (existing.length > 0) {
      for (const row of existing) {
        await ctx.db.delete("saves", row._id);
      }
      return { saved: false };
    }
    if (type === "going" && kind !== "event") {
      throw new Error("You can only mark events as going");
    }
    const target = await targetOf(ctx, kind, id);
    const me = await ctx.db.get("users", userId);
    if (target === null || (target.category === "nightlife" && isUnder21(me?.birthday, Date.now()))) {
      throw new Error("That place or event isn't available");
    }
    if (mine.length >= MAX_SAVES) {
      throw new Error("Your list is full. Remove something first");
    }
    await ctx.db.insert("saves", { userId, targetKind: kind, targetId: id, type, createdAt: Date.now() });
    return { saved: true };
  },
});

export const list = query({
  args: { type: v.optional(vType) },
  handler: async (ctx, { type }): Promise<SavedItem[]> => {
    const userId = await getAuthUserId(ctx);
    const me = userId === null ? null : await ctx.db.get("users", userId);
    if (userId === null || me === null) {
      return [];
    }
    const rows =
      type === undefined
        ? await ctx.db
            .query("saves")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .take(MAX_SAVES)
        : await ctx.db
            .query("saves")
            .withIndex("by_user", (q) => q.eq("userId", userId).eq("type", type))
            .take(MAX_SAVES);
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const under21 = isUnder21(me.birthday, Date.now());
    const items: SavedItem[] = [];
    for (const row of rows) {
      if (items.length >= LIST_LIMIT) {
        break;
      }
      const target = await targetOf(ctx, row.targetKind, row.targetId);
      if (target === null || (under21 && target.category === "nightlife")) {
        continue;
      }
      items.push({
        kind: row.targetKind,
        id: row.targetId,
        name: target.name,
        category: target.category,
        type: row.type,
        createdAt: row.createdAt,
        startsAt: target.startsAt,
        imageUrl: target.imageUrl,
        lat: target.lat,
        lng: target.lng,
      });
    }
    return items;
  },
});
