import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { displayNameOf, isUnder21 } from "./lib/discovery";
import { notify } from "./notifications";
import { localOffsetMs } from "./rankings";
import { predict, whyFromFeatures, type Rater } from "./scoring";

const WINDOW_MS = 6 * 60 * 60 * 1000;
const DEDUPE_MS = 24 * 60 * 60 * 1000;
const MIN_SCORE = 8.5;
const MAX_EVENTS = 200;
const MAX_PER_USER_PER_RUN = 1;
const MAX_PER_USER_PER_DAY = 3;

function isLocal(user: Doc<"users">, city: string | undefined) {
  const homeCity = user.homeCity?.trim().toLowerCase();
  return !!homeCity && homeCity === city?.trim().toLowerCase();
}

function clockTime(timestamp: number, lng: number) {
  const local = new Date(timestamp + localOffsetMs(lng));
  const hour = local.getUTCHours();
  const minutes = String(local.getUTCMinutes()).padStart(2, "0");
  return `${hour % 12 || 12}:${minutes} ${hour < 12 ? "AM" : "PM"}`;
}

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
    const users = (await ctx.db.query("users").collect()).filter(
      (user) => user.tasteVector !== undefined,
    );
    const userById = new Map(users.map((user) => [user._id, user]));

    const scorable = [];
    for (const event of events) {
      if (event.venueVector === undefined) {
        continue;
      }
      const rankings = await ctx.db
        .query("rankings")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();
      const raters = rankings.flatMap((ranking) => {
        const rater = userById.get(ranking.userId);
        return rater?.tasteVector === undefined
          ? []
          : [
              {
                userId: rater._id,
                taste: rater.tasteVector,
                score: ranking.score,
                local: ranking.wasLocal ?? isLocal(rater, event.city),
                friend: false,
                name: displayNameOf(rater),
              },
            ];
      });
      scorable.push({ event, venueVector: event.venueVector, raters });
    }

    for (const user of users) {
      const taste = user.tasteVector;
      if (taste === undefined) {
        continue;
      }
      const recent = await ctx.db
        .query("notifications")
        .withIndex("by_user_createdAt", (q) =>
          q.eq("userId", user._id).gt("createdAt", now - DEDUPE_MS),
        )
        .collect();
      const sent = recent.filter((row) => row.type === "event_tonight");
      const alreadySent = new Set(sent.map((row) => row.link));
      const underage = isUnder21(user.birthday, now);
      const matches = scorable
        .filter(
          ({ event }) =>
            !alreadySent.has(`/venue/event/${event._id}`) &&
            !(underage && event.category === "nightlife"),
        )
        .map(({ event, venueVector, raters }) => {
          const others: Rater[] = raters.filter(
            (rater) => rater.userId !== user._id,
          );
          const prediction = predict(
            taste,
            venueVector,
            event.elo ?? 0,
            others,
            isLocal(user, event.city),
          );
          return { event, ...prediction };
        })
        .filter(({ score }) => score >= MIN_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(
          0,
          Math.max(
            0,
            Math.min(MAX_PER_USER_PER_RUN, MAX_PER_USER_PER_DAY - sent.length),
          ),
        );
      for (const { event, score, topFeatures } of matches) {
        await notify(ctx, {
          userId: user._id,
          type: "event_tonight",
          title: `Tonight: ${event.title} · ${score.toFixed(1)} for you`,
          body: `${whyFromFeatures(topFeatures)} · starts ${clockTime(event.start, event.lng)}`,
          link: `/venue/event/${event._id}`,
        });
      }
    }
    return null;
  },
});
