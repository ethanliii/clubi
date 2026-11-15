import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { ADULT_AGE, ageGate, featurize, haversineMeters, readConfig, writeConfig } from "../ingest";

// Public Partiful events only. There is no API. Each run reads the Explore page
// once (its "Trending in the Bay" section of public events; robots.txt has no
// rule against it for a plain importer, checked 2026-11-15) and then any public
// event URLs listed in appConfig.partifulUrls, at most one request a second.
// Each URL is re-read at most every 6 hours, and the "similar events" an event
// page lists are read too. Only event fields are read: hosts, guests and guest
// counts in the page data are ignored, and the host-written description is used
// for the feature vector but not stored.
//
// Partiful rounds its map point to about 1 km. When a page shows a street
// address publicly, the address is geocoded once with OpenStreetMap Nominatim
// (its usage policy: one request a second, cached, a User-Agent that names the
// app) and the answer is cached in appConfig.partifulGeocode.

const EXPLORE_URL = "https://partiful.com/explore";
const EVENT_URL = /^https:\/\/(?:www\.)?partiful\.com\/e\/([A-Za-z0-9]+)/;
const USER_AGENT = "clubi-hackathon/1.0 (https://github.com/ethanliii/clubi)";
const URLS_KEY = "partifulUrls";
const FETCHED_KEY = "partifulFetched";
const REFETCH_MS = 6 * 60 * 60 * 1000;
const MAX_URLS_PER_RUN = 20;
// Event pages name a few "similar events" by id only: read up to this many of their pages a run.
const MAX_SIMILAR_READS = 5;
const REQUEST_GAP_MS = 1100;
const REQUEST_TIMEOUT_MS = 20000;
const HORIZON_MS = 14 * 24 * 60 * 60 * 1000;
const GEOCODE_URL = "https://nominatim.openstreetmap.org/search";
const GEOCODE_KEY = "partifulGeocode";
const MAX_GEOCODES_PER_RUN = 10;
const MAX_GEOCODE_CACHE = 400;
// A geocoded point further than this from Partiful's rounded point is a wrong match.
const GEOCODE_MAX_DRIFT_METERS = 2500;
const SF_BOX = { south: 37.7, north: 37.83, west: -122.52, east: -122.35 };

type PartifulEvent = {
  id?: string;
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string | null;
  isPublic?: boolean;
  status?: string;
  image?: { url?: string } | null;
  locationInfo?: {
    mapsInfo?: {
      name?: string;
      addressLines?: string[];
      approximateLocation?: string;
      appleMapsUrl?: string;
    };
    displayAddressLines?: string[];
    neighborhood?: string;
    displayName?: string;
  } | null;
};

export type GeoPoint = { lat: number; lng: number };

/**
 * The text to geocode for an event: its publicly shown street address, or null
 * when the page shows no street number (a neighbourhood or "address after RSVP").
 */
export function geocodeQuery(event: PartifulEvent): string | null {
  const shown = event.locationInfo?.displayAddressLines ?? [];
  if (shown.length < 2 || !/^\d+\s+\S/.test(shown[0] ?? "")) return null;
  // The first line is the street, the last is "City, ST". Unit lines in between confuse the geocoder.
  return `${shown[0]}, ${shown[shown.length - 1]}`.replace(/\s+/g, " ").trim();
}

/** The first Nominatim result as a point, or null. */
export function geocodeResult(body: unknown): GeoPoint | null {
  const first = Array.isArray(body) ? body[0] : null;
  const lat = Number(first?.lat);
  const lng = Number(first?.lon);
  return first && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/**
 * Map one Partiful event to an ingest row, or null when it is not a published
 * public event with a location in San Francisco in the next 14 days. Partiful
 * pages carry a street address and a map point rounded to about 1 km, so rows
 * are tagged "approximate location" unless `geocoded` (the street address
 * looked up with Nominatim) is given and agrees with the rounded point.
 */
export function partifulToRow(event: PartifulEvent, now: number, price?: number, geocoded?: GeoPoint | null) {
  const name = event.title?.trim();
  if (!event.id || !name || event.isPublic !== true || event.status !== "PUBLISHED") return null;
  const location = event.locationInfo;
  const point = location?.mapsInfo?.appleMapsUrl?.match(/[?&]sll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!point) return null;
  let lat = Number(point[1]);
  let lng = Number(point[2]);
  let rounded = (point[1].split(".")[1]?.length ?? 0) < 4;
  if (geocoded && haversineMeters({ lat, lng }, geocoded) <= GEOCODE_MAX_DRIFT_METERS) {
    lat = geocoded.lat;
    lng = geocoded.lng;
    rounded = false;
  }
  if (lat < SF_BOX.south || lat > SF_BOX.north || lng < SF_BOX.west || lng > SF_BOX.east) return null;
  const start = Date.parse(event.startDate ?? "");
  if (!Number.isFinite(start) || start > now + HORIZON_MS) return null;
  const end = event.endDate ? Date.parse(event.endDate) : undefined;
  const blurb = [location?.displayName ?? location?.mapsInfo?.name, location?.neighborhood]
    .filter((part) => typeof part === "string")
    .join(" · ");
  return {
    source: "partiful" as const,
    sourceId: event.id,
    name,
    category: "popup" as const,
    subcategory: "party",
    lat,
    lng,
    start,
    end: end !== undefined && Number.isFinite(end) ? end : undefined,
    address: location?.displayAddressLines?.join(", "),
    city: location?.mapsInfo?.approximateLocation?.split(",")[0],
    tags: rounded ? ["approximate location"] : [],
    price,
    imageUrl: event.image?.url?.startsWith("https://") ? event.image.url : undefined,
    sourceUrl: "https://partiful.com/e/" + event.id,
    blurb: blurb || undefined,
    venueName: location?.mapsInfo?.name?.trim() || undefined,
    // The description is read here and not stored, so say what it says about age.
    minAge: ageGate({ title: name, description: event.description, venueName: location?.mapsInfo?.name }) === "adults" ? ADULT_AGE : undefined,
    venueVector: featurize({
      category: "popup",
      subcategory: "party",
      title: name,
      description: event.description,
      price,
    }),
  };
}

/** The pageProps object from a Partiful page's embedded Next.js data, or null. */
export function pageProps(html: string): Record<string, any> | null {
  const data = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!data) return null;
  try {
    return JSON.parse(data[1])?.props?.pageProps ?? null;
  } catch {
    return null;
  }
}

