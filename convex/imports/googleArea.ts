import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { featurize, haversineMeters } from "../ingest";
import type { Category } from "../lib/contract";
import { categoryValidator } from "../tables/catalog";
import {
  DEMO_LAT, DEMO_LNG, MAX_PHOTO_BYTES, askGoogle, bestPhoto, nameStrength, periodsToHours, photoAttribution, photoMediaUrl,
  type GooglePlace,
} from "./google";

// New places from Google Places (New) Nearby Search, hand-run:
// `npx convex run imports/googleArea:importArea '{"radiusMeters": 2500}'` (the centre defaults to the
// demo location). The circle is cut into small cells, and each cell is asked once per group of place
// types (bars and clubs first), because one request returns at most 20 places. A result that is a
// place the catalog already has (same Google id, or a matching name within 120 m) only fills that
// row's gaps; anything else becomes a new row with source "google". Every place that ends up without
// an image gets its Google photo, copied into file storage. Each request is counted first against
// the caps and the dollar ceiling in imports/google.ts.

const NEARBY_ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";
const AREA_FIELD_MASK = [
  "places.id", "places.displayName", "places.location", "places.businessStatus", "places.primaryType", "places.types",
  "places.formattedAddress", "places.regularOpeningHours.periods", "places.rating", "places.userRatingCount", "places.priceLevel",
  "places.websiteUri", "places.nationalPhoneNumber", "places.photos",
].join(",");
const RESULTS_PER_SEARCH = 20;
const MATCH_METERS = 120;
const METERS_PER_DEGREE = 111320;
const DEFAULT_CELL_METERS = 450;
const MIN_CELL_METERS = 150;
const MAX_CELL_METERS = 2000;
const MAX_RADIUS_METERS = 15000;
const DEFAULT_TASKS = 24;
const MAX_TASKS = 60;
const AREA_WORKERS = 4;
/** A cell with no catalog place this close to it is water or empty land: not worth a request. */
const EMPTY_CELL_MARGIN_METERS = 250;
/**
 * A result becomes a new place only when this many people have rated it on Google: below that it is
 * mostly lobby sculptures, private courtyards and second pins for a place the catalog already has.
 */
export const MIN_RATINGS_TO_INSERT = 20;
const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/** The place types asked for together. `primary` asks for places whose main type is one of them. */
export const TYPE_GROUPS = {
  nightlife: { primary: true, types: ["bar", "night_club", "pub", "wine_bar", "karaoke", "comedy_club", "dance_hall"] },
  food: { primary: false, types: ["restaurant", "cafe", "bakery"] },
  sights: {
    primary: true,
    types: ["concert_hall", "event_venue", "performing_arts_theater", "amphitheatre", "movie_theater", "museum", "art_gallery", "cultural_center", "park", "garden"],
  },
} as const;
export type TypeGroup = keyof typeof TYPE_GROUPS;
const groupValidator = v.union(v.literal("nightlife"), v.literal("food"), v.literal("sights"));

/** What a Google type makes a place here. The first of a result's types found in this table decides. */
const KINDS: Record<string, { category: Category; subcategory: string }> = {
  night_club: { category: "nightlife", subcategory: "nightclub" },
  wine_bar: { category: "nightlife", subcategory: "wine bar" },
  karaoke: { category: "nightlife", subcategory: "karaoke bar" },
  dance_hall: { category: "nightlife", subcategory: "dance hall" },
  pub: { category: "nightlife", subcategory: "pub" },
  bar: { category: "nightlife", subcategory: "bar" },
  comedy_club: { category: "live", subcategory: "comedy club" },
  concert_hall: { category: "live", subcategory: "music venue" },
  amphitheatre: { category: "live", subcategory: "amphitheatre" },
  event_venue: { category: "live", subcategory: "event venue" },
  performing_arts_theater: { category: "culture", subcategory: "theatre" },
  movie_theater: { category: "culture", subcategory: "cinema" },
  museum: { category: "culture", subcategory: "museum" },
  art_gallery: { category: "culture", subcategory: "gallery" },
  cultural_center: { category: "culture", subcategory: "arts centre" },
  park: { category: "outdoors", subcategory: "park" },
  garden: { category: "outdoors", subcategory: "garden" },
  cafe: { category: "food", subcategory: "cafe" },
  coffee_shop: { category: "food", subcategory: "cafe" },
  bakery: { category: "food", subcategory: "bakery" },
  restaurant: { category: "food", subcategory: "restaurant" },
};
/** Types that say nothing a person would search by. */
const DULL_TYPES = new Set(["point_of_interest", "establishment", "food", "store", "restaurant", "bar", "cafe"]);
const words = (type: string) => type.replace(/_/g, " ");

