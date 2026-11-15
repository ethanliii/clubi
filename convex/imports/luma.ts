import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { featurize } from "../ingest";

// Public San Francisco events from Luma's discover list. This is the JSON
// endpoint luma.com/sf itself calls (read from the page's scripts on
// 2026-11-15), paged with the cursor it returns, at most one request a second.
// Only event fields are read: host and guest data in the response is ignored.

const ENDPOINT = "https://api.luma.com/discover/get-paginated-events";
const SF_PLACE_API_ID = "discplace-BDj7GNbGlsF7Cka";
const USER_AGENT = "clubi-hackathon/1.0 (https://github.com/ethanliii/clubi)";
const PAGE_LIMIT = 25;
const MAX_PAGES = 12;
const REQUEST_GAP_MS = 1100;
const REQUEST_TIMEOUT_MS = 20000;
const HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
const ROWS_PER_MUTATION = 50;
const SF_BOX = { south: 37.7, north: 37.83, west: -122.52, east: -122.35 };

type LumaEntry = {
  start_at?: string;
  event?: {
    api_id?: string;
    name?: string;
    url?: string;
    start_at?: string;
    end_at?: string | null;
    cover_url?: string | null;
    visibility?: string;
    location_type?: string;
    geo_address_visibility?: string;
    coordinate?: { latitude: number; longitude: number } | null;
    geo_address_info?: {
      address?: string | null;
      short_address?: string | null;
      city?: string | null;
      sublocality?: string | null;
    } | null;
  };
  ticket_info?: { is_free?: boolean; price?: { cents?: number | null } | null } | null;
};
type LumaPage = { entries?: LumaEntry[]; has_more?: boolean; next_cursor?: string | null };

const LIVE = /concert|live music|\bdjs?\b|\bbands?\b|open mic|comedy|stand[- ]?up|\brave\b|karaoke|jazz|orchestra|symphony|\bshow\b|performance/i;
const SUBCATEGORIES: [RegExp, string][] = [
  [/comedy|stand[- ]?up|improv/i, "comedy"],
  [/\brave\b|\bdjs?\b|dance party|afterparty|after[- ]party/i, "dj night"],
  [/concert|live music|\bbands?\b|open mic|jazz|orchestra|symphony/i, "live music"],
  [/market|pop[- ]?up|bazaar|\bfair\b|swap/i, "market"],
  [/dinner|supper|brunch|tasting|\bfood\b|wine|cocktail|coffee/i, "food and drink"],
  [/run club|\brun\b|hike|yoga|pickleball|climb|cycling|\bride\b|workout|fitness/i, "fitness"],
  [/gallery|\barts?\b|exhibit|film|screening|poetry|book|museum/i, "arts"],
  [/hackathon|demo day|founders?|startup|\bai\b|agents?|tech|engineer|developer|\bllm|product/i, "tech meetup"],
  [/workshop|class|masterclass|bootcamp/i, "workshop"],
];

