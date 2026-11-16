import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { haversineMeters, normalizeName, readConfig, writeConfig } from "../ingest";
import { sameName } from "../lib/performers";

// Optional enrichment with the Google Places API (New), Text Search. Needs GOOGLE_MAPS_KEY; without
// it the run reports that and does nothing. Each run looks up at most 40 catalog places that
// people have ranked (or that were hand-seeded) and that still lack hours, and fills in only what
// is missing. A row is never replaced, a hand-set value is never overwritten, and Brain's fields
// (elo, nComparisons, learnedVector) are never touched.
//
// Photos (second half of this file) are a separate, hand-run action, `enrichPhotos`. A Places photo
// URL carries the API key, so the picture itself is copied into Convex file storage and the place
// gets the storage URL. Photo work is capped for good by MAX_PHOTO_LOOKUPS and MAX_PHOTO_FETCHES,
// counted in appConfig: raising a cap is a code change.

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
const MATCH_METERS = 120;
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
  photos?: GooglePhoto[];
};
export type GooglePhoto = { name?: string; widthPx?: number; heightPx?: number; authorAttributions?: { displayName?: string }[] };

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

const FILLER_WORDS = new Set(["at", "the", "and", "of", "in", "on"]);
const wordsOf = (name: string) => name.split(" ").filter((word) => word && !FILLER_WORDS.has(word)).sort().join(" ");

/** True when two venue names are the same place: equal after normalising, a typo apart, the same words in another order, or one inside the other. */
export function similarNames(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return false;
  if (x === y || sameName(x, y)) return true;
  // "Building 12 at Pier 70" is Google's "Pier 70 Building 12". One word alone proves nothing.
  const words = wordsOf(x);
  if (words.includes(" ") && words === wordsOf(y)) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  // One short common word ("Mission", from "Mission Bar") inside a longer name proves nothing.
  const distinctive = short.includes(" ") || short.length >= MIN_CONTAINED_NAME;
  return distinctive && (long.startsWith(short + " ") || long.endsWith(" " + short) || long.includes(" " + short + " "));
}

/**
 * Words that say what kind of place it is or where it is. Sharing one proves nothing: "Mission Bar"
 * is not "Mission Chinese Food", and "Bar" is not "Bar Agricole".
 */
const COMMON_WORDS = new Set([
  "bar", "bars", "cafe", "caffe", "coffee", "restaurant", "kitchen", "grill", "pub", "club", "lounge", "tavern", "saloon", "house",
  "park", "playground", "plaza", "square", "garden", "gardens", "pizza", "pizzeria", "taqueria", "sushi", "thai", "deli", "bakery",
  "brewery", "brewing", "wine", "market", "shop", "store", "hotel", "gallery", "museum", "theater", "theatre", "studio", "center",
  "san", "francisco", "sf", "bay", "city", "mission", "dogpatch", "potrero", "soma", "castro", "marina", "haight", "sunset",
  "richmond", "valencia", "street", "st", "ave", "avenue", "pier", "north", "south", "east", "west", "new", "old", "little", "big",
  "golden", "gate", "el", "la", "le", "los", "las", "de", "del", "a", "and", "saint", "creek", "hill", "point", "beach", "room", "hall",
  "blue", "red", "green", "black", "white", "lucky", "happy", "royal", "pacific", "california", "union", "first", "second", "third",
  "american", "chinese", "china", "japanese", "mexican", "italian", "indian", "vietnamese", "korean", "french", "cuisine", "food",
  "noodle", "ramen", "burger", "burgers", "taco", "tacos", "tea", "juice", "bbq", "express",
]);
/** Within this distance any shared telling word is enough: "Twenty Five Lusk" is Google's "25 Lusk" 16 m away. */
const SHARED_WORD_METERS = 75;
const MIN_SHARED_WORD = 4;
const nameKey = (name: string) => normalizeName(name).replace(/( and)+$/, "");
const isSignificant = (word: string) => !!word && !FILLER_WORDS.has(word) && !COMMON_WORDS.has(word);
const firstSignificant = (key: string) => key.split(" ").find(isSignificant);

/**
 * How sure the names are of being one place. 2: equal, a typo apart, the same words reordered, or one
 * name inside the other ("Niku" in "Niku Steakhouse"). 1: they start with the same telling word
 * ("Jackson Park" and "Jackson Playground Park"). 0: different names. Distance is checked by the caller.
 */
