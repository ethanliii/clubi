import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { featurize } from "../ingest";
import { parsePerformers, titleNamesLineup } from "../lib/performers";

// Public Eventbrite events for one city. Eventbrite's search API is gone (404 since 2020), so this
// reads the public listing pages (robots.txt allows /d/ and /b/, checked 2026-11-15), whose embedded
// `window.__SERVER_DATA__` JSON already has each event's name, summary, start, venue and
// coordinates. For events we have not stored yet, one documented API call per event adds the
// ticket price (needs EVENTBRITE_TOKEN; without it the events are still imported, without a price).
// At most one request a second. Only event and venue fields are read: organizers are ignored.

const SITE = "https://www.eventbrite.com";
const API = "https://www.eventbriteapi.com/v3/events/";
const API_EXPAND = "venue,category,subcategory,format,ticket_availability";
const USER_AGENT = "clubi-hackathon/1.0 (https://github.com/ethanliii/clubi)";
const DEFAULT_CITY_SLUG = "ca--san-francisco";
/** Listing pages for a city slug, in the order they are read. */
export const listingPaths = (slug: string) => [
  `/d/${slug}/events--today/`,
  `/d/${slug}/events--today/?page=2`,
  `/d/${slug}/events--tomorrow/`,
  `/d/${slug}/events--tomorrow/?page=2`,
  `/d/${slug}/events--this-weekend/`,
  `/d/${slug}/events--this-weekend/?page=2`,
  `/b/${slug}/music/`,
];
const MAX_DETAIL_CALLS = 60;
const REQUEST_GAP_MS = 1100;
const REQUEST_TIMEOUT_MS = 20000;
const HORIZON_MS = 30 * 24 * 60 * 60 * 1000;
const ROWS_PER_MUTATION = 25;
const MAX_WALK_DEPTH = 8;
const BLURB_LENGTH = 200;

type Tag = { display_name?: string; prefix?: string };
type Address = {
  address_1?: string | null;
  city?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  localized_address_display?: string | null;
};
/** One event as the listing pages embed it. */
export type ListingEvent = {
  id?: string;
  eventbrite_event_id?: string;
  name?: string;
  summary?: string | null;
  start_date?: string;
  start_time?: string;
  end_date?: string | null;
  end_time?: string | null;
  timezone?: string;
  url?: string;
  is_cancelled?: boolean | null;
  is_online_event?: boolean | null;
  is_protected_event?: boolean | null;
  tags?: Tag[];
  image?: { url?: string | null; original?: { url?: string | null } | null } | null;
  primary_venue?: { name?: string | null; address?: Address | null } | null;
};
type Money = { major_value?: string | null } | null;
/** One event as `GET /v3/events/<id>/?expand=venue,category,subcategory,format,ticket_availability` returns it. */
export type ApiEvent = {
  id?: string;
  name?: { text?: string | null } | null;
  summary?: string | null;
  description?: { text?: string | null } | null;
  url?: string;
  start?: { utc?: string } | null;
  end?: { utc?: string } | null;
  status?: string;
  listed?: boolean;
  online_event?: boolean;
  is_free?: boolean;
  logo?: { url?: string | null; original?: { url?: string | null } | null } | null;
  venue?: { name?: string | null; address?: Address | null; latitude?: string | null; longitude?: string | null } | null;
  category?: { name?: string | null } | null;
  subcategory?: { name?: string | null } | null;
  format?: { name?: string | null } | null;
  ticket_availability?: { minimum_ticket_price?: Money; is_sold_out?: boolean } | null;
};

/** What both shapes are reduced to before mapping. */
type Normal = {
  id: string;
  name: string;
  summary?: string;
  start: number;
  end?: number;
  /** Hour of the day (0 to 23) the event starts at, where it happens. */
  startHour?: number;
  url?: string;
  venueName?: string;
  address?: Address | null;
  category?: string;
  subcategory?: string;
  format?: string;
  imageUrl?: string;
  price?: number;
};