/** Map one discover entry to an ingest row, or null when it is not a public in-person event in San Francisco within the next 7 days. */
export function lumaToRow(entry: LumaEntry, now: number) {
  const event = entry.event;
  const name = event?.name?.trim();
  if (!event?.api_id || !name || !event.url) return null;
  if (event.visibility !== "public" || event.location_type !== "offline") return null;
  const point = event.coordinate;
  if (!point) return null;
  const { latitude: lat, longitude: lng } = point;
  if (lat < SF_BOX.south || lat > SF_BOX.north || lng < SF_BOX.west || lng > SF_BOX.east) return null;
  const start = Date.parse(event.start_at ?? entry.start_at ?? "");
  if (!Number.isFinite(start) || start > now + HORIZON_MS) return null;
  const end = event.end_at ? Date.parse(event.end_at) : undefined;

  const geo = event.geo_address_info;
  const addressShown = event.geo_address_visibility === "public";
  const venue = addressShown ? (geo?.address ?? undefined) : undefined;
  const address = addressShown ? (geo?.short_address ?? geo?.address ?? undefined) : undefined;
  const blurb = addressShown
    ? venue && !address?.startsWith(venue)
      ? "At " + venue
      : undefined
    : [geo?.sublocality ?? geo?.city, "exact address after RSVP on Luma"]
        .filter((part) => typeof part === "string")
        .join(" · ");
  const price = entry.ticket_info?.is_free
    ? 0
    : typeof entry.ticket_info?.price?.cents === "number"
      ? entry.ticket_info.price.cents / 100
      : undefined;
  const category = LIVE.test(name) ? ("live" as const) : ("popup" as const);
  const subcategory = SUBCATEGORIES.find(([match]) => match.test(name))?.[1] ?? "meetup";
  return {
    source: "luma" as const,
    sourceId: event.api_id,
    name,
    category,
    subcategory,
    lat,
    lng,
    start,
    end: end !== undefined && Number.isFinite(end) ? end : undefined,
    address,
    city: geo?.city ?? undefined,
    tags: addressShown ? [] : ["approximate location"],
    price,
    imageUrl: event.cover_url ?? undefined,
    sourceUrl: "https://lu.ma/" + event.url,
    blurb,
    venueVector: featurize({ category, subcategory, title: name, price }),
  };
}

async function fetchPage(cursor: string | undefined): Promise<LumaPage> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("discover_place_api_id", SF_PLACE_API_ID);
  url.searchParams.set("pagination_limit", String(PAGE_LIMIT));
  if (cursor) url.searchParams.set("pagination_cursor", cursor);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      signal: abort.signal,
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!response.ok) throw new Error("Luma answered " + response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

type ImportResult = {
  frozen: boolean;
  pages: number;
  fetched: number;
  kept: number;
  byCategory: Record<string, number>;
  inserted: number;
  updated: number;
  unchanged: number;
  replaced: number;
  duplicate: number;
  dropped: number;
};

/** Import the next 7 days of public in-person San Francisco events from Luma: `npx convex run imports/luma:importLuma`. Does nothing while the ingest is frozen. */
export const importLuma = internalAction({
  args: {},
  handler: async (ctx): Promise<ImportResult> => {
    const result: ImportResult = {
      frozen: await ctx.runQuery(internal.ingest.isIngestFrozen, {}),
      pages: 0,
      fetched: 0,
      kept: 0,
      byCategory: {},
      inserted: 0,
      updated: 0,
      unchanged: 0,
      replaced: 0,
      duplicate: 0,
      dropped: 0,
    };
    if (result.frozen) return result;
    const now = Date.now();
    const rows = [];
    let cursor: string | undefined;
    while (result.pages < MAX_PAGES) {
      if (result.pages > 0) await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS));
      const page = await fetchPage(cursor);
      const entries = page.entries ?? [];
      result.pages++;
      result.fetched += entries.length;
      for (const entry of entries) {
        const row = lumaToRow(entry, now);
        if (row) rows.push(row);
      }
      const lastStart = Date.parse(entries.at(-1)?.start_at ?? "");
      if (!page.has_more || !page.next_cursor || !(lastStart <= now + HORIZON_MS)) break;
      cursor = page.next_cursor;
    }
    result.kept = rows.length;
    for (const row of rows) {
      result.byCategory[row.category] = (result.byCategory[row.category] ?? 0) + 1;
    }
    for (let i = 0; i < rows.length; i += ROWS_PER_MUTATION) {
      const counts = await ctx.runMutation(internal.ingest.upsertBatch, {
        kind: "event",
        rows: rows.slice(i, i + ROWS_PER_MUTATION),
      });
      if (counts.frozen) return { ...result, frozen: true };
      result.inserted += counts.inserted;
      result.updated += counts.updated;
      result.unchanged += counts.unchanged;
      result.replaced += counts.replaced;
      result.duplicate += counts.duplicate;
      result.dropped += counts.dropped;
    }
    return result;
  },
});