export function nameStrength(a: string, b: string): 0 | 1 | 2 {
  const x = nameKey(a);
  const y = nameKey(b);
  if (!x || !y) return 0;
  if (x === y || similarNames(a, b)) return 2;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  const inside = long.startsWith(short + " ") || long.endsWith(" " + short) || long.includes(" " + short + " ");
  if (inside && short.split(" ").some(isSignificant)) return 2;
  const first = firstSignificant(x);
  return first !== undefined && first === firstSignificant(y) && first.length >= MIN_SHARED_WORD && !/^\d/.test(first) ? 1 : 0;
}

const tellingWords = (key: string) => key.split(" ").filter((word) => isSignificant(word) && word.length >= MIN_SHARED_WORD && !/^\d/.test(word));

/** True when the names have a telling word in common, wherever it stands: "Rolph Playground" and "James Rolph Jr. Playground". */
export function sharesWord(a: string, b: string): boolean {
  const words = new Set(tellingWords(nameKey(a)));
  return tellingWords(nameKey(b)).some((word) => words.has(word));
}

/**
 * What a search says about a catalog place. `match` is the result that is this place: within 120 m
 * with a matching name (or within 75 m with any telling word in common), still in business, the
 * surest name first and then the nearest. `closed` is
 * true instead when the result that is surely this place (strength 2) is closed for good and nothing
 * open matches as surely.
 */
export function googleVerdict(
  place: { name: string; lat: number; lng: number }, results: GooglePlace[] | undefined,
): { match: GooglePlace | null; closed: boolean } {
  let best: { result: GooglePlace; meters: number; strength: number } | null = null;
  let closed = false;
  for (const result of results ?? []) {
    const lat = result.location?.latitude;
    const lng = result.location?.longitude;
    if (!result.id || typeof lat !== "number" || typeof lng !== "number") continue;
    const meters = haversineMeters(place, { lat, lng });
    if (meters > MATCH_METERS) continue;
    const text = result.displayName?.text ?? "";
    const strength = nameStrength(place.name, text) || (meters <= SHARED_WORD_METERS && sharesWord(place.name, text) ? 1 : 0);
    if (strength === 0) continue;
    if (result.businessStatus === "CLOSED_PERMANENTLY") {
      if (strength === 2) closed = true;
      continue;
    }
    if (!best || strength > best.strength || (strength === best.strength && meters < best.meters)) best = { result, meters, strength };
  }
  if (closed && (best === null || best.strength < 2)) return { match: null, closed: true };
  return { match: best?.result ?? null, closed: false };
}

/** The search result that is this catalog place (see googleVerdict), or null. */
export const googleMatch = (place: { name: string; lat: number; lng: number }, results: GooglePlace[] | undefined): GooglePlace | null =>
  googleVerdict(place, results).match;

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
    const checked = await readLog<number>(ctx, CHECKED_KEY);
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

type FoundPatch = ReturnType<typeof googleToPatch> & { placeId: Id<"places"> };

/** Gap-filling is checked again against the row as it is now, and the places are logged as looked up. */
async function recordEnrichment(ctx: MutationCtx, patches: FoundPatch[], checked: Id<"places">[]): Promise<number> {
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
  await logChecked(ctx, CHECKED_KEY, checked);
  return patched;
}

/**
 * A per-place log kept in appConfig (when a place was looked up, why it has no photo). It is stored
 * as a list of [placeId, value] pairs: a Convex object holds at most 1024 fields, a list 8192 items.
 * Logs written as an object before that limit was met are still read.
 */
async function readLog<T>(ctx: QueryCtx, key: string): Promise<Record<string, T>> {
  const value = (await readConfig(ctx, key))?.value;
  return Array.isArray(value) ? Object.fromEntries(value as [string, T][]) : { ...(value ?? {}) };
}
const writeLog = <T>(ctx: MutationCtx, key: string, log: Record<string, T>) => writeConfig(ctx, key, Object.entries(log));

