import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { ADULT_AGE, ageGate, featurize } from "../ingest";
import { MAX_PERFORMERS } from "../lib/performers";
import { zonedToEpoch } from "./eventbrite";

// Ticketmaster Discovery API v2 (developer.ticketmaster.com, documented; 5 requests a second and
// 5000 a day allowed, we make at most 3 a run, a second apart). Needs TICKETMASTER_KEY; without
// it the import reports that and does nothing. This is the one source with real artist data:
// each event's `attractions` become performers with genres and images, which is what the artist
// alert ("Calvin Harris is coming to San Francisco") runs on.

const ENDPOINT = "https://app.ticketmaster.com/discovery/v2/events.json";
const USER_AGENT = "clubi-hackathon/1.0 (https://github.com/ethanliii/clubi)";
const SF = { lat: 37.7749, lng: -122.4194 };
const DEFAULT_RADIUS_KM = 25;
const MAX_RADIUS_KM = 150;
const DEFAULT_DAYS = 14;
const MAX_DAYS = 120;
const PAGE_SIZE = 100;
const MAX_PAGES = 3;
const GEOHASH_PRECISION = 7;
const REQUEST_GAP_MS = 1100;
const REQUEST_TIMEOUT_MS = 20000;
const ROWS_PER_MUTATION = 25;
const DAY_MS = 24 * 60 * 60 * 1000;
// When Ticketmaster knows the day but not the time.
const DEFAULT_SHOW_TIME = "20:00";
const IMAGE_TARGET_WIDTH = 1024;

type Image = { ratio?: string; url?: string; width?: number; height?: number; fallback?: boolean };
type Named = { name?: string } | null;
type Classification = { primary?: boolean; segment?: Named; genre?: Named; subGenre?: Named };
type Attraction = { id?: string; name?: string; images?: Image[]; classifications?: Classification[] };
type Venue = {
  name?: string;
  timezone?: string;
  city?: Named;
  address?: { line1?: string } | null;
  location?: { latitude?: string; longitude?: string } | null;
};
export type TicketmasterEvent = {
  id?: string;
  name?: string;
  url?: string;
  dates?: {
    start?: { dateTime?: string; localDate?: string; localTime?: string; dateTBA?: boolean; dateTBD?: boolean; timeTBA?: boolean };
    timezone?: string;
    status?: { code?: string };
  };
  images?: Image[];
  priceRanges?: { type?: string; currency?: string; min?: number; max?: number }[];
  // Free text where promoters put the age rule ("This is a 21 and over event").
  info?: string;
  pleaseNote?: string;
  ageRestrictions?: { legalAgeEnforced?: boolean; ageRuleDescription?: string } | null;
  classifications?: Classification[];
  _embedded?: { venues?: Venue[]; attractions?: Attraction[] };
};
type Page = { _embedded?: { events?: TicketmasterEvent[] }; page?: { totalPages?: number; number?: number } };

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Geohash of a point: Ticketmaster's `geoPoint` parameter. */
export function geohashOf(lat: number, lng: number, precision = GEOHASH_PRECISION): string {
  let [south, north, west, east] = [-90, 90, -180, 180];
  let hash = "";
  let bits = 0;
  let value = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (west + east) / 2;
      if (lng >= mid) [value, west] = [value * 2 + 1, mid];
      else [value, east] = [value * 2, mid];
    } else {
      const mid = (south + north) / 2;
      if (lat >= mid) [value, south] = [value * 2 + 1, mid];
      else [value, north] = [value * 2, mid];
    }
    even = !even;
    if (++bits === 5) {
      hash += BASE32[value];
      bits = 0;
      value = 0;
    }
  }
  return hash;
}

/** The 16:9 image closest to 1024 px wide, real artwork before Ticketmaster's fallback art. */
export function bestImage(images: Image[] | undefined): string | undefined {
  const usable = (images ?? []).filter((image) => typeof image.url === "string" && image.url.startsWith("https://"));
  const rank = (image: Image) =>
    (image.ratio === "16_9" ? 0 : 10_000) + (image.fallback ? 5_000 : 0) + Math.abs((image.width ?? 0) - IMAGE_TARGET_WIDTH);
  return usable.sort((a, b) => rank(a) - rank(b))[0]?.url;
}

