import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { haversineMeters, normalizeName, readConfig, writeConfig } from "../ingest";
import { sameName } from "../lib/performers";

// Optional enrichment with the Google Places API (New), Text Search. Needs GOOGLE_MAPS_KEY; without
// it the run reports that and does nothing. Each run looks up at most 40 catalog places that
// people have ranked (or that were hand-seeded) and that still lack hours, and fills in only what
// is missing. A row is never replaced, a hand-set value is never overwritten, and Brain's fields
// (elo, nComparisons, learnedVector) are never touched. Photos are not fetched: a Places photo
// URL carries the API key, so it cannot be stored.

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.businessStatus",
  "places.regularOpeningHours.periods",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.websiteUri",
  "places.nationalPhoneNumber",
].join(",");
const MAX_PLACES_PER_RUN = 40;
const MATCH_METERS = 75;
const BIAS_RADIUS_METERS = 200;
const RESULTS_PER_SEARCH = 5;
const REQUEST_GAP_MS = 1100;
const REQUEST_TIMEOUT_MS = 15000;
const CHECKED_KEY = "googleChecked";
const RECHECK_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CHECKED = 3000;
const RECENT_RANKINGS = 400;
const SEED_SCAN = 100;
const MIN_CONTAINED_NAME = 8;

type Time = { day?: number; hour?: number; minute?: number };
export type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  businessStatus?: string;
  regularOpeningHours?: { periods?: { open?: Time; close?: Time }[] };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
};

const DAY_CODES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const clock = (time: Time) => `${String(time.hour ?? 0).padStart(2, "0")}:${String(time.minute ?? 0).padStart(2, "0")}`;

/**
 * Google's opening periods as an OpenStreetMap opening_hours string ("Mo-Th 16:00-00:00; Fr,Sa
 * 16:00-02:00; Su off"), the form `convex/lib/hours.ts` reads. Undefined when there are no periods.
 */
export function periodsToHours(periods: { open?: Time; close?: Time }[] | undefined): string | undefined {
  if (!periods?.length) return undefined;
  if (periods.length === 1 && !periods[0].close && (periods[0].open?.hour ?? 0) === 0) return "24/7";
  const spans: string[][] = [[], [], [], [], [], [], []];
  for (const { open, close } of periods) {
    const day = open?.day;
    if (day === undefined || day < 0 || day > 6 || !close) continue;
    spans[day].push(`${clock(open!)}-${clock(close)}`);
  }
  if (spans.every((day) => day.length === 0)) return undefined;
  // Days with the same hours share a rule; a run of neighbours is written "Mo-Th".
  const rules: { days: number[]; text: string }[] = [];
  for (const day of WEEK_ORDER) {
    const text = spans[day].sort().join(",") || "off";
    const rule = rules.find((r) => r.text === text);
    if (rule) rule.days.push(day);
    else rules.push({ days: [day], text });
  }
  return rules
    .map(({ days, text }) => {
      const positions = days.map((day) => WEEK_ORDER.indexOf(day));
      const consecutive = positions.every((p, i) => i === 0 || p === positions[i - 1] + 1);
      const label =
        consecutive && days.length > 2
          ? `${DAY_CODES[days[0]]}-${DAY_CODES[days[days.length - 1]]}`
          : days.map((day) => DAY_CODES[day]).join(",");
      return `${label} ${text}`;
    })
    .join("; ");
}

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/** True when two venue names are the same place: equal after normalising, a typo apart, or one inside the other. */
export function similarNames(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return false;
  if (x === y || sameName(x, y)) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  // One short common word ("Mission", from "Mission Bar") inside a longer name proves nothing.
  const distinctive = short.includes(" ") || short.length >= MIN_CONTAINED_NAME;
  return distinctive && (long.startsWith(short + " ") || long.endsWith(" " + short) || long.includes(" " + short + " "));
}

