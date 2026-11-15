import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { featurize, haversineMeters } from "../ingest";

// Data © OpenStreetMap contributors, ODbL (openstreetmap.org/copyright). Rows
// stay marked source "osm" and link back to the OSM object in sourceUrl.

// Public Overpass instances, fastest first as measured on 2026-11-15.
const ENDPOINTS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const USER_AGENT = "clubi-hackathon/1.0 (https://github.com/ethanliii/clubi)";
const ATTEMPTS = 6;
const ATTEMPT_TIMEOUT_MS = 30000;
const ROWS_PER_MUTATION = 50;
const DEFAULT_RADIUS_METERS = 3000;
const MAX_RADIUS_METERS = 10000;

const SELECTORS = [
  '["amenity"~"^(bar|pub|nightclub|biergarten|restaurant|cafe|theatre|cinema|arts_centre)$"]',
  '["tourism"~"^(museum|gallery|attraction)$"]',
  '["leisure"="park"]',
];

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const words = (value: string) => value.replace(/_/g, " ").trim();
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function classify(tags: Record<string, string>, cuisines: string[]) {
  const text = `${tags.name} ${tags.description ?? ""}`.toLowerCase();
  switch (tags.amenity) {
    case "nightclub":
      return { category: "nightlife" as const, subcategory: "nightclub" };
    case "bar":
      if (tags.cocktails === "yes" || /cocktail|speakeasy|lounge/.test(text))
        return { category: "nightlife" as const, subcategory: "cocktail bar" };
      if (/wine/.test(text)) return { category: "nightlife" as const, subcategory: "wine bar" };
      if (/karaoke/.test(text) || tags.karaoke === "yes")
        return { category: "nightlife" as const, subcategory: "karaoke bar" };
      if (tags.sport || /sports bar/.test(text))
        return { category: "nightlife" as const, subcategory: "sports bar" };
      return { category: "nightlife" as const, subcategory: "bar" };
    case "pub":
      return { category: "nightlife" as const, subcategory: "pub" };
    case "biergarten":
      return { category: "nightlife" as const, subcategory: "beer garden" };
    case "restaurant":
      return {
        category: "food" as const,
        subcategory: cuisines.length ? `${cuisines[0]} restaurant` : "restaurant",
      };
    case "cafe":
      return { category: "food" as const, subcategory: "cafe" };
    case "theatre":
      return { category: "culture" as const, subcategory: "theatre" };
    case "cinema":
      return { category: "culture" as const, subcategory: "cinema" };
    case "arts_centre":
      return { category: "culture" as const, subcategory: "arts centre" };
  }
  if (tags.leisure === "park") return { category: "outdoors" as const, subcategory: "park" };
  if (tags.tourism === "museum")
    return {
      category: "culture" as const,
      subcategory: tags.museum ? `${words(tags.museum)} museum` : "museum",
    };
  if (tags.tourism === "gallery") return { category: "culture" as const, subcategory: "gallery" };
  if (tags.tourism === "attraction")
    return { category: "culture" as const, subcategory: "attraction" };
  return null;
}

/** Map one Overpass element to an ingest row, or null when it is unnamed, unlocated, or not a kind we show. */
export function osmToRow(element: OsmElement) {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  const rawName = tags.name?.trim();
  if (!rawName || lat === undefined || lng === undefined) return null;
  const name = /[a-z0-9]/i.test(rawName) ? rawName : (tags["name:en"]?.trim() ?? rawName);
  const cuisines = (tags.cuisine ?? "")
    .split(";")
    .map(words)
    .filter(Boolean)
    .slice(0, 3);
  const kind = classify(tags, cuisines);
  if (!kind) return null;

  const flags = [
    tags.outdoor_seating && tags.outdoor_seating !== "no" ? "outdoor seating" : null,
    tags.live_music === "yes" ? "live music" : null,
    tags.lgbtq === "primary" || tags.lgbtq === "only" ? "lgbtq" : null,
    tags.microbrewery === "yes" || tags.craft === "brewery" ? "brewery" : null,
    tags.karaoke === "yes" ? "karaoke" : null,
    tags["diet:vegan"] === "only" || tags["diet:vegan"] === "yes" ? "vegan options" : null,
    tags.amenity === "restaurant" && tags.bar === "yes" ? "full bar" : null,
    tags.fee === "no" ? "free" : null,
    tags["theatre:genre"] ? words(tags["theatre:genre"].split(";")[0]) : null,
  ].filter((flag): flag is string => flag !== null);
  const rowTags = [...new Set([...cuisines, ...flags])];

  const address =
    tags["addr:housenumber"] && tags["addr:street"]
      ? `${tags["addr:housenumber"]} ${tags["addr:street"]}`
      : undefined;
  const blurb = (
    tags.description ??
    (flags.length ? [capitalize(kind.subcategory), ...flags.slice(0, 2)].join(" · ") : undefined)
  )?.slice(0, 200);
  const sourceId = `${element.type}/${element.id}`;
  return {
    source: "osm" as const,
    sourceId,
    name,
    ...kind,
    lat,
    lng,
    address,
    hours: tags.opening_hours?.slice(0, 200),
    tags: rowTags,
    sourceUrl: `https://www.openstreetmap.org/${sourceId}`,
    blurb,
    city: tags["addr:city"],
    venueVector: featurize({
      ...kind,
      tags: rowTags,
      title: name,
      description: tags.description,
    }),
  };
}