async function logChecked(ctx: MutationCtx, key: string, placeIds: Id<"places">[]) {
  if (placeIds.length === 0) return;
  const log = await readLog<number>(ctx, key);
  const now = Date.now();
  for (const placeId of placeIds) log[placeId] = now;
  const entries = Object.entries(log).sort((a, b) => a[1] - b[1]).slice(-MAX_CHECKED);
  await writeLog(ctx, key, Object.fromEntries(entries));
}

/** Write the enrichment and remember which places were looked up. Gap-filling is checked again against the row as it is now. */
export const applyEnrichment = internalMutation({
  args: { patches: v.array(patchValidator), checked: v.array(v.id("places")) },
  handler: async (ctx, { patches, checked }): Promise<{ patched: number }> => ({
    patched: await recordEnrichment(ctx, patches, checked),
  }),
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

// ─────────────────────────────────────────────────────────────────────────────
// Photos. One Google lookup per place (a Text Search when the place has no Google id yet, otherwise
// Place Details by id), then one photo download at 800 px, stored in Convex file storage.
// ─────────────────────────────────────────────────────────────────────────────

const DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places/";
const MEDIA_ENDPOINT = "https://places.googleapis.com/v1/";
const PHOTO_FIELD_MASK = FIELD_MASK + ",places.photos";
const DETAILS_FIELD_MASK = "id,photos,businessStatus";
const PHOTO_WIDTH_PX = 800;
/** Hard caps on all photo work this deployment ever does. Counted in appConfig before each request. */
export const MAX_PHOTO_LOOKUPS = 1500;
export const MAX_PHOTO_FETCHES = 1500;
const PHOTO_BUDGET_KEY = "googlePhotoBudget";
// "2": the log of the first, stricter matcher ("googlePhotoChecked") is no longer read, so each of its
// misses is looked up once more under the looser rule and then logged here.
const PHOTO_CHECKED_KEY = "googlePhotoChecked2";
const PHOTO_MISS_KEY = "googlePhotoMissNotes";
const PHOTO_GAP_MS = 100;
const PHOTOS_PER_RUN = 40;
const MAX_PHOTOS_PER_RUN = 240;
const MAX_PHOTO_WORKERS = 8;
const PHOTO_CHOICES = 5;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_ATTRIBUTION_NAMES = 2;
const PHOTO_NAME = /^places\/[^/?#]+\/photos\/[^/?#]+$/;
/** How many ids the lists may put at the head of one plan, and how many rankings are read for it. */
const MAX_PLAN = 800;
const MAX_RANKINGS_READ = 4000;
/** The radii the lists are read at: the default one people see first, then the wider one. */
const PLAN_RADII = [2500, 6000];
const DEMO_LAT = 37.7608;
const DEMO_LNG = -122.3861;
/** Invented demo pop-ups carry this tag (or one of these names): Google has nothing for them, and they are left alone. */
const DEMO_TAG = "demo";
const DEMO_NAMES = ["crane cove sunset dj set", "22nd street natural wine"];
export const isDemoPlace = (place: { name: string; tags?: string[] }) =>
  !!place.tags?.includes(DEMO_TAG) || /demo pop-?up/i.test(place.name) || DEMO_NAMES.includes(place.name.trim().toLowerCase());
/** The lists people open first, and how far down each must be covered before any goes deeper. */
export const PHOTO_LISTS = { all: 60, tonight: 60, bars: 60, food: 60, outdoors: 60, events: 60 } as const;
type PhotoList = keyof typeof PHOTO_LISTS;

/**
 * The photo to show for a place: Google lists them best first, so the first of the leading few that
 * is landscape and at least 800 px wide, or failing that simply the first.
 */
export function bestPhoto(photos: GooglePhoto[] | undefined): GooglePhoto | null {
  const usable = (photos ?? []).filter((photo) => PHOTO_NAME.test(photo.name ?? "")).slice(0, PHOTO_CHOICES);
  const wide = usable.find((photo) => (photo.widthPx ?? 0) >= PHOTO_WIDTH_PX && (photo.widthPx ?? 0) >= (photo.heightPx ?? 0));
  return wide ?? usable[0] ?? null;
}

/** The credit Google requires next to a photo: "Photo: Ana Lopez". Undefined when Google names nobody. */
export function photoAttribution(photo: GooglePhoto): string | undefined {
  const names = (photo.authorAttributions ?? [])
    .map((author) => author.displayName?.trim())
    .filter((name): name is string => !!name)
    .slice(0, MAX_ATTRIBUTION_NAMES);
  return names.length ? "Photo: " + names.join(", ") : undefined;
}

/** Where the picture itself is downloaded from. The key travels in a header, never in this URL. */
export const photoMediaUrl = (photoName: string) => `${MEDIA_ENDPOINT}${photoName}/media?maxWidthPx=${PHOTO_WIDTH_PX}`;

/**
 * One order for the places in several ranked lists, best first: a place's turn comes at its position
 * divided by its list's weight, so the top 60 of "all" are done by the time the top 40 of "bars" are.
 * `lists[name]` holds a list's ids by position, with null where the position is not a place.
 */
export function photoOrder(lists: Partial<Record<PhotoList, (string | null)[]>>): string[] {
  const turns = new Map<string, number>();
  for (const [name, ids] of Object.entries(lists) as [PhotoList, (string | null)[]][]) {
    ids.forEach((id, index) => {
      if (id === null) return;
      const turn = (index + 1) / PHOTO_LISTS[name];
      if (turn < (turns.get(id) ?? Infinity)) turns.set(id, turn);
    });
  }
  return [...turns.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
}

type PhotoCandidate = Candidate & { googlePlaceId?: string };
type PhotoBudget = { lookups: number; photos: number };
const emptyBudget = (): PhotoBudget => ({ lookups: 0, photos: 0 });

type PhotoTiers = { lists: number; ranked: number; seeded: number; rest: number };

/**
 * The next places to get a photo, in order: `ids` as given (what the lists show), then every place
 * someone has ranked (most rankings first), then the hand-seeded ones, then the whole catalog outward
 * from the centre. Left out are places that have an image, were already checked for a photo, are
 * closed for good, or are demo pop-ups. `waiting` counts everything still to do, `tiers` by group.
 */
export const photoCandidates = internalQuery({
  args: { ids: v.array(v.id("places")), limit: v.number(), lat: v.optional(v.number()), lng: v.optional(v.number()) },
  handler: async (ctx, { ids, limit, lat, lng }): Promise<{ places: PhotoCandidate[]; waiting: number; tiers: PhotoTiers }> => {
    const photoChecked = await readLog<number>(ctx, PHOTO_CHECKED_KEY);
    const all = await ctx.db.query("places").collect();
    const byId = new Map(all.map((place) => [place._id, place]));
    const picked = new Map<Id<"places">, PhotoCandidate>();
    const consider = (place: Doc<"places"> | undefined) => {
      if (!place || picked.has(place._id) || place.imageUrl || place.permanentlyClosed || photoChecked[place._id] !== undefined) return;
      if (isDemoPlace(place)) return;
      picked.set(place._id, {
        placeId: place._id, name: place.name, lat: place.lat, lng: place.lng, city: place.city,
        hours: place.hours, priceLevel: place.priceLevel, website: place.website, phone: place.phone,
        googlePlaceId: place.googlePlaceId,
      });
    };
    const tiers: PhotoTiers = { lists: 0, ranked: 0, seeded: 0, rest: 0 };
    const tier = (name: keyof PhotoTiers, places: (Doc<"places"> | undefined)[]) => {
      const before = picked.size;
      for (const place of places) consider(place);
      tiers[name] = picked.size - before;
    };
    tier("lists", ids.slice(0, MAX_PLAN).map((id) => byId.get(id)));
    const rankings = await ctx.db.query("rankings").order("desc").take(MAX_RANKINGS_READ);
    const rankCounts = new Map<Id<"places">, number>();
    for (const { placeId } of rankings) if (placeId !== undefined) rankCounts.set(placeId, (rankCounts.get(placeId) ?? 0) + 1);
    tier("ranked", [...rankCounts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => byId.get(id)));
    tier("seeded", all.filter((place) => place.source === "seed"));
    const centre = { lat: lat ?? DEMO_LAT, lng: lng ?? DEMO_LNG };
    tier("rest", all.map((place) => ({ place, meters: haversineMeters(centre, place) })).sort((a, b) => a.meters - b.meters).map(({ place }) => place));
    return { places: [...picked.values()].slice(0, Math.max(0, limit)), waiting: picked.size, tiers };
  },
});

/** Photo requests made so far against the caps. `npx convex run imports/google:photoBudget`. */
export const photoBudget = internalQuery({
  args: {},
  handler: async (ctx): Promise<PhotoBudget & { maxLookups: number; maxPhotos: number }> => {
    const used: PhotoBudget = (await readConfig(ctx, PHOTO_BUDGET_KEY))?.value ?? emptyBudget();
    return { ...used, maxLookups: MAX_PHOTO_LOOKUPS, maxPhotos: MAX_PHOTO_FETCHES };
  },
});

/** Count one request before it is made. `ok` is false, and nothing is counted, once the cap is reached. */
export const reservePhotoCall = internalMutation({
  args: { kind: v.union(v.literal("lookup"), v.literal("photo")) },
  handler: async (ctx, { kind }): Promise<{ ok: boolean }> => {
    const used: PhotoBudget = { ...emptyBudget(), ...((await readConfig(ctx, PHOTO_BUDGET_KEY))?.value ?? {}) };
    const [field, max] = kind === "lookup" ? (["lookups", MAX_PHOTO_LOOKUPS] as const) : (["photos", MAX_PHOTO_FETCHES] as const);
    if (used[field] >= max) return { ok: false };
    await writeConfig(ctx, PHOTO_BUDGET_KEY, { ...used, [field]: used[field] + 1 });
    return { ok: true };
  },
});

const { placeId: _placeId, ...foundFields } = patchValidator.fields;

/**
 * Store what one place's lookup found. The photo is kept only when the place still has no image (a
 * hand-set image is never replaced: the downloaded file is deleted instead). `settled` logs the place
 * as checked for a photo, so it is not looked up again.
 */
export const savePhotoResult = internalMutation({
  args: {
    placeId: v.id("places"),
    searched: v.boolean(),
    settled: v.boolean(),
    found: v.optional(v.object(foundFields)),
    photo: v.optional(v.object({ storageId: v.id("_storage"), url: v.string(), attribution: v.optional(v.string()) })),
    /** Google says the place is closed for good: it is flagged (never deleted) and discovery hides it. */
    closed: v.optional(v.boolean()),
    /** Why there is no photo, kept for `photoMisses`. */
    miss: v.optional(v.string()),
  },
  handler: async (ctx, { placeId, searched, settled, found, photo, closed, miss }): Promise<{ patched: boolean; stored: boolean }> => {
    const patched = (await recordEnrichment(ctx, found ? [{ placeId, ...found }] : [], searched ? [placeId] : [])) > 0;
    if (closed && (await ctx.db.get(placeId))) await ctx.db.patch(placeId, { permanentlyClosed: true });
    if (miss !== undefined) {
      const notes = await readLog<string>(ctx, PHOTO_MISS_KEY);
      await writeLog(ctx, PHOTO_MISS_KEY, { ...notes, [placeId]: miss });
    }
    let stored = false;
    if (photo) {
      const place = await ctx.db.get(placeId);
      if (place && !place.imageUrl) {
        await ctx.db.patch(placeId, { imageUrl: photo.url, imageStorageId: photo.storageId, imageAttribution: photo.attribution });
        stored = true;
      } else {
        await ctx.storage.delete(photo.storageId);
      }
    }
    if (settled) await logChecked(ctx, PHOTO_CHECKED_KEY, [placeId]);
    return { patched, stored };
  },
});

type PhotoRun = {
  planned: number;        // places in this run
  waiting: number;        // places in the whole plan still without a photo when the run started
  searches: number;       // Text Search requests
  details: number;        // Place Details requests (places that already had a Google id)
  photoFetches: number;   // photo downloads
  stored: number;         // places that now have a photo
  noMatch: number;
  noPhoto: number;
  closed: number;         // places Google says are closed for good, now hidden
  tiers?: PhotoTiers;     // what is still waiting, by group
  /** Places Google has no match or no photo for, with the nearest thing the search did return. */
  misses: string[];
  budget: PhotoBudget & { maxLookups: number; maxPhotos: number };
  stopped?: string;
  error?: string;
};

/** Why a search matched nothing, in a few words: what the closest result was. */
function nearestResult(place: { lat: number; lng: number }, results: GooglePlace[] | undefined): string {
  const near = (results ?? [])
    .flatMap((result) => {
      const lat = result.location?.latitude;
      const lng = result.location?.longitude;
      return typeof lat === "number" && typeof lng === "number" ? [{ result, meters: haversineMeters(place, { lat, lng }) }] : [];
    })
    .sort((a, b) => a.meters - b.meters)[0];
  if (!near) return "no results";
  const closed = near.result.businessStatus === "CLOSED_PERMANENTLY" ? ", closed for good" : "";
  return `nearest is "${near.result.displayName?.text ?? "?"}" at ${Math.round(near.meters)} m${closed}`;
}

/**
 * Places that were checked for a photo and have none, each with why:
 * `npx convex run imports/google:photoMisses`. `closed` are the ones Google says are closed for good.
 */
export const photoMisses = internalQuery({
  args: {},
  handler: async (ctx): Promise<{ checked: number; withPhoto: number; noMatch: string[]; noPhoto: string[]; closed: string[] }> => {
    const log = await readLog<number>(ctx, PHOTO_CHECKED_KEY);
    const notes = await readLog<string>(ctx, PHOTO_MISS_KEY);
    const out = { checked: 0, withPhoto: 0, noMatch: [] as string[], noPhoto: [] as string[], closed: [] as string[] };
    const byId = new Map<string, Doc<"places">>((await ctx.db.query("places").collect()).map((place) => [place._id, place]));
    for (const id of Object.keys(log)) {
      const place = byId.get(id);
      if (!place) continue;
      out.checked++;
      if (place.permanentlyClosed) out.closed.push(place.name);
      else if (place.imageStorageId) out.withPhoto++;
      else if (!place.imageUrl) (place.googlePlaceId ? out.noPhoto : out.noMatch).push(notes[id] ?? place.name);
    }
    return out;
  },
});

/**
 * Where the photo work stands: `npx convex run imports/google:photoCoverage`. With `ids`, also says
 * for each of those places whether it has an image and, if not, why.
 */
export const photoCoverage = internalQuery({
  args: { ids: v.optional(v.array(v.string())) },
  handler: async (ctx, { ids }) => {
    const log = await readLog<number>(ctx, PHOTO_CHECKED_KEY);
    const notes = await readLog<string>(ctx, PHOTO_MISS_KEY);
    const used: PhotoBudget = { ...emptyBudget(), ...((await readConfig(ctx, PHOTO_BUDGET_KEY))?.value ?? {}) };
    const all = await ctx.db.query("places").collect();
    const closed = all.filter((place) => place.permanentlyClosed);
    const without = (ids ?? []).flatMap((id) => {
      const place = all.find((p) => p._id === id);
      if (!place || place.imageUrl) return [];
      const why = isDemoPlace(place) ? "demo pop-up, left alone"
        : place.permanentlyClosed ? "closed for good"
        : notes[id] ?? (log[id] !== undefined ? "checked, no photo" : "not looked up yet");
      return [`${place.name} [${place.category}]: ${why.startsWith(place.name + ": ") ? why.slice(place.name.length + 2) : why}`];
    });
    return {
      places: all.length,
      withImage: all.filter((place) => place.imageUrl).length,
      withGooglePhoto: all.filter((place) => place.imageStorageId).length,
      permanentlyClosed: closed.length,
      closedNames: closed.map((place) => place.name),
      checked: Object.keys(log).length,
      budget: { ...used, maxLookups: MAX_PHOTO_LOOKUPS, maxPhotos: MAX_PHOTO_FETCHES },
      without,
    };
  },
});

/**
 * Let places that got no photo be looked up once more (after a matching fix, say):
 * `npx convex run imports/google:retryPhotoMisses '{"names": ["Thee Parkside"]}'`. Only places without
 * an image are released, and each new lookup still counts against the caps.
 */
export const retryPhotoMisses = internalMutation({
  args: { names: v.array(v.string()) },
  handler: async (ctx, { names }): Promise<{ released: string[] }> => {
    const photoLog = await readLog<number>(ctx, PHOTO_CHECKED_KEY);
    const searchLog = await readLog<number>(ctx, CHECKED_KEY);
    const released: string[] = [];
    for (const id of Object.keys(photoLog)) {
      const placeId = ctx.db.normalizeId("places", id);
      const place = placeId === null ? null : await ctx.db.get(placeId);
      if (!place || place.imageUrl || place.permanentlyClosed || !names.includes(place.name)) continue;
      delete photoLog[id];
      delete searchLog[id];
      released.push(place.name);
    }
    await writeLog(ctx, PHOTO_CHECKED_KEY, photoLog);
    await writeLog(ctx, CHECKED_KEY, searchLog);
    return { released };
  },
});

async function askGoogle(url: string, init: RequestInit): Promise<Response | string> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: abort.signal });
    return response.ok ? response : "Google Places answered " + response.status;
  } catch {
    return "Google Places did not answer";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Give the places people see around a point a real photo:
 * `npx convex run imports/google:enrichPhotos '{"limit": 120, "workers": 6}'` (the centre defaults to the
 * demo location). The plan, best first: what `discover.nearby` returns there for "all", "tonight",
 * "bars", "food", "outdoors" and "events" at 2.5 km and then at 6 km, then every ranked place, the
 * hand-seeded ones, and the rest of the catalog outward from the centre. Each run does up to `limit`
 * of them, `workers` at a time, and reports how many are still `waiting`; run it again for the rest
 * (`skipLists` leaves the lists out once they are done). Stops for good at the caps.
 */
export const enrichPhotos = internalAction({
  args: {
    lat: v.optional(v.number()), lng: v.optional(v.number()), limit: v.optional(v.number()),
    workers: v.optional(v.number()), skipLists: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<PhotoRun | { skipped: string }> => {
    const key = process.env.GOOGLE_MAPS_KEY;
    if (!key) return { skipped: "no GOOGLE_MAPS_KEY" };
    if (await ctx.runQuery(internal.ingest.isIngestFrozen, {})) return { skipped: "ingest frozen" };
    const lat = args.lat ?? DEMO_LAT;
    const lng = args.lng ?? DEMO_LNG;
    const limit = Math.min(MAX_PHOTOS_PER_RUN, Math.max(1, args.limit ?? PHOTOS_PER_RUN));
    const workers = Math.min(MAX_PHOTO_WORKERS, Math.max(1, Math.round(args.workers ?? 1)));

    const planned: string[] = [];
    for (const radiusMeters of args.skipLists ? [] : PLAN_RADII) {
      const lists: Partial<Record<PhotoList, (string | null)[]>> = {};
      for (const filter of Object.keys(PHOTO_LISTS) as PhotoList[]) {
        const { items } = await ctx.runQuery(api.discover.nearby, { lat, lng, filter, limit: PHOTO_LISTS[filter], radiusMeters });
        lists[filter] = items.map((item) => (item.kind === "place" ? item.id : null));
      }
      planned.push(...photoOrder(lists));
    }
    const ids = [...new Set(planned)].slice(0, MAX_PLAN) as Id<"places">[];
    const { places, waiting, tiers } = await ctx.runQuery(internal.imports.google.photoCandidates, { ids, limit, lat, lng });

    const run: PhotoRun = {
      planned: places.length, waiting, searches: 0, details: 0, photoFetches: 0, stored: 0, noMatch: 0, noPhoto: 0, closed: 0, tiers, misses: [],
      budget: { lookups: 0, photos: 0, maxLookups: MAX_PHOTO_LOOKUPS, maxPhotos: MAX_PHOTO_FETCHES },
    };
    const headers = { "X-Goog-Api-Key": key };
    const pause = () => new Promise((resolve) => setTimeout(resolve, PHOTO_GAP_MS));
    let requests = 0;
    // The workers share the budget row and the logs, so their writes take turns: side by side they
    // would keep invalidating each other. The requests to Google still overlap.
    let turn: Promise<unknown> = Promise.resolve();
    const inTurn = <T>(write: () => Promise<T>): Promise<T> => {
      const result = turn.then(write, write);
      turn = result.catch(() => undefined);
      return result;
    };
    const reserve = (kind: "lookup" | "photo") => inTurn(() => ctx.runMutation(internal.imports.google.reservePhotoCall, { kind }));
    const save = (result: {
      placeId: Id<"places">; searched: boolean; settled: boolean; found?: ReturnType<typeof googleToPatch>;
      photo?: { storageId: Id<"_storage">; url: string; attribution?: string }; closed?: boolean; miss?: string;
    }) => inTurn(() => ctx.runMutation(internal.imports.google.savePhotoResult, result));

    /** One place, start to finish. False once nothing more should be asked in this run. */
    const handle = async (place: PhotoCandidate): Promise<boolean> => {
      if (!(await reserve("lookup")).ok) {
        run.stopped = "lookup budget spent";
        return false;
      }
      if (requests++ > 0) await pause();
      const searched = !place.googlePlaceId;
      const answer = searched
        ? await askGoogle(ENDPOINT, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json", "X-Goog-FieldMask": PHOTO_FIELD_MASK },
            body: JSON.stringify(searchBody(place)),
          })
        : await askGoogle(DETAILS_ENDPOINT + encodeURIComponent(place.googlePlaceId!), {
            headers: { ...headers, "X-Goog-FieldMask": DETAILS_FIELD_MASK },
          });
      if (typeof answer === "string") {
        // A refused key or a spent quota will not get better within this run.
        run.error = answer;
        return false;
      }
      let match: GooglePlace | null;
      let closed = false;
      let results: GooglePlace[] | undefined;
      try {
        const body = await answer.json();
        if (searched) {
          results = (body as { places?: GooglePlace[] }).places;
          ({ match, closed } = googleVerdict(place, results));
        } else {
          closed = (body as GooglePlace).businessStatus === "CLOSED_PERMANENTLY";
          match = closed ? null : (body as GooglePlace);
        }
      } catch {
        run.error = "Google Places sent something unreadable";
        return false;
      }
      if (searched) run.searches++;
      else run.details++;
      const found = searched && match ? googleToPatch(place, match) : undefined;
      const photo = bestPhoto(match?.photos);
      if (!match || !photo) {
        if (closed) run.closed++;
        else if (!match) run.noMatch++;
        else run.noPhoto++;
        const miss = closed ? `${place.name}: closed for good on Google`
          : match ? `${place.name}: no photo on Google`
          : `${place.name}: ${nearestResult(place, results)}`;
        run.misses.push(miss);
        await save({ placeId: place.placeId, searched, settled: true, found, miss, closed: closed || undefined });
        return true;
      }

      const photoAllowed = (await reserve("photo")).ok;
      let stored: { storageId: Id<"_storage">; url: string } | null = null;
      let failure: string | undefined;
      if (photoAllowed) {
        await pause();
        run.photoFetches++;
        const picture = await askGoogle(photoMediaUrl(photo.name!), { headers });
        if (typeof picture === "string") failure = picture;
        else {
          try {
            const blob = await picture.blob();
            if (!blob.type.startsWith("image/") || blob.size === 0 || blob.size > MAX_PHOTO_BYTES) failure = "Google Places sent no usable picture";
            else {
              const storageId = await ctx.storage.store(blob);
              const url = await ctx.storage.getUrl(storageId);
              if (url) stored = { storageId, url };
              else failure = "the stored picture has no URL";
            }
          } catch {
            failure = "the picture could not be stored";
          }
        }
      }
      // What the search found is kept either way. Without its photo the place stays unsettled, to be tried again.
      let saved: { stored: boolean };
      try {
        saved = await save({
          placeId: place.placeId, searched, settled: stored !== null, found,
          photo: stored ? { ...stored, attribution: photoAttribution(photo) } : undefined,
        });
      } catch (error) {
        // The picture belongs to no place: do not leave it behind in file storage.
        if (stored) await ctx.storage.delete(stored.storageId);
        throw error;
      }
      if (saved.stored) run.stored++;
      if (!photoAllowed) {
        run.stopped = "photo budget spent";
        return false;
      }
      if (failure) {
        run.error = failure;
        return false;
      }
      return true;
    };

    // `workers` places are in flight at once; the first refusal, failure or spent cap stops them all.
    let next = 0;
    let halted = false;
    const work = async () => {
      while (!halted && next < places.length) {
        try {
          if (!(await handle(places[next++]))) halted = true;
        } catch (error) {
          // A write that failed must not lose the run's report: stop, and say what happened.
          run.error = "a write failed: " + (error instanceof Error ? error.message : String(error)).slice(0, 200);
          halted = true;
        }
      }
    };
    await Promise.all(Array.from({ length: workers }, work));

    const used = await ctx.runQuery(internal.imports.google.photoBudget, {});
    run.budget = used;
    return run;
  },
});