/** The search result that is this catalog place: within 75 m, a similar name, still in business. Nearest first. */
export function googleMatch(place: { name: string; lat: number; lng: number }, results: GooglePlace[] | undefined): GooglePlace | null {
  let best: { result: GooglePlace; meters: number } | null = null;
  for (const result of results ?? []) {
    const lat = result.location?.latitude;
    const lng = result.location?.longitude;
    if (!result.id || typeof lat !== "number" || typeof lng !== "number") continue;
    if (result.businessStatus === "CLOSED_PERMANENTLY") continue;
    const meters = haversineMeters(place, { lat, lng });
    if (meters > MATCH_METERS || !similarNames(place.name, result.displayName?.text ?? "")) continue;
    if (!best || meters < best.meters) best = { result, meters };
  }
  return best?.result ?? null;
}

type Enrichable = Pick<Doc<"places">, "hours" | "priceLevel" | "website" | "phone">;

/**
 * What to patch on a catalog place from its Google match. The rating, rating count and Google id
 * are Google's own and always refreshed; hours, price level, website and phone only fill a gap.
 */
export function googleToPatch(existing: Enrichable, match: GooglePlace) {
  const patch: {
    googlePlaceId?: string;
    externalRating?: number;
    externalRatingCount?: number;
    hours?: string;
    priceLevel?: number;
    website?: string;
    phone?: string;
  } = { googlePlaceId: match.id };
  if (typeof match.rating === "number" && match.rating >= 1 && match.rating <= 5) patch.externalRating = match.rating;
  if (typeof match.userRatingCount === "number" && match.userRatingCount >= 0) patch.externalRatingCount = match.userRatingCount;
  const hours = periodsToHours(match.regularOpeningHours?.periods);
  if (!existing.hours && hours) patch.hours = hours;
  const priceLevel = PRICE_LEVELS[match.priceLevel ?? ""];
  if (existing.priceLevel === undefined && priceLevel) patch.priceLevel = priceLevel;
  if (!existing.website && match.websiteUri?.startsWith("http")) patch.website = match.websiteUri;
  if (!existing.phone && match.nationalPhoneNumber) patch.phone = match.nationalPhoneNumber;
  return patch;
}

type Candidate = { placeId: Id<"places">; name: string; lat: number; lng: number; city?: string } & Enrichable;

/**
 * Up to `limit` places worth enriching: ones people ranked recently, then hand-seeded ones, that
 * lack hours, have no Google id yet and were not looked up in the last 30 days.
 */
export const enrichmentCandidates = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<Candidate[]> => {
    const max = Math.min(MAX_PLACES_PER_RUN, Math.max(1, limit ?? MAX_PLACES_PER_RUN));
    const checked: Record<string, number> = (await readConfig(ctx, CHECKED_KEY))?.value ?? {};
    const now = Date.now();
    const picked = new Map<Id<"places">, Candidate>();
    const consider = (place: Doc<"places"> | null) => {
      if (!place || picked.size >= max || picked.has(place._id)) return;
      if (place.hours || place.googlePlaceId) return;
      if (now - (checked[place._id] ?? 0) < RECHECK_MS) return;
      picked.set(place._id, {
        placeId: place._id, name: place.name, lat: place.lat, lng: place.lng, city: place.city,
        hours: place.hours, priceLevel: place.priceLevel, website: place.website, phone: place.phone,
      });
    };
    const rankings = await ctx.db.query("rankings").order("desc").take(RECENT_RANKINGS);
    const rankedIds = [...new Set(rankings.map((r) => r.placeId).filter((id): id is Id<"places"> => id !== undefined))];
    for (const placeId of rankedIds) {
      if (picked.size >= max) break;
      consider(await ctx.db.get(placeId));
    }
    if (picked.size < max) {
      const seeded = await ctx.db
        .query("places")
        .withIndex("by_source", (q) => q.eq("source", "seed"))
        .take(SEED_SCAN);
      for (const place of seeded) consider(place);
    }
    return [...picked.values()];
  },
});

