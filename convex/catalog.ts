// Owner: Data session. Hand-added places and events, catalog stats.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { normalizeName, performerInput, upsertRows } from "./ingest";
import { FEATURES } from "./lib/recs";
import { renumber } from "./lib/social";
import { deletePostCascade, rankingsOf, writePlacement } from "./rankings";
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

const MAX_REMOVED_PLACES = 10;
const REMOVE_ROWS_PER_PLACE = 500;
const REMOVE_TABLE_SCAN = 8000;
const REMOVE_EVENT_SCAN = 2000;
const REMOVE_EVENT_SPAN_DEGREES = 0.005;

type Removed = {
  places: number; rankings: number; posts: number; reactions: number; comments: number; comparisons: number; saves: number;
  tripVotes: number; visitAnswers: number; venueStats: number; notifications: number; pinsEdited: number; eventsUnlinked: number;
  renumberedLists: number;
};

/**
 * Delete catalog places and everything that points at them, so nothing dangles:
 * `npx convex run catalog:removePlaces '{"names": ["Pier 70 Night Market (demo pop-up)"], "dryRun": true}'`.
 * For each place (at most 10 a call, picked by id or by exact name): its rankings, each ranking's post
 * with that post's reactions, comments and photos, any other post about it, comparisons it won or
 * lost, saves, trip votes, visit answers, its venueStats row, notifications that link to it or to a
 * deleted post, deleted posts in anyone's profile pins, and the `placeId` of events held there. Each
 * affected user's category is then re-numbered by the code `rankings.remove` uses, so positions stay
 * 1..n. Elo that other places gained or lost in the deleted comparisons is left as it is.
 * `dryRun` counts without deleting, and lists other places tagged "demo". `truncated` names a table
 * that had more rows than one call reads: run it again.
 */