export type AreaRow = {
  googleId: string; name: string; lat: number; lng: number; closed: boolean; category: Category; subcategory: string; tags: string[];
  address?: string; city?: string; hours?: string; priceLevel?: number; website?: string; phone?: string; rating?: number; ratingCount?: number;
};

/** One Nearby Search result as a catalog row, or null when it has no name, no position or no type the app shows. */
export function areaRow(result: GooglePlace & { primaryType?: string; types?: string[]; formattedAddress?: string }): AreaRow | null {
  const name = result.displayName?.text?.trim();
  const lat = result.location?.latitude;
  const lng = result.location?.longitude;
  if (!result.id || !name || typeof lat !== "number" || typeof lng !== "number") return null;
  if (result.businessStatus === "CLOSED_TEMPORARILY") return null;
  const types = [result.primaryType, ...(result.types ?? [])].filter((type): type is string => !!type);
  // "mexican_restaurant" is a restaurant with a cuisine: the cuisine becomes the subcategory.
  const cuisine = types.find((type) => type.endsWith("_restaurant"));
  const known = types.find((type) => KINDS[type] !== undefined);
  const primaryKind = result.primaryType ? KINDS[result.primaryType] : undefined;
  const kind = primaryKind ?? (cuisine && (!known || KINDS[known].category === "food") ? { category: "food" as const, subcategory: "restaurant" } : known ? KINDS[known] : undefined)
    ?? (cuisine ? { category: "food" as const, subcategory: "restaurant" } : undefined);
  if (!kind) return null;
  const subcategory = kind.category === "food" && kind.subcategory === "restaurant" && cuisine ? words(cuisine) : kind.subcategory;
  const tags = [...new Set(types.filter((type) => !DULL_TYPES.has(type)).map(words))].filter((tag) => tag !== subcategory).slice(0, 4);
  const parts = (result.formattedAddress ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1 && /^(usa|united states)$/i.test(parts[parts.length - 1])) parts.pop();
  const rating = typeof result.rating === "number" && result.rating >= 1 && result.rating <= 5 ? result.rating : undefined;
  return {
    googleId: result.id, name, lat, lng, closed: result.businessStatus === "CLOSED_PERMANENTLY", ...kind, subcategory, tags,
    address: parts.length ? parts.join(", ") : undefined,
    city: parts.length >= 3 ? parts[parts.length - 2] : undefined,
    hours: periodsToHours(result.regularOpeningHours?.periods),
    priceLevel: PRICE_LEVELS[result.priceLevel ?? ""],
    website: result.websiteUri?.startsWith("http") ? result.websiteUri : undefined,
    phone: result.nationalPhoneNumber || undefined,
    rating,
    ratingCount: typeof result.userRatingCount === "number" && result.userRatingCount >= 0 ? result.userRatingCount : undefined,
  };
}

/**
 * The centres of the cells that cover a circle (or a ring, with `innerMeters`), nearest the centre
 * first: a square grid whose spacing lets circles of `cellMeters` radius cover every point.
 */
export function areaCells(lat: number, lng: number, radiusMeters: number, cellMeters: number, innerMeters = 0): { lat: number; lng: number }[] {
  const step = cellMeters * Math.SQRT2;
  const reach = Math.ceil(radiusMeters / step);
  const perLng = METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180);
  const cells: { lat: number; lng: number; meters: number }[] = [];
  for (let i = -reach; i <= reach; i++) {
    for (let j = -reach; j <= reach; j++) {
      const meters = Math.hypot(i * step, j * step);
      if (meters > radiusMeters + step / 2 || meters + cellMeters < innerMeters) continue;
      cells.push({ lat: lat + (i * step) / METERS_PER_DEGREE, lng: lng + (j * step) / perLng, meters });
    }
  }
  return cells.sort((a, b) => a.meters - b.meters).map(({ lat, lng }) => ({ lat, lng }));
}