/** Ids of the public events an event page recommends ("similar events"). The page gives no location for them. */
export function similarEventIds(page: Record<string, any> | null): string[] {
  const items: unknown[] = Array.isArray(page?.similarEvents) ? page.similarEvents : [];
  const ids = items.map((item: any) => item?.event?.id ?? item?.id).filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9]+$/.test(id));
  return [...new Set(ids)];
}

async function fetchPage(url: string): Promise<Record<string, any> | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: abort.signal,
      headers: { Accept: "text/html", "User-Agent": USER_AGENT },
    });
    return response.ok ? pageProps(await response.text()) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The public event URLs in appConfig.partifulUrls (an array, or one string
 * with a URL per line): the event ids they name, and the URLs not read in the
 * last 6 hours.
 */
export const urlPlan = internalQuery({
  args: {},
  handler: async (ctx): Promise<{ listedIds: string[]; due: string[]; recentlyRead: string[] }> => {
    const listed: unknown = (await readConfig(ctx, URLS_KEY))?.value ?? [];
    const urls = (Array.isArray(listed) ? listed : String(listed).split(/[\s,]+/))
      .filter((url): url is string => typeof url === "string")
      .map((url) => url.match(EVENT_URL)?.[0])
      .filter((url) => url !== undefined);
    const fetched: Record<string, number> = (await readConfig(ctx, FETCHED_KEY))?.value ?? {};
    const now = Date.now();
    const unique = [...new Set(urls)];
    return {
      listedIds: unique.map((url) => url.match(EVENT_URL)![1]),
      due: unique.filter((url) => now - (fetched[url] ?? 0) > REFETCH_MS).slice(0, MAX_URLS_PER_RUN),
      recentlyRead: Object.keys(fetched).filter((url) => now - fetched[url] <= REFETCH_MS),
    };
  },
});

/** Replace the list of public event URLs to import, and read them all on the next run: `npx convex run imports/partiful:setUrls '{"urls":["https://partiful.com/e/..."]}'`. */
export const setUrls = internalMutation({
  args: { urls: v.array(v.string()) },
  handler: async (ctx, { urls }) => {
    const valid = urls.filter((url) => EVENT_URL.test(url));
    await writeConfig(ctx, URLS_KEY, valid);
    await writeConfig(ctx, FETCHED_KEY, {});
    return { saved: valid.length, rejected: urls.length - valid.length };
  },
});

/** The name the Data brief uses for `setUrls`: `npx convex run imports/partiful:setPartifulUrls '{"urls":["https://partiful.com/e/..."]}'`. */
export const setPartifulUrls = internalMutation({
  args: { urls: v.array(v.string()) },
  handler: async (ctx, { urls }) => {
    const valid = urls.filter((url) => EVENT_URL.test(url));
    await writeConfig(ctx, URLS_KEY, valid);
    await writeConfig(ctx, FETCHED_KEY, {});
    return { saved: valid.length, rejected: urls.length - valid.length };
  },
});

type GeocodeCache = Record<string, GeoPoint | null>;

/** Addresses already geocoded (null = Nominatim had no answer). */
export const geocodeCache = internalQuery({
  args: {},
  handler: async (ctx): Promise<GeocodeCache> => (await readConfig(ctx, GEOCODE_KEY))?.value ?? {},
});

export const saveGeocodes = internalMutation({
  args: { found: v.array(v.object({ query: v.string(), lat: v.optional(v.number()), lng: v.optional(v.number()) })) },
  handler: async (ctx, { found }) => {
    const cache: GeocodeCache = (await readConfig(ctx, GEOCODE_KEY))?.value ?? {};
    for (const { query, lat, lng } of found) {
      cache[query] = lat !== undefined && lng !== undefined ? { lat, lng } : null;
    }
    // Oldest entries go first when the cache is full.
    const entries = Object.entries(cache).slice(-MAX_GEOCODE_CACHE);
    await writeConfig(ctx, GEOCODE_KEY, Object.fromEntries(entries));
  },
});