export const removePlaces = internalMutation({
  args: { placeIds: v.optional(v.array(v.id("places"))), names: v.optional(v.array(v.string())), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { placeIds, names, dryRun }) => {
    const write = !dryRun;
    const wanted = new Map<Id<"places">, Doc<"places">>();
    for (const placeId of placeIds ?? []) {
      const place = await ctx.db.get(placeId);
      if (place) wanted.set(place._id, place);
    }
    const notFound: string[] = [];
    for (const name of names ?? []) {
      const hits = (await ctx.db.query("places").withSearchIndex("search_name", (q) => q.search("name", name)).take(20))
        .filter((place) => place.name === name);
      if (hits.length === 0) notFound.push(name);
      for (const place of hits) wanted.set(place._id, place);
    }
    if (wanted.size > MAX_REMOVED_PLACES) throw new Error(`At most ${MAX_REMOVED_PLACES} places a call`);

    const removed: Removed = {
      places: 0, rankings: 0, posts: 0, reactions: 0, comments: 0, comparisons: 0, saves: 0, tripVotes: 0, visitAnswers: 0,
      venueStats: 0, notifications: 0, pinsEdited: 0, eventsUnlinked: 0, renumberedLists: 0,
    };
    const truncated = new Set<string>();
    const full = <T>(table: string, rows: T[], limit: number) => {
      if (rows.length === limit) truncated.add(table);
      return rows;
    };
    const deletedPosts = new Map<Id<"posts">, Id<"users">>();
    const lists = new Map<string, { userId: Id<"users">; category: Doc<"rankings">["category"] }>();

    const dropPost = async (post: Doc<"posts">) => {
      if (deletedPosts.has(post._id)) return;
      deletedPosts.set(post._id, post.userId);
      removed.posts++;
      removed.reactions += (await ctx.db.query("reactions").withIndex("by_post", (q) => q.eq("postId", post._id)).take(REMOVE_ROWS_PER_PLACE)).length;
      removed.comments += (await ctx.db.query("comments").withIndex("by_post", (q) => q.eq("postId", post._id)).take(REMOVE_ROWS_PER_PLACE)).length;
      if (write) await deletePostCascade(ctx, post);
    };

    for (const place of wanted.values()) {
      const id = place._id;
      const rankings = full("rankings", await ctx.db.query("rankings").withIndex("by_place", (q) => q.eq("placeId", id)).take(REMOVE_ROWS_PER_PLACE), REMOVE_ROWS_PER_PLACE);
      for (const ranking of rankings) {
        const posts = await ctx.db.query("posts").withIndex("by_ranking", (q) => q.eq("rankingId", ranking._id)).take(REMOVE_ROWS_PER_PLACE);
        for (const post of posts) await dropPost(post);
        if (write) await ctx.db.delete(ranking._id);
        removed.rankings++;
        lists.set(ranking.userId + ":" + ranking.category, { userId: ranking.userId, category: ranking.category });
      }
      const posts = full("posts", await ctx.db.query("posts").withIndex("by_target", (q) => q.eq("targetId", id)).take(REMOVE_ROWS_PER_PLACE), REMOVE_ROWS_PER_PLACE);
      for (const post of posts) await dropPost(post);
      const saves = full("saves", await ctx.db.query("saves").withIndex("by_target", (q) => q.eq("targetId", id)).take(REMOVE_ROWS_PER_PLACE), REMOVE_ROWS_PER_PLACE);
      for (const save of saves) if (write) await ctx.db.delete(save._id);
      removed.saves += saves.length;
      const answers = full("visitAnswers", await ctx.db.query("visitAnswers").withIndex("by_target", (q) => q.eq("targetId", id)).take(REMOVE_ROWS_PER_PLACE), REMOVE_ROWS_PER_PLACE);
      for (const answer of answers) if (write) await ctx.db.delete(answer._id);
      removed.visitAnswers += answers.length;
      const stats = await ctx.db.query("venueStats").withIndex("by_target", (q) => q.eq("targetId", id)).take(REMOVE_ROWS_PER_PLACE);
      for (const row of stats) if (write) await ctx.db.delete(row._id);
      removed.venueStats += stats.length;
      // Events held at the place keep existing, without the link.
      const events = full("events", await ctx.db
        .query("events")
        .withIndex("by_lat", (q) => q.gte("lat", place.lat - REMOVE_EVENT_SPAN_DEGREES).lte("lat", place.lat + REMOVE_EVENT_SPAN_DEGREES))
        .take(REMOVE_EVENT_SCAN), REMOVE_EVENT_SCAN).filter((event) => event.placeId === id);
      for (const event of events) if (write) await ctx.db.patch(event._id, { placeId: undefined });
      removed.eventsUnlinked += events.length;
    }

    // These three tables have no index by place, so they are read once, whole (up to the scan limit).
    const gone = (id: string) => wanted.has(id as Id<"places">);
    const comparisons = full("comparisons", await ctx.db.query("comparisons").take(REMOVE_TABLE_SCAN), REMOVE_TABLE_SCAN)
      .filter((row) => gone(row.winnerId) || gone(row.loserId));
    for (const row of comparisons) if (write) await ctx.db.delete(row._id);
    removed.comparisons = comparisons.length;
    const votes = full("tripVotes", await ctx.db.query("tripVotes").take(REMOVE_TABLE_SCAN), REMOVE_TABLE_SCAN).filter((row) => gone(row.targetId));
    for (const row of votes) if (write) await ctx.db.delete(row._id);
    removed.tripVotes = votes.length;
    const deadLinks = new Set<string>([
      ...[...wanted.keys()].map((id) => `/venue/place/${id}`),
      ...[...deletedPosts.keys()].map((id) => `/post/${id}`),
    ]);
    const notifications = full("notifications", await ctx.db.query("notifications").take(REMOVE_TABLE_SCAN), REMOVE_TABLE_SCAN)
      .filter((row) => row.link !== undefined && deadLinks.has(row.link));
    for (const row of notifications) if (write) await ctx.db.delete(row._id);
    removed.notifications = notifications.length;

    for (const userId of new Set(deletedPosts.values())) {
      const pins = await ctx.db.query("profilePins").withIndex("by_user", (q) => q.eq("userId", userId)).take(10);
      for (const row of pins) {
        const postIds = row.postIds.filter((postId) => !deletedPosts.has(postId));
        if (postIds.length === row.postIds.length) continue;
        if (write) await ctx.db.patch(row._id, { postIds });
        removed.pinsEdited++;
      }
    }
    // Close the gaps the deleted rankings left: positions 1..n again, with the scores that go with them.
    for (const { userId, category } of lists.values()) {
      if (write) {
        const rest = await rankingsOf(ctx, userId, category);
        await writePlacement(ctx, rest, renumber(rest.map((row) => ({ id: row._id, bucket: row.bucket, position: row.position }))));
      }
      removed.renumberedLists++;
    }
    for (const place of wanted.values()) {
      if (write && place.imageStorageId) await ctx.storage.delete(place.imageStorageId);
      if (write) await ctx.db.delete(place._id);
      removed.places++;
    }

    const otherDemoTagged = dryRun
      ? (await ctx.db.query("places").withIndex("by_source", (q) => q.eq("source", "seed")).take(REMOVE_ROWS_PER_PLACE))
          .filter((place) => !wanted.has(place._id) && (place.tags?.includes("demo") || /demo|pop-?up/i.test(place.name) || place.sourceId?.startsWith("demo-")))
          .map((place) => place.name)
      : [];
    return {
      dryRun: !write,
      names: [...wanted.values()].map((place) => `${place.name} (${place.source ?? "?"}:${place.sourceId ?? "?"})`),
      notFound, removed, truncated: [...truncated], otherDemoTagged,
    };
  },
});