/** The Nearby Search request body for one cell and one group of types. */
export const nearbyBody = (cell: { lat: number; lng: number }, cellMeters: number, group: TypeGroup) => ({
  [TYPE_GROUPS[group].primary ? "includedPrimaryTypes" : "includedTypes"]: TYPE_GROUPS[group].types,
  maxResultCount: RESULTS_PER_SEARCH,
  rankPreference: "POPULARITY",
  locationRestriction: { circle: { center: { latitude: cell.lat, longitude: cell.lng }, radius: cellMeters } },
});

/** Where every catalog place is, to leave out cells that hold nothing (the bay, mostly). */
export const placePositions = internalQuery({
  args: {},
  handler: async (ctx): Promise<[number, number][]> => (await ctx.db.query("places").collect()).map((place) => [place.lat, place.lng]),
});

const rowValidator = v.object({
  googleId: v.string(), name: v.string(), lat: v.number(), lng: v.number(), closed: v.boolean(), category: categoryValidator,
  subcategory: v.string(), tags: v.array(v.string()), address: v.optional(v.string()), city: v.optional(v.string()),
  hours: v.optional(v.string()), priceLevel: v.optional(v.number()), website: v.optional(v.string()), phone: v.optional(v.string()),
  rating: v.optional(v.number()), ratingCount: v.optional(v.number()),
});

type Outcome = "inserted" | "matched" | "known" | "closed" | "skipped";

/**
 * Store one search's results. A result already imported is `known`; one that is a place the catalog
 * has (same Google id, or the surest matching name within 120 m) fills that row's gaps and is
 * `matched`; a closed one closes the row it surely is (`closed`) and is otherwise `skipped`; one with
 * fewer than 20 ratings, or whose name is a place already tied to another Google entry, is `skipped`
 * too; the rest are `inserted`. Brain's fields, hand-set values and existing images are never touched.
 * `needsPhoto` says the place has no image yet.
 */
export const saveAreaResults = internalMutation({
  args: { rows: v.array(rowValidator) },
  handler: async (ctx, { rows }): Promise<{ googleId: string; placeId?: Id<"places">; outcome: Outcome; needsPhoto: boolean }[]> => {
    const out = [];
    const band = MATCH_METERS / METERS_PER_DEGREE;
    for (const row of rows) {
      const imported = await ctx.db.query("places").withIndex("by_source", (q) => q.eq("source", "google").eq("sourceId", row.googleId)).first();
      if (imported) {
        if (row.closed && !imported.permanentlyClosed) await ctx.db.patch(imported._id, { permanentlyClosed: true });
        out.push({ googleId: row.googleId, placeId: imported._id, outcome: row.closed ? ("closed" as const) : ("known" as const), needsPhoto: !row.closed && !imported.imageUrl });
        continue;
      }
      const near = (await ctx.db.query("places").withIndex("by_lat", (q) => q.gte("lat", row.lat - band).lte("lat", row.lat + band)).collect())
        .map((place) => ({
          place,
          meters: haversineMeters(place, row),
          strength: place.googlePlaceId === row.googleId ? 3 : nameStrength(place.name, row.name),
        }))
        .filter(({ meters, strength }) => strength === 3 || (strength > 0 && meters <= MATCH_METERS))
        .sort((a, b) => b.strength - a.strength || a.meters - b.meters)[0];
      if (near && near.strength < 3 && near.place.googlePlaceId) {
        // The catalog's place of this name is already tied to another Google entry: this one is a
        // second pin for it (or a neighbour with a like name), and is neither merged nor added.
        out.push({ googleId: row.googleId, outcome: "skipped" as const, needsPhoto: false });
        continue;
      }
      if (near) {
        const { place } = near;
        if (row.closed) {
          // Only the row that is surely this place is closed; a loose match is left alone.
          if (near.strength >= 2 && !place.permanentlyClosed) await ctx.db.patch(place._id, { permanentlyClosed: true });
          out.push({ googleId: row.googleId, placeId: place._id, outcome: near.strength >= 2 ? ("closed" as const) : ("skipped" as const), needsPhoto: false });
          continue;
        }
        const patch = {
          googlePlaceId: row.googleId,
          externalRating: row.rating,
          externalRatingCount: row.ratingCount,
          hours: place.hours ? undefined : row.hours,
          priceLevel: place.priceLevel !== undefined ? undefined : row.priceLevel,
          website: place.website ? undefined : row.website,
          phone: place.phone ? undefined : row.phone,
          address: place.address ? undefined : row.address,
        };
        await ctx.db.patch(place._id, Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)));
        out.push({ googleId: row.googleId, placeId: place._id, outcome: "matched" as const, needsPhoto: !place.imageUrl && !place.permanentlyClosed });
        continue;
      }
      if (row.closed || (row.ratingCount ?? 0) < MIN_RATINGS_TO_INSERT) {
        out.push({ googleId: row.googleId, outcome: "skipped" as const, needsPhoto: false });
        continue;
      }
      const placeId = await ctx.db.insert("places", {
        name: row.name, category: row.category, subcategory: row.subcategory, lat: row.lat, lng: row.lng, address: row.address,
        hours: row.hours, tags: row.tags, source: "google", sourceId: row.googleId, priceLevel: row.priceLevel, city: row.city,
        website: row.website, phone: row.phone, externalRating: row.rating, externalRatingCount: row.ratingCount, googlePlaceId: row.googleId,
        venueVector: featurize({ category: row.category, subcategory: row.subcategory, tags: row.tags, title: row.name, price: row.priceLevel }),
        elo: 0, nComparisons: 0,
      });
      out.push({ googleId: row.googleId, placeId, outcome: "inserted" as const, needsPhoto: true });
    }
    return out;
  },
});