const realName = (named: Named | undefined) => {
  const name = named?.name?.trim();
  return name && !/^(undefined|other|miscellaneous)$/i.test(name) ? name : undefined;
};

/** Segment, genre and sub-genre names of the primary classification, without Ticketmaster's "Undefined". */
function genresOf(classifications: Classification[] | undefined): { segment?: string; genres: string[] } {
  const main = classifications?.find((c) => c.primary) ?? classifications?.[0];
  const genres = [realName(main?.genre), realName(main?.subGenre)].filter((name): name is string => name !== undefined);
  return { segment: realName(main?.segment), genres: [...new Set(genres)] };
}

function performerKind(segment: string | undefined, genres: string[]): string {
  if (segment === "Sports") return "team";
  if (genres.some((genre) => /comedy/i.test(genre))) return "comedian";
  if (segment === "Music") return "artist";
  return "act";
}

/**
 * Map one Discovery API event to an ingest row, or null when it is cancelled or postponed, has no
 * date yet, or its venue has no coordinates. Every Ticketmaster event is category `live`
 * (concerts, sports and theatre); the segment and genre shape the feature vector.
 */
export function ticketmasterToRow(event: TicketmasterEvent, now: number) {
  const name = event.name?.trim();
  if (!event.id || !name) return null;
  const status = event.dates?.status?.code;
  if (status === "canceled" || status === "cancelled" || status === "postponed") return null;
  const venue = event._embedded?.venues?.[0];
  const lat = Number(venue?.location?.latitude);
  const lng = Number(venue?.location?.longitude);
  if (!venue?.location || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  const when = event.dates?.start;
  if (!when || when.dateTBA || when.dateTBD) return null;
  const start = when.dateTime
    ? Date.parse(when.dateTime)
    : zonedToEpoch(when.localDate, when.localTime ?? DEFAULT_SHOW_TIME, event.dates?.timezone ?? venue.timezone);
  if (!Number.isFinite(start) || start < now - 3 * 60 * 60 * 1000) return null;

  const { segment, genres } = genresOf(event.classifications);
  const tags = [segment, ...genres].filter((tag): tag is string => tag !== undefined).map((tag) => tag.toLowerCase());
  const subcategory = (genres[0] ?? segment)?.toLowerCase();
  const standard = event.priceRanges?.find((range) => range.type === "standard") ?? event.priceRanges?.[0];
  const price = typeof standard?.min === "number" && standard.min >= 0 ? standard.min : undefined;

  const performers = [];
  const seen = new Set<string>();
  for (const attraction of event._embedded?.attractions ?? []) {
    const performerName = attraction.name?.trim();
    if (!performerName || seen.has(performerName.toLowerCase()) || performers.length >= MAX_PERFORMERS) continue;
    seen.add(performerName.toLowerCase());
    const own = genresOf(attraction.classifications);
    // An attraction without its own classification is on this bill, so it shares the event's genres.
    const performerGenres = own.genres.length || own.segment ? [own.segment, ...own.genres] : [segment, ...genres];
    const named = performerGenres.filter((genre): genre is string => genre !== undefined);
    performers.push({
      name: performerName,
      sourceId: attraction.id,
      genres: named.length ? named : undefined,
      imageUrl: bestImage(attraction.images),
      kind: performerKind(own.segment ?? segment, named),
    });
  }

  return {
    source: "ticketmaster" as const,
    sourceId: event.id,
    name,
    category: "live" as const,
    subcategory,
    lat,
    lng,
    start,
    address: venue.address?.line1?.trim() || undefined,
    city: venue.city?.name?.trim() || undefined,
    tags,
    price,
    imageUrl: bestImage(event.images),
    sourceUrl: event.url,
    ticketUrl: event.url,
    blurb: [segment, ...genres].filter(Boolean).join(" · ") || undefined,
    venueName: venue.name?.trim() || undefined,
    minAge:
      ageGate({
        title: name,
        description: [event.info, event.pleaseNote, event.ageRestrictions?.ageRuleDescription].filter(Boolean).join(" | "),
        venueName: venue.name,
      }) === "adults"
        ? ADULT_AGE
        : undefined,
    performers: performers.length ? performers : undefined,
    // The ingest blends the performers' genre vectors into this.
    venueVector: featurize({ category: "live", subcategory, tags, title: name, price }),
  };
}

/** `2026-11-15T20:00:00Z`: the API rejects milliseconds. */
const apiTime = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

/** The search URL for one page (the key is added by the caller, so this is safe to log and test). */
export function searchUrl(args: { lat: number; lng: number; radiusKm: number; from: number; to: number; page: number }): URL {
  const url = new URL(ENDPOINT);
  url.searchParams.set("geoPoint", geohashOf(args.lat, args.lng));
  url.searchParams.set("radius", String(Math.round(args.radiusKm)));
  url.searchParams.set("unit", "km");
  url.searchParams.set("startDateTime", apiTime(args.from));
  url.searchParams.set("endDateTime", apiTime(args.to));
  url.searchParams.set("size", String(PAGE_SIZE));
  url.searchParams.set("page", String(args.page));
  url.searchParams.set("sort", "date,asc");
  return url;
}

type ImportResult = {
  frozen: boolean;
  pages: number;
  fetched: number;
  kept: number;
  withPerformers: number;
  performers: number;
  error?: string;
  inserted: number;
  updated: number;
  unchanged: number;
  replaced: number;
  duplicate: number;
  dropped: number;
};

/**
 * Import Ticketmaster events around a point (default: San Francisco, 25 km, the next 14 days):
 * `npx convex run imports/ticketmaster:importTicketmaster '{"days": 30}'`.
 * Does nothing while the ingest is frozen or when TICKETMASTER_KEY is not set.
 */
export const importTicketmaster = internalAction({
  args: {
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    radiusKm: v.optional(v.number()),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ImportResult | { skipped: string }> => {
    const key = process.env.TICKETMASTER_KEY;
    if (!key) return { skipped: "no TICKETMASTER_KEY" };
    const result: ImportResult = {
      frozen: await ctx.runQuery(internal.ingest.isIngestFrozen, {}),
      pages: 0,
      fetched: 0,
      kept: 0,
      withPerformers: 0,
      performers: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      replaced: 0,
      duplicate: 0,
      dropped: 0,
    };
    if (result.frozen) return result;
    const now = Date.now();
    const lat = args.lat ?? SF.lat;
    const lng = args.lng ?? SF.lng;
    if (!(Math.abs(lat) <= 90) || !(Math.abs(lng) <= 180)) return { skipped: "invalid location" };
    const radiusKm = Math.min(MAX_RADIUS_KM, Math.max(1, args.radiusKm ?? DEFAULT_RADIUS_KM));
    const days = Math.min(MAX_DAYS, Math.max(1, args.days ?? DEFAULT_DAYS));

    const rows = new Map<string, NonNullable<ReturnType<typeof ticketmasterToRow>>>();
    for (let page = 0; page < MAX_PAGES; page++) {
      if (page > 0) await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS));
      const url = searchUrl({ lat, lng, radiusKm, from: now, to: now + days * DAY_MS, page });
      url.searchParams.set("apikey", key);
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
      let body: Page;
      try {
        const response = await fetch(url.toString(), {
          signal: abort.signal,
          headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        });
        if (!response.ok) {
          // Never echo the URL: it carries the key.
          result.error = "Ticketmaster answered " + response.status;
          break;
        }
        body = await response.json();
      } catch {
        result.error = "Ticketmaster did not answer";
        break;
      } finally {
        clearTimeout(timer);
      }
      const events = body._embedded?.events ?? [];
      result.pages++;
      result.fetched += events.length;
      for (const event of events) {
        const row = ticketmasterToRow(event, now);
        if (row && !rows.has(row.sourceId)) rows.set(row.sourceId, row);
      }
      if (events.length < PAGE_SIZE || page + 1 >= (body.page?.totalPages ?? 0)) break;
    }

    const kept = [...rows.values()];
    result.kept = kept.length;
    for (const row of kept) {
      if (row.performers) result.withPerformers++;
      result.performers += row.performers?.length ?? 0;
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
