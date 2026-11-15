import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import {
  friendIdsOf,
  isUnder21,
  scoreCandidate,
  tasteOf,
  userLoader,
  type Viewer,
} from "./lib/discovery";
import { notify } from "./notifications";

const WINDOW_MS = 6 * 60 * 60 * 1000;
const DEDUPE_MS = 24 * 60 * 60 * 1000;
const MIN_SCORE = 8.5;
const MAX_EVENTS = 40;
const MAX_USERS = 50;
const MAX_PER_USER_PER_RUN = 1;
const MAX_PER_USER_PER_DAY = 3;
/** Users read per run to find MAX_USERS who took the quiz and want these alerts. */
const USER_SCAN = 400;
/** A user's notifications from the last day that we read to apply the per-day cap. */
const RECENT_SCAN = 200;

export const eventTonight = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const events = await ctx.db
      .query("events")
      .withIndex("by_start", (q) =>
        q.gt("start", now).lt("start", now + WINDOW_MS),
      )
      .take(MAX_EVENTS);
    if (events.length === 0) {
      return null;
    }
    // Skip people who switched "events tonight" off before any scoring is done for them (notify
    // would drop the notification anyway, after the work).
    const users = (await ctx.db.query("users").take(USER_SCAN))
      .filter(
        (user) =>
          user.tasteVector !== undefined && user.notifPrefs?.eventsTonight !== false,
      )
      .slice(0, MAX_USERS);
    const getUser = userLoader(ctx);

    for (const user of users) {
      const recent = await ctx.db
        .query("notifications")
        .withIndex("by_user_createdAt", (q) =>
          q.eq("userId", user._id).gt("createdAt", now - DEDUPE_MS),
        )
        .order("desc")
        .take(RECENT_SCAN);
      const sent = recent.filter((row) => row.type === "event_tonight");
      const quota = Math.min(
        MAX_PER_USER_PER_RUN,
        MAX_PER_USER_PER_DAY - sent.length,
      );
      if (quota <= 0) {
        continue;
      }
      const alreadySent = new Set(sent.map((row) => row.link));
      const viewer: Viewer = {
        userId: user._id,
        taste: tasteOf(user),
        homeCity: user.homeCity,
        under21: isUnder21(user.birthday, now),
        friendIds: await friendIdsOf(ctx, user._id),
        knownRankings: new Map(),
      };

      const matches = [];
      for (const event of events) {
        if (
          alreadySent.has(`/venue/event/${event._id}`) ||
          (viewer.under21 && event.category === "nightlife")
        ) {
          continue;
        }
        const scored = await scoreCandidate(
          ctx,
          { kind: "event", doc: event },
          viewer,
          event.lat,
          event.lng,
          now,
          getUser,
        );
        if (scored.mine === null && scored.item.score >= MIN_SCORE) {
          matches.push(scored.item);
        }
      }
      matches.sort((a, b) => b.score - a.score);
      for (const item of matches.slice(0, quota)) {
        await notify(ctx, {
          userId: user._id,
          type: "event_tonight",
          title: `Tonight: ${item.name} · ${item.score.toFixed(1)} for you`,
          body: item.why,
          link: `/venue/event/${item.id}`,
        });
      }
    }
    return null;
  },
});