type AreaRun = {
  tasks: number;          // cell and group pairs in the whole plan
  nextOffset: number;     // pass as `offset` to carry on; equal to `tasks` when the plan is done
  searches: number;
  results: number;
  inserted: number;
  matched: number;
  known: number;
  closed: number;
  photos: number;         // pictures stored
  spend?: { lookups: number; searches: number; photos: number; usd: number; maxUsd: number };
  stopped?: string;
  error?: string;
};

/**
 * Import the places Google knows in a circle: `npx convex run imports/googleArea:importArea '{"lat": 37.7608, "lng": -122.3861, "radiusMeters": 2500}'`.
 * `groups` picks the types ("nightlife", "food", "sights"; all by default, in that order per cell),
 * `innerMeters` leaves out the middle (a ring around an area already done), `cellMeters` sets how
 * fine the grid is, and each call does `limit` searches starting at `offset`: run it again with the
 * `nextOffset` it returns until that equals `tasks`. Stops for good at the caps and the dollar ceiling.
 */
export const importArea = internalAction({
  args: {
    lat: v.optional(v.number()), lng: v.optional(v.number()), radiusMeters: v.number(), innerMeters: v.optional(v.number()),
    cellMeters: v.optional(v.number()), groups: v.optional(v.array(groupValidator)), offset: v.optional(v.number()), limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<AreaRun | { skipped: string }> => {
    const key = process.env.GOOGLE_MAPS_KEY;
    if (!key) return { skipped: "no GOOGLE_MAPS_KEY" };
    if (await ctx.runQuery(internal.ingest.isIngestFrozen, {})) return { skipped: "ingest frozen" };
    const lat = args.lat ?? DEMO_LAT;
    const lng = args.lng ?? DEMO_LNG;
    const radiusMeters = Math.min(MAX_RADIUS_METERS, Math.max(MIN_CELL_METERS, args.radiusMeters));
    const cellMeters = Math.min(MAX_CELL_METERS, Math.max(MIN_CELL_METERS, args.cellMeters ?? DEFAULT_CELL_METERS));
    const groups = [...new Set(args.groups ?? (Object.keys(TYPE_GROUPS) as TypeGroup[]))];
    const positions = await ctx.runQuery(internal.imports.googleArea.placePositions, {});
    const cells = areaCells(lat, lng, radiusMeters, cellMeters, args.innerMeters ?? 0).filter((cell) =>
      positions.some(([pLat, pLng]) => haversineMeters(cell, { lat: pLat, lng: pLng }) <= cellMeters + EMPTY_CELL_MARGIN_METERS),
    );
    const tasks = cells.flatMap((cell) => groups.map((group) => ({ cell, group })));
    const offset = Math.max(0, Math.round(args.offset ?? 0));
    const batch = tasks.slice(offset, offset + Math.min(MAX_TASKS, Math.max(1, Math.round(args.limit ?? DEFAULT_TASKS))));
    const run: AreaRun = { tasks: tasks.length, nextOffset: offset, searches: 0, results: 0, inserted: 0, matched: 0, known: 0, closed: 0, photos: 0 };
    const headers = { "X-Goog-Api-Key": key };
    // Writes take turns (they share the budget row); the requests to Google overlap.
    let turn: Promise<unknown> = Promise.resolve();
    const inTurn = <T>(write: () => Promise<T>): Promise<T> => {
      const result = turn.then(write, write);
      turn = result.catch(() => undefined);
      return result;
    };
    const reserve = async (kind: "search" | "photo", count: number) =>
      (await inTurn(() => ctx.runMutation(internal.imports.google.reserveGoogleCalls, { kind, count }))).granted;

    /** One search and the photos of what it found. False once nothing more should be asked in this run. */
    const handle = async ({ cell, group }: (typeof tasks)[number]): Promise<boolean> => {
      if ((await reserve("search", 1)) === 0) {
        run.stopped = "search budget spent";
        return false;
      }
      const answer = await askGoogle(NEARBY_ENDPOINT, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", "X-Goog-FieldMask": AREA_FIELD_MASK },
        body: JSON.stringify(nearbyBody(cell, cellMeters, group)),
      });
      if (typeof answer === "string") {
        run.error = `${answer} (${group})`;
        return false;
      }
      let results: GooglePlace[];
      try {
        results = ((await answer.json()) as { places?: GooglePlace[] }).places ?? [];
      } catch {
        run.error = "Google Places sent something unreadable";
        return false;
      }
      run.searches++;
      run.results += results.length;
      const byId = new Map(results.map((result) => [result.id, result]));
      const rows = results.map(areaRow).filter((row): row is AreaRow => row !== null);
      if (rows.length === 0) return true;
      const saved = await inTurn(() => ctx.runMutation(internal.imports.googleArea.saveAreaResults, { rows }));
      for (const { outcome } of saved) if (outcome !== "skipped") run[outcome]++;
      const wanted = saved.flatMap(({ googleId, placeId, needsPhoto }) => {
        const photo = needsPhoto && placeId ? bestPhoto(byId.get(googleId)?.photos) : null;
        return photo && placeId ? [{ placeId, photo }] : [];
      });
      if (wanted.length === 0) return true;
      const granted = await reserve("photo", wanted.length);
      await Promise.all(wanted.slice(0, granted).map(async ({ placeId, photo }) => {
        const picture = await askGoogle(photoMediaUrl(photo.name!), { headers });
        if (typeof picture === "string") return;
        const blob = await picture.blob();
        if (!blob.type.startsWith("image/") || blob.size === 0 || blob.size > MAX_PHOTO_BYTES) return;
        const storageId = await ctx.storage.store(blob);
        try {
          const url = await ctx.storage.getUrl(storageId);
          if (!url) throw new Error("the stored picture has no URL");
          const result = await inTurn(() => ctx.runMutation(internal.imports.google.savePhotoResult, {
            placeId, searched: false, settled: false, photo: { storageId, url, attribution: photoAttribution(photo) },
          }));
          if (result.stored) run.photos++;
        } catch (error) {
          // The picture belongs to no place: do not leave it behind in file storage.
          await ctx.storage.delete(storageId);
          throw error;
        }
      }));
      if (granted < wanted.length) {
        run.stopped = "photo budget spent";
        return false;
      }
      return true;
    };

    // Tasks are taken in order, a few at a time; `nextOffset` only passes tasks that were finished.
    let next = 0;
    let halted = false;
    const finished = new Set<number>();
    const work = async () => {
      while (!halted && next < batch.length) {
        const index = next++;
        try {
          if (await handle(batch[index])) finished.add(index);
          else halted = true;
        } catch (error) {
          run.error = "a task failed: " + (error instanceof Error ? error.message : String(error)).slice(0, 200);
          halted = true;
        }
      }
    };
    await Promise.all(Array.from({ length: AREA_WORKERS }, work));
    let done = 0;
    while (finished.has(done)) done++;
    run.nextOffset = offset + done;
    const spend = await ctx.runQuery(internal.imports.google.googleSpend, {});
    run.spend = { lookups: spend.lookups, searches: spend.searches, photos: spend.photos, usd: spend.usd, maxUsd: spend.maxUsd };
    return run;
  },
});