/** Epoch ms of a wall-clock time ("2026-11-15", "16:00") in an IANA time zone, or NaN. */
export function zonedToEpoch(date: string | undefined | null, time: string | undefined | null, timeZone: string | undefined): number {
  const day = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const clock = (time ?? "00:00").match(/^(\d{1,2}):(\d{2})/);
  if (!day || !clock) return NaN;
  const wall = Date.UTC(+day[1], +day[2] - 1, +day[3], +clock[1], +clock[2]);
  try {
    const format = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "UTC",
      hourCycle: "h23",
      year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
    });
    const offsetAt = (instant: number) => {
      const part = Object.fromEntries(format.formatToParts(instant).map((p) => [p.type, Number(p.value)]));
      return Date.UTC(part.year, part.month - 1, part.day, part.hour, part.minute, part.second) - instant;
    };
    // Two passes settle the offset on either side of a daylight-saving change.
    return wall - offsetAt(wall - offsetAt(wall));
  } catch {
    return NaN;
  }
}

/** The JSON a listing page embeds as `window.__SERVER_DATA__`, or null. */
export function serverData(html: string): unknown {
  const match = html.match(/window\.__SERVER_DATA__\s*=\s*(\{[\s\S]*?\});\s*(?:\n|<\/script>)/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/** Every event embedded in a listing or browse page, once each, in page order. */
export function listingEvents(html: string): ListingEvent[] {
  const found = new Map<string, ListingEvent>();
  const walk = (node: unknown, depth: number) => {
    if (depth > MAX_WALK_DEPTH || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const record = node as Record<string, unknown>;
    if (typeof record.eventbrite_event_id === "string" && typeof record.name === "string") {
      if (!found.has(record.eventbrite_event_id)) found.set(record.eventbrite_event_id, record as ListingEvent);
      return;
    }
    for (const value of Object.values(record)) walk(value, depth + 1);
  };
  walk(serverData(html), 0);
  return [...found.values()];
}

const tagNamed = (tags: Tag[] | undefined, prefix: string) =>
  tags?.find((tag) => tag.prefix === prefix)?.display_name ?? undefined;
const clean = (text: string | null | undefined) => text?.replace(/\s+/g, " ").trim() || undefined;

function fromListing(event: ListingEvent): Normal | null {
  const id = event.eventbrite_event_id ?? event.id;
  const name = clean(event.name);
  if (!id || !name) return null;
  if (event.is_online_event || event.is_cancelled || event.is_protected_event) return null;
  const start = zonedToEpoch(event.start_date, event.start_time, event.timezone);
  const end = event.end_date ? zonedToEpoch(event.end_date, event.end_time, event.timezone) : NaN;
  return {
    id,
    name,
    summary: clean(event.summary),
    start,
    end: Number.isFinite(end) && end > start ? end : undefined,
    startHour: Number(event.start_time?.split(":")[0]),
    url: event.url,
    venueName: clean(event.primary_venue?.name),
    address: event.primary_venue?.address,
    category: tagNamed(event.tags, "EventbriteCategory"),
    subcategory: tagNamed(event.tags, "EventbriteSubCategory"),
    format: tagNamed(event.tags, "EventbriteFormat"),
    imageUrl: event.image?.original?.url ?? event.image?.url ?? undefined,
  };
}

function fromApi(event: ApiEvent): Normal | null {
  const name = clean(event.name?.text);
  if (!event.id || !name) return null;
  if (event.online_event || event.listed === false || (event.status !== undefined && event.status !== "live")) return null;
  const start = Date.parse(event.start?.utc ?? "");
  const end = Date.parse(event.end?.utc ?? "");
  const lowest = Number(event.ticket_availability?.minimum_ticket_price?.major_value);
  const address = event.venue?.address ?? null;
  return {
    id: event.id,
    name,
    summary: clean(event.summary ?? event.description?.text),
    start,
    end: Number.isFinite(end) && end > start ? end : undefined,
    url: event.url,
    venueName: clean(event.venue?.name),
    address: address ? { ...address, latitude: address.latitude ?? event.venue?.latitude, longitude: address.longitude ?? event.venue?.longitude } : null,
    category: event.category?.name ?? undefined,
    subcategory: event.subcategory?.name ?? undefined,
    format: event.format?.name ?? undefined,
    imageUrl: event.logo?.original?.url ?? event.logo?.url ?? undefined,
    price: event.is_free ? 0 : Number.isFinite(lowest) ? lowest : undefined,
  };
}

const NIGHTLIFE_WORDS = /night ?club|\brave\b|bar crawl|pub crawl|club crawl|after[- ]?party|bottle service|21\s?\+|\bdj set\b|day ?party|dance party/i;
const PARTY = "Party or Social Gathering";
const PERFORMANCE = "Concert or Performance";
const LATE_HOUR = 21;
const EARLY_HOUR = 4;

/** Eventbrite category and format to ours: Music → live, Food & Drink → food, arts → culture, parties at night → nightlife, the rest → popup. */
function categoryOf(event: Normal) {
  const late = event.startHour !== undefined && (event.startHour >= LATE_HOUR || event.startHour < EARLY_HOUR);
  const party = event.format === PARTY;
  if (NIGHTLIFE_WORDS.test(event.name) || (party && (late || event.category === "Music"))) return "nightlife" as const;
  switch (event.category) {
    case "Music":
      return "live" as const;
    case "Food & Drink":
      return "food" as const;
    case "Performing & Visual Arts":
    case "Film, Media & Entertainment":
      return "culture" as const;
  }
  if (event.format === PERFORMANCE) return "live" as const;
  return "popup" as const;
}

function toRow(event: Normal | null, now: number) {
  if (!event) return null;
  const lat = Number(event.address?.latitude);
  const lng = Number(event.address?.longitude);
  if (!event.address || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  if (!Number.isFinite(event.start) || event.start > now + HORIZON_MS) return null;
  if ((event.end ?? event.start) < now - 3 * 60 * 60 * 1000) return null;
  const category = categoryOf(event);
  const subcategory =
    event.subcategory && event.subcategory !== "Other" ? event.subcategory.toLowerCase() : event.format?.toLowerCase();
  const tags = [event.category, event.subcategory, event.format]
    .filter((tag): tag is string => !!tag && tag !== "Other")
    .map((tag) => tag.toLowerCase());
  // Names come from the title only when it reads as a bill: a music or comedy event that is a
  // performance, or a title that says who is on ("X at Y", "A b2b B", "presents").
  const staged = event.category === "Music" || event.subcategory === "Comedy";
  const concert = event.format === PERFORMANCE;
  const names = staged && (concert || titleNamesLineup(event.name)) ? parsePerformers(event.name, { solo: concert }) : [];
  const kind = event.subcategory === "Comedy" ? "comedian" : "artist";
  const genres = event.subcategory && event.subcategory !== "Other" ? [event.subcategory] : undefined;
  return {
    source: "eventbrite" as const,
    sourceId: event.id,
    name: event.name,
    category,
    subcategory,
    lat,
    lng,
    start: event.start,
    end: event.end,
    address: clean(event.address.localized_address_display) ?? clean(event.address.address_1),
    city: clean(event.address.city),
    tags,
    price: event.price,
    imageUrl: event.imageUrl,
    sourceUrl: event.url ?? `${SITE}/e/${event.id}`,
    ticketUrl: event.url ?? `${SITE}/e/${event.id}`,
    blurb: event.summary?.slice(0, BLURB_LENGTH),
    venueName: event.venueName,
    performers: names.length ? names.map((name) => ({ name, kind, genres })) : undefined,
    venueVector: featurize({ category, subcategory, tags, title: event.name, description: event.summary, price: event.price }),
  };
}

/** Map one event from a listing page to an ingest row, or null when it is online, cancelled, private, unlocated or more than 30 days away. */
export const eventbriteToRow = (event: ListingEvent, now: number) => toRow(fromListing(event), now);

/** Map one event from the Eventbrite API (with venue, category, format and ticket_availability expanded) to an ingest row, or null. */
export const eventbriteDetailToRow = (event: ApiEvent, now: number) => toRow(fromApi(event), now);

async function fetchText(url: string, headers: Record<string, string>): Promise<string | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: abort.signal, headers: { "User-Agent": USER_AGENT, ...headers } });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type ImportResult = {
  frozen: boolean;
  hasToken: boolean;
  pages: number;
  blockedPages: string[];
  listed: number;
  newEvents: number;
  detailCalls: number;
  detailFailures: number;
  kept: number;
  byCategory: Record<string, number>;
  withPerformers: number;
  inserted: number;
  updated: number;
  unchanged: number;
  replaced: number;
  duplicate: number;
  dropped: number;
};

/**
 * Import public in-person Eventbrite events for a city: `npx convex run imports/eventbrite:importEventbrite`.
 * `citySlug` is Eventbrite's own ("ca--san-francisco", the default). Does nothing while the ingest
 * is frozen. A page that will not load is skipped and listed in `blockedPages`.
 */
export const importEventbrite = internalAction({
  args: { citySlug: v.optional(v.string()) },
  handler: async (ctx, { citySlug }): Promise<ImportResult> => {
    const token = process.env.EVENTBRITE_TOKEN;
    const result: ImportResult = {
      frozen: await ctx.runQuery(internal.ingest.isIngestFrozen, {}),
      hasToken: !!token,
      pages: 0,
      blockedPages: [],
      listed: 0,
      newEvents: 0,
      detailCalls: 0,
      detailFailures: 0,
      kept: 0,
      byCategory: {},
      withPerformers: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      replaced: 0,
      duplicate: 0,
      dropped: 0,
    };
    if (result.frozen) return result;
    const slug = /^[a-z0-9-]+$/.test(citySlug ?? "") ? citySlug! : DEFAULT_CITY_SLUG;
    const now = Date.now();
    let requests = 0;
    const politely = async () => {
      if (requests++ > 0) await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS));
    };

    const rows = new Map<string, NonNullable<ReturnType<typeof eventbriteToRow>>>();
    for (const path of listingPaths(slug)) {
      await politely();
      const html = await fetchText(SITE + path, { Accept: "text/html" });
      if (html === null) {
        result.blockedPages.push(path);
        continue;
      }
      result.pages++;
      const events = listingEvents(html);
      result.listed += events.length;
      for (const event of events) {
        const row = eventbriteToRow(event, now);
        if (row && !rows.has(row.sourceId)) rows.set(row.sourceId, row);
      }
    }

    // The price is only in the API: ask once per event, the first time we see it.
    const known = new Set(
      await ctx.runQuery(internal.ingest.knownSourceIds, { kind: "event", source: "eventbrite", sourceIds: [...rows.keys()] }),
    );
    const fresh = [...rows.keys()].filter((id) => !known.has(id));
    result.newEvents = fresh.length;
    if (token) {
      for (const id of fresh.slice(0, MAX_DETAIL_CALLS)) {
        await politely();
        result.detailCalls++;
        const body = await fetchText(`${API}${encodeURIComponent(id)}/?expand=${API_EXPAND}`, {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        });
        let detailed: ReturnType<typeof eventbriteDetailToRow> = null;
        try {
          detailed = body === null ? null : eventbriteDetailToRow(JSON.parse(body), now);
        } catch {
          detailed = null;
        }
        if (detailed) rows.set(id, detailed);
        else result.detailFailures++;
      }
    }

    const kept = [...rows.values()];
    result.kept = kept.length;
    for (const row of kept) {
      result.byCategory[row.category] = (result.byCategory[row.category] ?? 0) + 1;
      if (row.performers) result.withPerformers++;
    }
    for (let i = 0; i < kept.length; i += ROWS_PER_MUTATION) {
      const counts = await ctx.runMutation(internal.ingest.upsertBatch, {
        kind: "event",
        rows: kept.slice(i, i + ROWS_PER_MUTATION),
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