async function geocode(query: string): Promise<GeoPoint | null | undefined> {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("q", query);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      signal: abort.signal,
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    // undefined = could not ask (try again next run); null = asked, no such address.
    return response.ok ? geocodeResult(await response.json()) : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export const markFetched = internalMutation({
  args: { urls: v.array(v.string()) },
  handler: async (ctx, { urls }) => {
    const fetched: Record<string, number> = (await readConfig(ctx, FETCHED_KEY))?.value ?? {};
    const now = Date.now();
    await writeConfig(ctx, FETCHED_KEY, {
      ...fetched,
      ...Object.fromEntries(urls.map((url) => [url, now])),
    });
  },
});

type ImportResult = {
  frozen: boolean;
  exploreEvents: number;
  urlsRead: number;
  similarEvents: number;
  geocoded: number;
  kept: number;
  inserted: number;
  updated: number;
  unchanged: number;
  replaced: number;
  duplicate: number;
  dropped: number;
};

/** Import public Partiful events in San Francisco: `npx convex run imports/partiful:importPartiful`. Does nothing while the ingest is frozen. */
export const importPartiful = internalAction({
  args: {},
  handler: async (ctx): Promise<ImportResult> => {
    const result: ImportResult = {
      frozen: await ctx.runQuery(internal.ingest.isIngestFrozen, {}),
      exploreEvents: 0,
      urlsRead: 0,
      similarEvents: 0,
      geocoded: 0,
      kept: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      replaced: 0,
      duplicate: 0,
      dropped: 0,
    };
    if (result.frozen) return result;
    const now = Date.now();
    const { listedIds, due, recentlyRead } = await ctx.runQuery(internal.imports.partiful.urlPlan, {});

    // Every public event seen this run, by id. A listed event is taken only
    // from its own page, which also has the price, so the Explore copy never
    // overwrites it between page reads.
    const seen = new Map<string, { event: PartifulEvent; price?: number }>();
    const explore = await fetchPage(EXPLORE_URL);
    const trending: { event?: PartifulEvent }[] = explore?.trendingSections?.SF?.items ?? [];
    result.exploreEvents = trending.length;
    for (const { event } of trending) {
      if (event?.id && !listedIds.includes(event.id)) seen.set(event.id, { event });
    }

    const read: string[] = [];
    const similarUrls: string[] = [];
    const readPage = async (url: string, followSimilar: boolean) => {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS));
      const page = await fetchPage(url);
      if (!page) return;
      read.push(url);
      if (!page.event?.id || page.passwordRequired) return;
      const offered = page.offersJsonLd?.price;
      seen.set(page.event.id, { event: page.event, price: typeof offered === "number" ? offered : undefined });
      if (!followSimilar) return;
      for (const id of similarEventIds(page)) {
        const similarUrl = "https://partiful.com/e/" + id;
        if (seen.has(id) || listedIds.includes(id) || recentlyRead.includes(similarUrl) || similarUrls.includes(similarUrl)) continue;
        similarUrls.push(similarUrl);
      }
    };
    for (const url of due) await readPage(url, true);
    for (const url of similarUrls.slice(0, MAX_SIMILAR_READS)) {
      await readPage(url, false);
      result.similarEvents++;
    }
    result.urlsRead = read.length;
    if (read.length) await ctx.runMutation(internal.imports.partiful.markFetched, { urls: read });

    // Geocode publicly shown street addresses of the events we would keep.
    const cache = await ctx.runQuery(internal.imports.partiful.geocodeCache, {});
    const found: { query: string; lat?: number; lng?: number }[] = [];
    const rows = new Map<string, NonNullable<ReturnType<typeof partifulToRow>>>();
    for (const { event, price } of seen.values()) {
      if (!partifulToRow(event, now, price)) continue;
      const query = geocodeQuery(event);
      let point = query ? cache[query] : null;
      if (query && point === undefined && found.length < MAX_GEOCODES_PER_RUN) {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS));
        const answer = await geocode(query);
        if (answer !== undefined) {
          found.push({ query, lat: answer?.lat, lng: answer?.lng });
          cache[query] = answer;
          point = answer;
        }
      }
      const row = partifulToRow(event, now, price, point);
      if (!row) continue;
      if (!row.tags.includes("approximate location") && query) result.geocoded++;
      rows.set(row.sourceId, row);
    }
    if (found.length) await ctx.runMutation(internal.imports.partiful.saveGeocodes, { found });

    result.kept = rows.size;
    if (rows.size) {
      const counts = await ctx.runMutation(internal.ingest.upsertBatch, {
        kind: "event",
        rows: [...rows.values()].slice(0, 100),
      });
      if (counts.frozen) return { ...result, frozen: true };
      result.inserted = counts.inserted;
      result.updated = counts.updated;
      result.unchanged = counts.unchanged;
      result.replaced = counts.replaced;
      result.duplicate = counts.duplicate;
      result.dropped = counts.dropped;
    }
    return result;
  },
});
