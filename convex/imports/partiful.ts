import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { featurize, readConfig, writeConfig } from "../ingest";

// Public Partiful events only. Each run reads the Explore page once (its
// "Trending in the Bay" section of public events) and then any public event
// URLs listed in appConfig.partifulUrls, at most one request a second. Each
// URL is re-read at most every 6 hours. Only event fields are read: hosts,
// guests and guest counts in the page data are ignored, and the host-written
// description is used for the feature vector but not stored.

const EXPLORE_URL = "https://partiful.com/explore";
const EVENT_URL = /^https:\/\/(?:www\.)?partiful\.com\/e\/([A-Za-z0-9]+)/;
const USER_AGENT = "clubi-hackathon/1.0 (https://github.com/ethanliii/clubi)";
const URLS_KEY = "partifulUrls";
const FETCHED_KEY = "partifulFetched";
const REFETCH_MS = 6 * 60 * 60 * 1000;
const MAX_URLS_PER_RUN = 20;
const REQUEST_GAP_MS = 1100;
const REQUEST_TIMEOUT_MS = 20000;
const HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
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
      approximateLocation?: string;
      appleMapsUrl?: string;
    };
    displayAddressLines?: string[];
    neighborhood?: string;
    displayName?: string;
  } | null;
};

/**
 * Map one Partiful event to an ingest row, or null when it is not a published
 * public event with a location in San Francisco in the next 7 days. Partiful
 * pages carry a street address and a map point rounded to about 1 km, so rows
 * are tagged "approximate location".
 */
export function partifulToRow(event: PartifulEvent, now: number, price?: number) {
  const name = event.title?.trim();
  if (!event.id || !name || event.isPublic !== true || event.status !== "PUBLISHED") return null;
  const location = event.locationInfo;
  const point = location?.mapsInfo?.appleMapsUrl?.match(/[?&]sll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!point) return null;
  const lat = Number(point[1]);
  const lng = Number(point[2]);
  if (lat < SF_BOX.south || lat > SF_BOX.north || lng < SF_BOX.west || lng > SF_BOX.east) return null;
  const start = Date.parse(event.startDate ?? "");
  if (!Number.isFinite(start) || start > now + HORIZON_MS) return null;
  const end = event.endDate ? Date.parse(event.endDate) : undefined;
  const rounded = (point[1].split(".")[1]?.length ?? 0) < 4;
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

/** Public event URLs to read (appConfig.partifulUrls: an array, or one string with a URL per line) minus those read in the last 6 hours. */
export const dueUrls = internalQuery({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const listed: unknown = (await readConfig(ctx, URLS_KEY))?.value ?? [];
    const urls = (Array.isArray(listed) ? listed : String(listed).split(/[\s,]+/))
      .filter((url): url is string => typeof url === "string")
      .map((url) => url.match(EVENT_URL)?.[0])
      .filter((url) => url !== undefined);
    const fetched: Record<string, number> = (await readConfig(ctx, FETCHED_KEY))?.value ?? {};
    const now = Date.now();
    return [...new Set(urls)]
      .filter((url) => now - (fetched[url] ?? 0) > REFETCH_MS)
      .slice(0, MAX_URLS_PER_RUN);
  },
});

/** Replace the list of public event URLs to import: `npx convex run imports/partiful:setUrls '{"urls":["https://partiful.com/e/..."]}'`. */
export const setUrls = internalMutation({
  args: { urls: v.array(v.string()) },
  handler: async (ctx, { urls }) => {
    const valid = urls.filter((url) => EVENT_URL.test(url));
    await writeConfig(ctx, URLS_KEY, valid);
    return { saved: valid.length, rejected: urls.length - valid.length };
  },
});

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
    const rows = new Map<string, NonNullable<ReturnType<typeof partifulToRow>>>();

    const explore = await fetchPage(EXPLORE_URL);
    const trending: { event?: PartifulEvent }[] = explore?.trendingSections?.SF?.items ?? [];
    result.exploreEvents = trending.length;
    for (const item of trending) {
      const row = item.event ? partifulToRow(item.event, now) : null;
      if (row) rows.set(row.sourceId, row);
    }

    const urls = await ctx.runQuery(internal.imports.partiful.dueUrls, {});
    for (const url of urls) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS));
      const page = await fetchPage(url);
      result.urlsRead++;
      if (!page?.event || page.passwordRequired) continue;
      const offered = page.offersJsonLd?.price;
      const row = partifulToRow(page.event, now, typeof offered === "number" ? offered : undefined);
      if (row) rows.set(row.sourceId, row);
    }
    if (urls.length) await ctx.runMutation(internal.imports.partiful.markFetched, { urls });

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