async function overpass(center: { lat: number; lng: number }, radiusMeters: number): Promise<OsmElement[]> {
  const around = `(around:${radiusMeters},${center.lat},${center.lng})`;
  const query = `[out:json][timeout:25];(${SELECTORS.map(
    (selector) => `nwr${around}${selector}["name"];`,
  ).join("")});out center tags;`;
  let lastError = "";
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        signal: abort.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!response.ok) {
        lastError = `${endpoint} answered ${response.status}`;
        continue;
      }
      const body: { elements?: OsmElement[]; remark?: string } = await response.json();
      if (body.remark || !body.elements) {
        lastError = `${endpoint}: ${body.remark ?? "no elements"}`;
        continue;
      }
      return body.elements;
    } catch (error) {
      lastError = `${endpoint}: ${error}`;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Overpass failed after ${ATTEMPTS} attempts: ${lastError}`);
}

type ImportResult = {
  fetched: number;
  byCategory: Record<string, number>;
  inserted: number;
  updated: number;
  unchanged: number;
  replaced: number;
  duplicate: number;
  dropped: number;
};

/**
 * Import named OSM places within radiusMeters of a point into `places`,
 * nearest to nearLat/nearLng (default: the centre) first: `npx convex run imports/osm:importOsm '{"lat":37.7608,"lng":-122.3861}'`.
 * `areaKey` is set when `ingest.ensureArea` schedules the import, and marks
 * that grid cell as imported once every row is written.
 */
export const importOsm = internalAction({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusMeters: v.optional(v.number()),
    nearLat: v.optional(v.number()),
    nearLng: v.optional(v.number()),
    areaKey: v.optional(v.string()),
  },
  handler: async (ctx, { lat, lng, radiusMeters, nearLat, nearLng, areaKey }): Promise<ImportResult> => {
    const radius = Math.min(MAX_RADIUS_METERS, Math.max(200, radiusMeters ?? DEFAULT_RADIUS_METERS));
    const elements = await overpass({ lat, lng }, radius);
    const near = { lat: nearLat ?? lat, lng: nearLng ?? lng };
    const rows = elements
      .map(osmToRow)
      .filter((row) => row !== null)
      .map((row) => ({ row, distance: haversineMeters(near, row) }))
      .sort((a, b) => a.distance - b.distance)
      .map(({ row }) => row);
    const result: ImportResult = {
      fetched: elements.length,
      byCategory: {},
      inserted: 0,
      updated: 0,
      unchanged: 0,
      replaced: 0,
      duplicate: 0,
      dropped: 0,
    };
    for (const row of rows) {
      result.byCategory[row.category] = (result.byCategory[row.category] ?? 0) + 1;
    }
    for (let i = 0; i < rows.length; i += ROWS_PER_MUTATION) {
      const counts = await ctx.runMutation(internal.ingest.upsertBatch, {
        kind: "place",
        rows: rows.slice(i, i + ROWS_PER_MUTATION),
      });
      result.inserted += counts.inserted;
      result.updated += counts.updated;
      result.unchanged += counts.unchanged;
      result.replaced += counts.replaced;
      result.duplicate += counts.duplicate;
      result.dropped += counts.dropped;
    }
    if (areaKey) {
      await ctx.runMutation(internal.ingest.markAreaImported, { areaKey, places: rows.length });
    }
    return result;
  },
});