const patchValidator = v.object({
  placeId: v.id("places"),
  googlePlaceId: v.optional(v.string()),
  externalRating: v.optional(v.number()),
  externalRatingCount: v.optional(v.number()),
  hours: v.optional(v.string()),
  priceLevel: v.optional(v.number()),
  website: v.optional(v.string()),
  phone: v.optional(v.string()),
});

/** Write the enrichment and remember which places were looked up. Gap-filling is checked again against the row as it is now. */
export const applyEnrichment = internalMutation({
  args: { patches: v.array(patchValidator), checked: v.array(v.id("places")) },
  handler: async (ctx, { patches, checked }): Promise<{ patched: number }> => {
    let patched = 0;
    for (const { placeId, ...found } of patches) {
      const place = await ctx.db.get(placeId);
      if (!place) continue;
      const patch = {
        googlePlaceId: found.googlePlaceId,
        externalRating: found.externalRating,
        externalRatingCount: found.externalRatingCount,
        hours: place.hours ? undefined : found.hours,
        priceLevel: place.priceLevel !== undefined ? undefined : found.priceLevel,
        website: place.website ? undefined : found.website,
        phone: place.phone ? undefined : found.phone,
      };
      const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
      if (Object.keys(defined).length === 0) continue;
      await ctx.db.patch(placeId, defined);
      patched++;
    }
    const log: Record<string, number> = (await readConfig(ctx, CHECKED_KEY))?.value ?? {};
    const now = Date.now();
    for (const placeId of checked) log[placeId] = now;
    const entries = Object.entries(log).sort((a, b) => a[1] - b[1]).slice(-MAX_CHECKED);
    await writeConfig(ctx, CHECKED_KEY, Object.fromEntries(entries));
    return { patched };
  },
});

/** The Text Search request body for one catalog place. */
export const searchBody = (place: { name: string; lat: number; lng: number; city?: string }) => ({
  textQuery: place.city ? `${place.name}, ${place.city}` : place.name,
  pageSize: RESULTS_PER_SEARCH,
  locationBias: { circle: { center: { latitude: place.lat, longitude: place.lng }, radius: BIAS_RADIUS_METERS } },
});

type EnrichResult = { looked: number; matched: number; patched: number; noMatch: number; error?: string };

/**
 * Enrich up to 40 catalog places with Google Places details: `npx convex run imports/google:enrichPlaces`.
 * Does nothing when GOOGLE_MAPS_KEY is not set or while the ingest is frozen.
 */
export const enrichPlaces = internalAction({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<EnrichResult | { skipped: string }> => {
    const key = process.env.GOOGLE_MAPS_KEY;
    if (!key) return { skipped: "no GOOGLE_MAPS_KEY" };
    if (await ctx.runQuery(internal.ingest.isIngestFrozen, {})) return { skipped: "ingest frozen" };
    const places = await ctx.runQuery(internal.imports.google.enrichmentCandidates, { limit });
    const result: EnrichResult = { looked: 0, matched: 0, patched: 0, noMatch: 0 };
    const patches: (ReturnType<typeof googleToPatch> & { placeId: Id<"places"> })[] = [];
    const checked: Id<"places">[] = [];
    for (const place of places) {
      if (result.looked > 0) await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS));
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
      let body: { places?: GooglePlace[] };
      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          signal: abort.signal,
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK },
          body: JSON.stringify(searchBody(place)),
        });
        if (!response.ok) {
          // A refused key or a spent quota will not get better within this run.
          result.error = "Google Places answered " + response.status;
          break;
        }
        body = await response.json();
      } catch {
        result.error = "Google Places did not answer";
        break;
      } finally {
        clearTimeout(timer);
      }
      result.looked++;
      checked.push(place.placeId);
      const match = googleMatch(place, body.places);
      if (!match) {
        result.noMatch++;
        continue;
      }
      result.matched++;
      patches.push({ placeId: place.placeId, ...googleToPatch(place, match) });
    }
    if (checked.length) {
      result.patched = (await ctx.runMutation(internal.imports.google.applyEnrichment, { patches, checked })).patched;
    }
    return result;
  },
});
