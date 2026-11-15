// Owner: Data session. Hand-added places and events, catalog stats.
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { normalizeName, performerInput, upsertRows } from "./ingest";
import { FEATURES } from "./lib/recs";
import { categoryValidator } from "./tables/catalog";

const STATS_SCAN = 4000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EVENT_LENGTH_MS = 3 * 60 * 60 * 1000;

/**
 * Hand-add a place or an event (events need `start`, ms epoch):
 * `npx convex run catalog:addManual '{"kind":"event","name":"Calvin Harris","category":"live","lat":37.7494,"lng":-122.3866,"city":"San Francisco","start":1796533200000,"venueName":"The Midway","performers":[{"name":"Calvin Harris","genres":["House"]}]}'`.
 * The row is stored with source "manual", featurized from its name, tags and blurb, and is never
 * overwritten by an import; an imported row for the same thing (same name within 50 m, or the same
 * title within an hour) becomes this one. Adding the same name (and start) again updates it. A new
 * event with performers sends the artist alert, like an imported one. Works while imports are frozen.
 */
export const addManual = internalMutation({
  args: {
    kind: v.union(v.literal("place"), v.literal("event")),
    name: v.string(),
    category: categoryValidator,
    lat: v.number(),
    lng: v.number(),
    subcategory: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    blurb: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    // places
    hours: v.optional(v.string()),
    priceLevel: v.optional(v.number()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    // events
    start: v.optional(v.number()),
    end: v.optional(v.number()),
    price: v.optional(v.union(v.number(), v.string())),
    ticketUrl: v.optional(v.string()),
    venueName: v.optional(v.string()),
    performers: v.optional(v.array(performerInput)),
  },
  handler: async (ctx, { kind, ...fields }): Promise<{ outcome: string; id: Id<"places"> | Id<"events"> | null }> => {
    const name = fields.name.trim();
    if (!name) throw new Error("A name is needed");
    if (!(Math.abs(fields.lat) <= 90) || !(Math.abs(fields.lng) <= 180)) throw new Error("That location is not on the map");
    if (kind === "event" && fields.start === undefined) throw new Error("An event needs a start time");
    if (fields.priceLevel !== undefined && ![1, 2, 3, 4].includes(fields.priceLevel)) throw new Error("Price level is 1 to 4");
    const sourceId = `manual:${normalizeName(name)}${kind === "event" ? ":" + fields.start : ""}`;
    const row =
      kind === "place"
        ? { ...fields, name, source: "manual" as const, sourceId, start: undefined, end: undefined, price: undefined, ticketUrl: undefined, venueName: undefined, performers: undefined }
        : { ...fields, name, source: "manual" as const, sourceId, hours: undefined, priceLevel: undefined, website: undefined, phone: undefined };
    const counts = await upsertRows(ctx, kind, [row], { ignoreFreeze: true });
    const outcome = (["inserted", "updated", "unchanged", "replaced", "duplicate", "dropped"] as const).find((key) => counts[key] > 0) ?? "dropped";
    const stored = await ctx.db
      .query(kind === "place" ? "places" : "events")
      .withIndex("by_source", (q) => q.eq("source", "manual").eq("sourceId", sourceId))
      .first();
    return { outcome, id: stored?._id ?? null };
  },
});

type Share = { count: number; pct: number };
const share = (count: number, total: number): Share => ({ count, pct: total === 0 ? 0 : Math.round((count / total) * 1000) / 10 });
const tally = (counts: Record<string, number>, key: string | undefined) => {
  const name = key ?? "unknown";
  counts[name] = (counts[name] ?? 0) + 1;
};

/**
 * What is in the catalog: `npx convex run catalog:stats`. Counts by source and category, events in
 * the next 7 days, and how complete the rows are. Reads at most 4000 rows a table; `truncated`
 * says when a table is larger than that.
 */
export const stats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const places = await ctx.db.query("places").take(STATS_SCAN);
    const events = await ctx.db.query("events").take(STATS_SCAN);
    const performers = await ctx.db.query("performers").take(STATS_SCAN);

    const placesBySource: Record<string, number> = {};
    const placesByCategory: Record<string, number> = {};
    let placesWithHours = 0, placesWithImage = 0, placesWithWebsite = 0, placesWithRating = 0, placesWithoutVector = 0;
    for (const place of places) {
      tally(placesBySource, place.source);
      tally(placesByCategory, place.category);
      if (place.hours) placesWithHours++;
      if (place.imageUrl) placesWithImage++;
      if (place.website) placesWithWebsite++;
      if (place.externalRating !== undefined) placesWithRating++;
      if (place.venueVector?.length !== FEATURES.length) placesWithoutVector++;
    }

    const upcoming = events.filter((event) => (event.end ?? event.start + EVENT_LENGTH_MS) > now);
    const eventsBySource: Record<string, number> = {};
    const eventsByCategory: Record<string, number> = {};
    let next7Days = 0, eventsWithImage = 0, eventsWithPerformers = 0, eventsWithVenue = 0, eventsWithPlace = 0, eventsWithPrice = 0;
    for (const event of upcoming) {
      tally(eventsBySource, event.source);
      tally(eventsByCategory, event.category);
      if (event.start <= now + WEEK_MS) next7Days++;
      if (event.imageUrl) eventsWithImage++;
      if (event.performerNames?.length) eventsWithPerformers++;
      if (event.venueName) eventsWithVenue++;
      if (event.placeId) eventsWithPlace++;
      if (event.price !== undefined) eventsWithPrice++;
    }

    return {
      places: {
        total: places.length,
        bySource: placesBySource,
        byCategory: placesByCategory,
        withHours: share(placesWithHours, places.length),
        withImage: share(placesWithImage, places.length),
        withWebsite: share(placesWithWebsite, places.length),
        withExternalRating: share(placesWithRating, places.length),
        missingVector: placesWithoutVector,
      },
      events: {
        total: events.length,
        upcoming: upcoming.length,
        past: events.length - upcoming.length,
        next7Days,
        bySource: eventsBySource,
        byCategory: eventsByCategory,
        withImage: share(eventsWithImage, upcoming.length),
        withPerformers: share(eventsWithPerformers, upcoming.length),
        withVenueName: share(eventsWithVenue, upcoming.length),
        withPlace: share(eventsWithPlace, upcoming.length),
        withPrice: share(eventsWithPrice, upcoming.length),
      },
      performers: {
        total: performers.length,
        withGenres: share(performers.filter((p) => p.genres?.length).length, performers.length),
        withImage: share(performers.filter((p) => p.imageUrl).length, performers.length),
      },
      truncated: places.length === STATS_SCAN || events.length === STATS_SCAN || performers.length === STATS_SCAN,
    };
  },
});
