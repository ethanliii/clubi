import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { DEFAULT_RADIUS_METERS } from "./lib/discovery";
import {
  blendVectors,
  genresToVector,
  hasKnownGenre,
  MAX_PERFORMERS,
  nameKeys,
  normalizePerformerName,
  parsePerformers,
} from "./lib/performers";
import { type Feature, FEATURES } from "./lib/recs";
import { notifyPerformerFans } from "./performers";
import { categoryValidator, sourceValidator } from "./tables/catalog";

type Weights = Partial<Record<Feature, number>>;

const DEFAULT_FEATURE = 0.3;

const CATEGORY_BASE: Record<string, Weights> = {
  nightlife: { energy: 0.6, loudness: 0.6, crowdAge: 0.6, price: 0.45, dancing: 0.35, culture: 0.15, outdoors: 0.1, food: 0.2 },
  food: { energy: 0.35, loudness: 0.35, crowdAge: 0.4, price: 0.45, dancing: 0.05, liveMusic: 0.1, culture: 0.2, outdoors: 0.15, food: 0.9 },
  culture: { energy: 0.25, loudness: 0.15, crowdAge: 0.35, price: 0.35, dancing: 0.05, liveMusic: 0.15, pop: 0.2, hiphop: 0.15, electronic: 0.15, indie: 0.25, culture: 0.95, outdoors: 0.15, food: 0.1 },
  outdoors: { energy: 0.35, loudness: 0.1, crowdAge: 0.4, price: 0.05, dancing: 0.05, liveMusic: 0.1, pop: 0.2, hiphop: 0.15, electronic: 0.15, indie: 0.25, culture: 0.25, outdoors: 0.95, food: 0.1 },
  live: { energy: 0.7, loudness: 0.75, crowdAge: 0.5, price: 0.6, dancing: 0.45, liveMusic: 0.85, culture: 0.4, outdoors: 0.1, food: 0.1 },
  popup: { energy: 0.5, loudness: 0.4, crowdAge: 0.65, price: 0.3, dancing: 0.2, liveMusic: 0.2, culture: 0.5, outdoors: 0.25, food: 0.3 },
};

// A value of 0.5 or more raises the feature to at least that value; a lower
// value caps the feature at that value.
const KEYWORD_RULES: { match: RegExp; set: Weights }[] = [
  { match: /night ?club|dance club|\bdjs?\b|\brave\b|after[- ]?party|bottle service/, set: { energy: 0.9, loudness: 0.9, dancing: 0.9, electronic: 0.8, crowdAge: 0.7 } },
  { match: /techno|\bedm\b|electronic|house music|deep house|tech house|\btrance\b|drum ?(and|&|n) ?bass|dubstep|\bdisco\b/, set: { electronic: 0.9, dancing: 0.8, energy: 0.8, loudness: 0.8 } },
  { match: /dive bar|\bdive\b|\bpub\b|tavern|saloon|sports bar/, set: { loudness: 0.65, energy: 0.55, price: 0.2 } },
  { match: /cocktail|wine bar|speakeasy|\blounge\b|whiske?y|champagne|martini|\bwine\b/, set: { price: 0.75, loudness: 0.25 } },
  { match: /brewery|taproom|tap room|beer garden|biergarten|beer hall|craft beer/, set: { loudness: 0.55, price: 0.35 } },
  { match: /jazz|blues|live music|\bbands?\b|concert|open mic|acoustic|orchestra|symphony|singer|songwriter|\bgig\b/, set: { liveMusic: 0.9 } },
  { match: /hip[- ]?hop|\brap\b|r&b|\brnb\b|\btrap\b/, set: { hiphop: 0.9, energy: 0.7 } },
  { match: /\bpop\b(?![- ]?up)|top ?40|k-?pop|karaoke/, set: { pop: 0.85 } },
  { match: /karaoke/, set: { energy: 0.75, loudness: 0.75 } },
  { match: /indie|\brock\b(?! climbing)|punk|alternative|\bfolk\b|\bemo\b|shoegaze|garage/, set: { indie: 0.85 } },
  { match: /\bmetal\b|hardcore/, set: { indie: 0.7, loudness: 0.95, energy: 0.9 } },
  { match: /country|americana|bluegrass/, set: { liveMusic: 0.8, indie: 0.55 } },
  { match: /danc|salsa|bachata|reggaeton|cumbia|latin night/, set: { dancing: 0.85, energy: 0.75 } },
  { match: /latin|reggaeton|afrobeats?|dancehall/, set: { pop: 0.6, dancing: 0.75 } },
  { match: /lgbtq|\bgay\b|queer|\bdrag\b/, set: { energy: 0.7, dancing: 0.65, pop: 0.7 } },
  { match: /museum|gallery|\barts?\b|exhibit|theat(re|er)|cinema|\bfilms?\b|opera|ballet|histor|sculpture|poetry|\bbooks?\b|lecture/, set: { culture: 0.9 } },
  { match: /comedy|stand[- ]?up|improv/, set: { culture: 0.7, energy: 0.55, loudness: 0.45, liveMusic: 0.3, dancing: 0.1 } },
  { match: /\bparks?\b|\bhik(e|ing)\b|\boutdoors?\b(?! seating)|garden|beach|\btrail|picnic|playground|viewpoint|run club|cycling|kayak/, set: { outdoors: 0.85 } },
  { match: /rooftop|patio|outdoor seating|beer garden|biergarten/, set: { outdoors: 0.6 } },
  { match: /festival|block party|street fair|parade/, set: { energy: 0.8, loudness: 0.7, outdoors: 0.7 } },
  { match: /restaurant|\bfood\b|cuisine|dinner|brunch|tasting|supper|pizza|taco|ramen|sushi|bbq|barbecue|burger|bakery|\bcafe\b|coffee|dim sum|noodle/, set: { food: 0.9 } },
  // Cuisine (OpenStreetMap `cuisine`, Eventbrite food events): what kind of meal it is.
  { match: /\b(french|italian|japanese|sushi|omakase|steak ?house|seafood|oyster|tapas|kaiseki|fine dining)\b/, set: { price: 0.65, loudness: 0.35 } },
  { match: /\b(burger|pizza|tacos?|mexican|burrito|sandwich|hot ?dog|fried chicken|wings|donut|bagel|deli|diner|fast food|food truck)\b/, set: { price: 0.25, energy: 0.5 } },
  { match: /\b(coffee shop|tea|bubble tea|ice cream|dessert|bakery|pastry|juice)\b/, set: { energy: 0.25, loudness: 0.2, price: 0.25, dancing: 0.05 } },
  { match: /\b(korean bbq|hot ?pot|izakaya|dim sum|beer garden|gastropub|bar food)\b/, set: { energy: 0.65, loudness: 0.6 } },
  { match: /craft beer|\bbeers? on tap\b/, set: { loudness: 0.55, price: 0.4 } },
  { match: /21\s?\+|college|student|university|\bfrat/, set: { crowdAge: 0.85 } },
  { match: /classical|symphony|opera|wine tasting|senior/, set: { crowdAge: 0.2 } },
  { match: /\${3,}|fine dining|upscale|michelin|omakase|tasting menu/, set: { price: 0.85 } },
  { match: /\bfree\b|happy hour|\bcheap\b|budget|fast food/, set: { price: 0.15 } },
  { match: /tea ?house|book ?(store|shop)|library|meditat|\byoga\b|\bquiet\b|\bcozy\b/, set: { energy: 0.15, loudness: 0.1 } },
  { match: /\b(nba|nfl|nhl|mlb|mls|basketball|football|hockey|baseball|soccer|sports)\b/, set: { energy: 0.85, loudness: 0.85, liveMusic: 0.1 } },
  { match: /networking|meetup|founders?\b|startup|hackathon|\bpanel\b|workshop|fireside|demo day/, set: { culture: 0.6, energy: 0.35, loudness: 0.25, dancing: 0.05 } },
  // Event words: what kind of night the title promises.
  { match: /\b(house|techno|disco|amapiano|afro ?house|garage|jungle) (night|party|set|sets|music|djs?|sessions?|brunch)\b|\bopen decks\b|\bvinyl (night|set|only)\b|\bb2b\b/, set: { electronic: 0.9, dancing: 0.85, energy: 0.8, loudness: 0.8 } },
  { match: /\b(funk|soul|motown|boogie|swing|lindy hop)\b/, set: { dancing: 0.75, energy: 0.7, liveMusic: 0.6 } },
  { match: /\b(trivia|bingo|quiz night|game night|board games?)\b/, set: { energy: 0.5, loudness: 0.5, culture: 0.5, dancing: 0.05, liveMusic: 0.15 } },
  { match: /\bdrag (show|brunch|bingo|night|queen|king)|\bburlesque\b|\bcabaret\b/, set: { culture: 0.7, energy: 0.75, pop: 0.7, liveMusic: 0.5 } },
  { match: /gallery opening|opening reception|art walk|first friday|open studios?|\bvernissage\b/, set: { culture: 0.95, energy: 0.5, loudness: 0.35, price: 0.2 } },
  { match: /\brun club\b|\b5k\b|\bfun run\b|\bhike\b|\bbike ride\b|pickleball/, set: { outdoors: 0.9, energy: 0.6, loudness: 0.2, dancing: 0.05, price: 0.15 } },
  { match: /\bbrunch\b|\bbottomless\b/, set: { food: 0.85, energy: 0.6, crowdAge: 0.6 } },
  { match: /\bwine (tasting|night|club|walk)|\bnatural wine\b|\bsommelier\b/, set: { price: 0.7, loudness: 0.3, food: 0.6, crowdAge: 0.35 } },
  { match: /\bsilent disco\b|\bday ?party\b|\bdance party\b|\bday rave\b/, set: { dancing: 0.9, energy: 0.85, crowdAge: 0.7 } },
  { match: /\bspeed dating\b|\bsingles\b|\bmixer\b/, set: { crowdAge: 0.6, energy: 0.5, loudness: 0.45 } },
  { match: /sound bath|sound healing|breathwork|\bmeditation\b/, set: { energy: 0.1, loudness: 0.1, dancing: 0.05 } },
];

const priceFeature = (price: number | string | undefined) => {
  if (price === undefined) return undefined;
  if (typeof price === "string") {
    const dollars = (price.match(/\$/g) ?? []).length;
    return dollars === 0 ? undefined : [0.25, 0.45, 0.7, 0.9][Math.min(dollars, 4) - 1];
  }
  if (price <= 0) return 0.05;
  if (price <= 4 && Number.isInteger(price)) return [0.25, 0.45, 0.7, 0.9][price - 1];
  if (price <= 20) return 0.25;
  if (price <= 50) return 0.45;
  if (price <= 100) return 0.7;
  return 0.9;
};

/**
 * 13-number venueVector in FEATURES order, each 0 to 1. `price` is a 1-4 price
 * level, a "$$$" string, or a ticket price in dollars (0 = free).
 */
export function featurize(input: {
  category: string;
  subcategory?: string;
  tags?: string[];
  title?: string;
  description?: string;
  price?: number | string;
}): number[] {
  const vec: Record<Feature, number> = Object.fromEntries(
    FEATURES.map((f) => [f, DEFAULT_FEATURE]),
  ) as Record<Feature, number>;
  Object.assign(vec, CATEGORY_BASE[input.category] ?? {});
  const text = [input.category, input.subcategory, ...(input.tags ?? []), input.title, input.description]
    .filter(Boolean)
    .join(" | ")
    .toLowerCase()
    .replace(/_/g, " ");
  for (const rule of KEYWORD_RULES) {
    if (!rule.match.test(text)) continue;
    for (const [f, value] of Object.entries(rule.set) as [Feature, number][]) {
      vec[f] = value >= 0.5 ? Math.max(vec[f], value) : Math.min(vec[f], value);
    }
  }
  const price = priceFeature(input.price);
  if (price !== undefined) vec.price = price;
  return FEATURES.map((f) => Math.round(Math.min(1, Math.max(0, vec[f])) * 100) / 100);
}

export const MAX_BATCH = 100;
const PLACE_DEDUPE_METERS = 50;
const METERS_PER_DEGREE = 111_320;
const PLACE_DEDUPE_DEGREES = PLACE_DEDUPE_METERS / METERS_PER_DEGREE;
const EVENT_DEDUPE_MS = 60 * 60 * 1000;
// Two sources' rows are one event when they start within the hour, within 200 m of each other,
// and have the same title or the same headliner.
const EVENT_DEDUPE_METERS = 200;
// Partiful and guests-only Luma events give a point rounded to about a kilometre.
const APPROXIMATE_DEDUPE_METERS = 1500;
const APPROXIMATE_TAG = "approximate location";
const MAX_OTHER_URLS = 4;
const VENUE_MATCH_METERS = 150;
const VENUE_MATCH_DEGREES = VENUE_MATCH_METERS / METERS_PER_DEGREE;
const VENUE_BAND_LIMIT = 400;
const EVENT_LINK_LIMIT = 20;
/** Share of an event's vector that comes from its performers' genres, when we know them. */
const PERFORMER_VECTOR_WEIGHT = 0.4;
const ASSUMED_EVENT_MS = 3 * 60 * 60 * 1000;
// Hand-set rows are never overwritten or replaced by an import.
const PROTECTED_SOURCES = ["seed", "manual"] as const;
const FROZEN_KEY = "ingestFrozen";

/** Who is on at an event. `genres` and `imageUrl` come from sources that know them (Ticketmaster attractions). */
export const performerInput = v.object({
  name: v.string(),
  sourceId: v.optional(v.string()),
  genres: v.optional(v.array(v.string())),
  imageUrl: v.optional(v.string()),
  kind: v.optional(v.string()),
});
type PerformerInput = typeof performerInput.type;

/**
 * One imported place or event. `start` (ms epoch) is required for events. `performers` (headliner
 * first) and `venueName` are for events; `website` and `phone` are for places.
 */
export const ingestRow = v.object({
  source: sourceValidator,
  sourceId: v.string(),
  name: v.string(),
  category: categoryValidator,
  subcategory: v.optional(v.string()),
  lat: v.number(),
  lng: v.number(),
  address: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  sourceUrl: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  blurb: v.optional(v.string()),
  venueVector: v.optional(v.array(v.number())),
  hours: v.optional(v.string()),
  priceLevel: v.optional(v.number()),
  city: v.optional(v.string()),
  start: v.optional(v.number()),
  end: v.optional(v.number()),
  price: v.optional(v.union(v.number(), v.string())),
  ticketUrl: v.optional(v.string()),
  performers: v.optional(v.array(performerInput)),
  venueName: v.optional(v.string()),
  website: v.optional(v.string()),
  phone: v.optional(v.string()),
});
type IngestRow = typeof ingestRow.type;

const GENERIC_NAME_ENDINGS = /( (cafe|restaurant|bar|company|co|inc|sf))+$/;

/** Key for comparing names: "Bloom's Saloon" and "Blooms Saloon" match, as do "Just For You" and "Just For You Cafe". */
export const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f'’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the /, "")
    .replace(GENERIC_NAME_ENDINGS, "") || name.trim().toLowerCase();

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const richness = (row: Record<string, unknown>) =>
  ["subcategory", "address", "hours", "sourceUrl", "imageUrl", "blurb", "priceLevel", "end", "price", "ticketUrl", "venueName", "performerNames", "website", "phone"].filter(
    (k) => row[k] !== undefined && row[k] !== "",
  ).length + (Array.isArray(row.tags) ? Math.min(row.tags.length, 3) : 0);

const isProtected = (source: string | undefined) =>
  (PROTECTED_SOURCES as readonly string[]).includes(source ?? "");

export const readConfig = (ctx: QueryCtx, key: string) =>
  ctx.db
    .query("appConfig")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

export async function writeConfig(ctx: MutationCtx, key: string, value: unknown) {
  const row = await readConfig(ctx, key);
  if (row) await ctx.db.patch(row._id, { value });
  else await ctx.db.insert("appConfig", { key, value });
}

const readFrozen = async (ctx: QueryCtx) => (await readConfig(ctx, FROZEN_KEY))?.value === true;

const differs = (doc: Record<string, unknown>, fields: Record<string, unknown>) =>
  Object.entries(fields).some(([key, value]) => JSON.stringify(doc[key]) !== JSON.stringify(value));

type Outcome = "inserted" | "updated" | "unchanged" | "replaced" | "duplicate";

async function upsertPlace(ctx: MutationCtx, row: IngestRow, nameKey: string): Promise<Outcome> {
  const fields = {
    name: row.name.trim(),
    category: row.category,
    subcategory: row.subcategory,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    hours: row.hours,
    tags: row.tags ?? [],
    source: row.source,
    sourceId: row.sourceId,
    sourceUrl: row.sourceUrl,
    imageUrl: row.imageUrl,
    blurb: row.blurb,
    priceLevel: row.priceLevel,
    city: row.city,
    website: row.website,
    phone: row.phone,
    venueVector:
      row.venueVector ??
      featurize({ ...row, title: row.name, description: row.blurb, price: row.priceLevel }),
  };
  const same = await ctx.db
    .query("places")
    .withIndex("by_source", (q) => q.eq("source", row.source).eq("sourceId", row.sourceId))
    .first();
  if (same) {
    // Details the source does not have may have come from enrichment (imports/google.ts): keep them.
    const merged = {
      ...fields,
      address: fields.address ?? same.address,
      hours: fields.hours ?? same.hours,
      imageUrl: fields.imageUrl ?? same.imageUrl,
      priceLevel: fields.priceLevel ?? same.priceLevel,
      website: fields.website ?? same.website,
      phone: fields.phone ?? same.phone,
    };
    if (!differs(same, merged)) return "unchanged";
    await ctx.db.patch(same._id, merged);
    return "updated";
  }
  const band = await ctx.db
    .query("places")
    .withIndex("by_lat", (q) =>
      q.gte("lat", row.lat - PLACE_DEDUPE_DEGREES).lte("lat", row.lat + PLACE_DEDUPE_DEGREES),
    )
    .collect();
  const duplicate = band.find(
    (p) => normalizeName(p.name) === nameKey && haversineMeters(p, row) <= PLACE_DEDUPE_METERS,
  );
  if (!duplicate) {
    await ctx.db.insert("places", { ...fields, elo: 0, nComparisons: 0 });
    return "inserted";
  }
  if (isProtected(duplicate.source) || (!isProtected(row.source) && richness(duplicate) >= richness(fields))) return "duplicate";
  await ctx.db.patch(duplicate._id, {
    ...fields,
    address: fields.address ?? duplicate.address,
    hours: fields.hours ?? duplicate.hours,
    imageUrl: fields.imageUrl ?? duplicate.imageUrl,
    blurb: fields.blurb ?? duplicate.blurb,
    priceLevel: fields.priceLevel ?? duplicate.priceLevel,
    website: fields.website ?? duplicate.website,
    phone: fields.phone ?? duplicate.phone,
  });
  return "replaced";
}

type LineupEntry = { name: string; existing?: Doc<"performers">; input?: PerformerInput };

async function findPerformer(ctx: QueryCtx, name: string): Promise<Doc<"performers"> | null> {
  for (const key of nameKeys(name)) {
    const hit = await ctx.db
      .query("performers")
      .withIndex("by_normalizedName", (q) => q.eq("normalizedName", key))
      .first();
    if (hit) return hit;
  }
  return null;
}

/**
 * Who is on at this event, headliner first. A row that names its performers creates the ones we
 * do not have yet. A row with only a title is matched against performers we already have and
 * never creates one: a wrong performer sends a wrong alert.
 */
async function resolveLineup(ctx: QueryCtx, row: IngestRow): Promise<LineupEntry[]> {
  const lineup: LineupEntry[] = [];
  const seen = new Set<string>();
  const add = (entry: LineupEntry) => {
    const key = entry.existing?.normalizedName ?? normalizePerformerName(entry.name);
    if (!key || seen.has(key) || lineup.length >= MAX_PERFORMERS) return;
    seen.add(key);
    lineup.push(entry);
  };
  if (row.performers?.length) {
    for (const input of row.performers.slice(0, MAX_PERFORMERS * 2)) {
      const name = input.name.trim();
      if (!name) continue;
      const existing = (await findPerformer(ctx, name)) ?? undefined;
      add({ name: existing?.name ?? name, existing, input });
    }
    return lineup;
  }
  const candidates = new Set([row.name.trim(), ...parsePerformers(row.name, { solo: true })]);
  for (const name of candidates) {
    const existing = await findPerformer(ctx, name);
    if (existing) add({ name: existing.name, existing });
  }
  return lineup;
}

/** Create or fill in the performers of an event and make `eventPerformers` match the line-up. */
async function linkLineup(ctx: MutationCtx, eventId: Id<"events">, start: number, lineup: LineupEntry[], source: string) {
  const ids: Id<"performers">[] = [];
  for (const { name, existing, input } of lineup) {
    if (!existing) {
      ids.push(
        await ctx.db.insert("performers", {
          name,
          normalizedName: normalizePerformerName(name),
          kind: input?.kind,
          genres: input?.genres,
          imageUrl: input?.imageUrl,
          source,
          sourceId: input?.sourceId,
          vector: genresToVector(input?.genres ?? []),
        }),
      );
      continue;
    }
    ids.push(existing._id);
    if (!input) continue;
    // Fill gaps only: what a richer source already told us stays.
    const patch: Partial<Doc<"performers">> = {};
    if (!existing.genres?.length && input.genres?.length) {
      patch.genres = input.genres;
      patch.vector = genresToVector(input.genres);
    }
    if (!existing.imageUrl && input.imageUrl) patch.imageUrl = input.imageUrl;
    if (!existing.kind && input.kind) patch.kind = input.kind;
    if (!existing.sourceId && input.sourceId) {
      patch.sourceId = input.sourceId;
      patch.source = source;
    }
    if (Object.keys(patch).length) await ctx.db.patch(existing._id, patch);
  }
  const links = await ctx.db
    .query("eventPerformers")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .take(EVENT_LINK_LIMIT);
  const linked = new Set<Id<"performers">>();
  for (const link of links) {
    if (!ids.includes(link.performerId) || linked.has(link.performerId)) await ctx.db.delete(link._id);
    else {
      linked.add(link.performerId);
      if (link.start !== start) await ctx.db.patch(link._id, { start });
    }
  }
  for (const performerId of ids) {
    if (!linked.has(performerId)) await ctx.db.insert("eventPerformers", { eventId, performerId, start });
  }
}

/** A performer's genre vector, or null when we know no genre for them (a neutral vector would only blur the event). */
function lineupVector({ existing, input }: LineupEntry): number[] | null {
  const genres = existing?.genres?.length ? existing.genres : (input?.genres ?? []);
  if (!hasKnownGenre(genres)) return null;
  return existing?.genres?.length && existing.vector?.length === FEATURES.length ? existing.vector : genresToVector(genres);
}

/** `otherUrls` with one more page added, or null when there is nothing new to add. */
function withOtherUrl(event: { sourceUrl?: string; otherUrls?: string[] }, url: string | undefined): string[] | null {
  if (!url || url === event.sourceUrl || event.otherUrls?.includes(url)) return null;
  return [...(event.otherUrls ?? []), url].slice(-MAX_OTHER_URLS);
}

type VenueCache = Map<string, Id<"places"> | null>;

/** The catalog place an event is at: same normalised name as `venueName` within 150 m. */
async function findVenuePlace(ctx: QueryCtx, row: IngestRow, cache: VenueCache): Promise<Id<"places"> | null> {
  const venueKey = row.venueName ? normalizeName(row.venueName) : "";
  if (!venueKey) return null;
  const cacheKey = `${venueKey}|${row.lat.toFixed(4)}|${row.lng.toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;
  const band = await ctx.db
    .query("places")
    .withIndex("by_lat", (q) => q.gte("lat", row.lat - VENUE_MATCH_DEGREES).lte("lat", row.lat + VENUE_MATCH_DEGREES))
    .take(VENUE_BAND_LIMIT);
  let best: { id: Id<"places">; meters: number } | null = null;
  for (const place of band) {
    if (normalizeName(place.name) !== venueKey) continue;
    const meters = haversineMeters(place, row);
    if (meters <= VENUE_MATCH_METERS && (!best || meters < best.meters)) best = { id: place._id, meters };
  }
  cache.set(cacheKey, best?.id ?? null);
  return best?.id ?? null;
}

async function upsertEvent(ctx: MutationCtx, row: IngestRow, nameKey: string, start: number, venues: VenueCache): Promise<Outcome> {
  const lineup = await resolveLineup(ctx, row);
  const fields = {
    title: row.name.trim(),
    start,
    end: row.end,
    lat: row.lat,
    lng: row.lng,
    category: row.category,
    subcategory: row.subcategory,
    tags: row.tags ?? [],
    address: row.address,
    city: row.city,
    price: row.price,
    imageUrl: row.imageUrl,
    ticketUrl: row.ticketUrl,
    sourceUrl: row.sourceUrl,
    source: row.source,
    sourceId: row.sourceId,
    blurb: row.blurb,
    venueName: row.venueName?.trim() || undefined,
    performerNames: lineup.length ? lineup.map((entry) => entry.name) : undefined,
    // Who is playing says more about the night than the title: blend their genre vectors in.
    venueVector: blendVectors(
      row.venueVector ?? featurize({ ...row, title: row.name, description: row.blurb }),
      lineup.map(lineupVector).filter((vector): vector is number[] => vector !== null),
      PERFORMER_VECTOR_WEIGHT,
    ),
  };
  // After a write to an event that already existed. Fans hear about an event once, when it is
  // first stored with a line-up: a later update never notifies again.
  const afterUpdate = async (existing: Doc<"events">) => {
    await linkLineup(ctx, existing._id, start, lineup, row.source);
    if (!existing.placeId) {
      const placeId = await findVenuePlace(ctx, row, venues);
      if (placeId) await ctx.db.patch(existing._id, { placeId });
    }
    if (lineup.length && !existing.performerNames?.length) await notifyPerformerFans(ctx, existing._id);
  };
  const same = await ctx.db
    .query("events")
    .withIndex("by_source", (q) => q.eq("source", row.source).eq("sourceId", row.sourceId))
    .first();
  if (same) {
    // A source can answer with less on a later read (Eventbrite's listing has no price, its
    // detail call does): what it told us before stays until it says something else.
    const merged = {
      ...fields,
      end: fields.end ?? same.end,
      price: fields.price ?? same.price,
      imageUrl: fields.imageUrl ?? same.imageUrl,
      ticketUrl: fields.ticketUrl ?? same.ticketUrl,
      blurb: fields.blurb ?? same.blurb,
      venueName: fields.venueName ?? same.venueName,
      // The vector was built with the price: a read without one must not undo that.
      venueVector:
        fields.price === undefined && same.price !== undefined ? (same.venueVector ?? fields.venueVector) : fields.venueVector,
    };
    if (!differs(same, merged)) return "unchanged";
    await ctx.db.patch(same._id, merged);
    await afterUpdate(same);
    return "updated";
  }
  const window = await ctx.db
    .query("events")
    .withIndex("by_start", (q) =>
      q.gte("start", start - EVENT_DEDUPE_MS).lte("start", start + EVENT_DEDUPE_MS),
    )
    .collect();
  const headliner = lineup[0] ? normalizePerformerName(lineup[0].name) : undefined;
  const approximate = (tags: string[] | undefined) => tags?.includes(APPROXIMATE_TAG) ?? false;
  const duplicate = window.find(
    (e) =>
      haversineMeters(e, row) <= (approximate(e.tags) || approximate(row.tags) ? APPROXIMATE_DEDUPE_METERS : EVENT_DEDUPE_METERS) &&
      (normalizeName(e.title) === nameKey ||
        (headliner !== undefined && e.performerNames?.[0] !== undefined && normalizePerformerName(e.performerNames[0]) === headliner)),
  );
  if (!duplicate) {
    const placeId = (await findVenuePlace(ctx, row, venues)) ?? undefined;
    const eventId = await ctx.db.insert("events", { ...fields, placeId, createdAt: Date.now(), elo: 0, nComparisons: 0 });
    await linkLineup(ctx, eventId, start, lineup, row.source);
    if (lineup.length) await notifyPerformerFans(ctx, eventId);
    return "inserted";
  }
  if (isProtected(duplicate.source) || (!isProtected(row.source) && richness(duplicate) >= richness(fields))) {
    // The other source's row stays; this source's page is remembered next to it.
    const otherUrls = withOtherUrl(duplicate, row.sourceUrl);
    if (otherUrls) await ctx.db.patch(duplicate._id, { otherUrls });
    // A line-up the kept row did not have is worth keeping too.
    if (lineup.length && !duplicate.performerNames?.length) {
      await ctx.db.patch(duplicate._id, { performerNames: fields.performerNames });
      await linkLineup(ctx, duplicate._id, duplicate.start, lineup, row.source);
      await notifyPerformerFans(ctx, duplicate._id);
    }
    return "duplicate";
  }
  await ctx.db.patch(duplicate._id, {
    ...fields,
    end: fields.end ?? duplicate.end,
    price: fields.price ?? duplicate.price,
    imageUrl: fields.imageUrl ?? duplicate.imageUrl,
    ticketUrl: fields.ticketUrl ?? duplicate.ticketUrl,
    blurb: fields.blurb ?? duplicate.blurb,
    venueName: fields.venueName ?? duplicate.venueName,
    performerNames: fields.performerNames ?? duplicate.performerNames,
    // The row now belongs to the richer source: keep the page it had before.
    otherUrls: withOtherUrl({ ...duplicate, sourceUrl: fields.sourceUrl }, duplicate.sourceUrl) ?? duplicate.otherUrls,
  });
  if (lineup.length) await afterUpdate(duplicate);
  return "replaced";
}

type Counts = { inserted: number; updated: number; unchanged: number; replaced: number; duplicate: number; dropped: number; frozen: boolean };

/**
 * The work of `upsertBatch`, for mutations that write catalog rows themselves (convex/catalog.ts).
 * `ignoreFreeze` is for rows a person adds by hand: the freeze is about imports.
 */
export async function upsertRows(
  ctx: MutationCtx,
  kind: "place" | "event",
  rows: IngestRow[],
  options: { ignoreFreeze?: boolean } = {},
): Promise<Counts> {
  if (rows.length > MAX_BATCH) throw new Error("upsertBatch takes at most " + MAX_BATCH + " rows");
  const counts: Counts = { inserted: 0, updated: 0, unchanged: 0, replaced: 0, duplicate: 0, dropped: 0, frozen: false };
  if (kind === "event" && !options.ignoreFreeze && (await readFrozen(ctx))) return { ...counts, frozen: true };
  const now = Date.now();
  const venues: VenueCache = new Map();
  for (const row of rows) {
    const nameKey = normalizeName(row.name);
    const located = Number.isFinite(row.lat) && Number.isFinite(row.lng);
    const past =
      kind === "event" &&
      (row.start === undefined || (row.end ?? row.start + ASSUMED_EVENT_MS) < now);
    if (!nameKey || !located || past) {
      counts.dropped++;
      continue;
    }
    counts[
      kind === "place"
        ? await upsertPlace(ctx, row, nameKey)
        : await upsertEvent(ctx, row, nameKey, row.start!, venues)
    ]++;
  }
  return counts;
}

/**
 * Upsert up to MAX_BATCH places or events by source + sourceId. A row with the
 * same name within 50 m (places), or the same title or headliner starting
 * within 1 h and within 200 m (events), is a duplicate: the richer row is
 * kept, the other source's page goes into `otherUrls`, and hand-set rows always
 * win. Unnamed rows and past events are dropped. Events also get their
 * performers stored and linked, a `placeId` when the venue is a catalog place,
 * and, the first time they are stored with a line-up, the artist alert. Event batches write nothing
 * while the ingest is frozen; place batches are not part of the freeze.
 */
export const upsertBatch = internalMutation({
  args: {
    kind: v.union(v.literal("place"), v.literal("event")),
    rows: v.array(ingestRow),
  },
  handler: (ctx, { kind, rows }) => upsertRows(ctx, kind, rows),
});

const MAX_KNOWN_IDS = 300;

/** Which of these source ids are already stored, so an import only fetches details for new ones. */
export const knownSourceIds = internalQuery({
  args: {
    kind: v.union(v.literal("place"), v.literal("event")),
    source: sourceValidator,
    sourceIds: v.array(v.string()),
  },
  handler: async (ctx, { kind, source, sourceIds }): Promise<string[]> => {
    const known: string[] = [];
    for (const sourceId of [...new Set(sourceIds)].slice(0, MAX_KNOWN_IDS)) {
      const row = await ctx.db
        .query(kind === "place" ? "places" : "events")
        .withIndex("by_source", (q) => q.eq("source", source).eq("sourceId", sourceId))
        .first();
      if (row) known.push(sourceId);
    }
    return known;
  },
});

export const isIngestFrozen = internalQuery({
  args: {},
  handler: (ctx) => readFrozen(ctx),
});

/**
 * Data freeze switch for the event imports (Luma, Partiful):
 * `npx convex run ingest:setIngestFrozen '{"frozen": true}'`.
 * OSM place imports from ensureArea are not frozen.
 */
export const setIngestFrozen = internalMutation({
  args: { frozen: v.boolean() },
  handler: async (ctx, { frozen }) => {
    await writeConfig(ctx, FROZEN_KEY, frozen);
    return { ingestFrozen: frozen };
  },
});

const AREA_CELL_DEGREES = 0.02;
const AREA_FRESH_MS = 24 * 60 * 60 * 1000;
const AREA_RETRY_MS = 5 * 60 * 1000;
const AREA_BUDGET_KEY = "osmAreaBudget";
const AREA_BUDGET_PER_HOUR = 40;
const HOUR_MS = 60 * 60 * 1000;

type AreaStatus = "fresh" | "importing" | "scheduled" | "throttled";

/**
 * Make sure the map has OSM places around a location. Snaps the location to a
 * 0.02 degree grid cell; when that cell has not been imported in the last 24
 * hours it records the cell in appConfig and schedules importOsm for it. The
 * import radius reaches the default discovery radius from every point of the
 * cell, and rows nearest the caller are written first.
 * Callable without signing in: an already imported cell costs one read, and
 * new cells are capped per hour across all callers.
 */
export const ensureArea = mutation({
  args: { lat: v.number(), lng: v.number() },
  handler: async (ctx, { lat, lng }): Promise<{ status: AreaStatus; areaKey: string }> => {
    if (!(Math.abs(lat) <= 85) || !(Math.abs(lng) <= 180)) throw new Error("Invalid location");
    const latCell = Math.floor(lat / AREA_CELL_DEGREES);
    const lngCell = Math.floor(lng / AREA_CELL_DEGREES);
    const areaKey = `osmArea:${latCell}:${lngCell}`;
    const now = Date.now();
    const area: { requestedAt?: number; importedAt?: number } =
      (await readConfig(ctx, areaKey))?.value ?? {};
    if (area.importedAt !== undefined && now - area.importedAt < AREA_FRESH_MS) {
      return { status: "fresh", areaKey };
    }
    if (area.requestedAt !== undefined && now - area.requestedAt < AREA_RETRY_MS) {
      return { status: "importing", areaKey };
    }
    const budget: { windowStart: number; count: number } =
      (await readConfig(ctx, AREA_BUDGET_KEY))?.value ?? { windowStart: now, count: 0 };
    const inWindow = now - budget.windowStart < HOUR_MS;
    if (inWindow && budget.count >= AREA_BUDGET_PER_HOUR) return { status: "throttled", areaKey };
    await writeConfig(ctx, AREA_BUDGET_KEY, {
      windowStart: inWindow ? budget.windowStart : now,
      count: inWindow ? budget.count + 1 : 1,
    });
    await writeConfig(ctx, areaKey, { ...area, requestedAt: now });
    const centerLat = (latCell + 0.5) * AREA_CELL_DEGREES;
    const halfCellMeters = (AREA_CELL_DEGREES / 2) * METERS_PER_DEGREE;
    const cornerMeters = Math.hypot(
      halfCellMeters,
      halfCellMeters * Math.cos((centerLat * Math.PI) / 180),
    );
    await ctx.scheduler.runAfter(0, internal.imports.osm.importOsm, {
      lat: centerLat,
      lng: (lngCell + 0.5) * AREA_CELL_DEGREES,
      radiusMeters: Math.ceil(DEFAULT_RADIUS_METERS + cornerMeters),
      nearLat: lat,
      nearLng: lng,
      areaKey,
    });
    return { status: "scheduled", areaKey };
  },
});

export const markAreaImported = internalMutation({
  args: { areaKey: v.string(), places: v.number() },
  handler: async (ctx, { areaKey, places }) => {
    const area = (await readConfig(ctx, areaKey))?.value ?? {};
    await writeConfig(ctx, areaKey, { ...area, importedAt: Date.now(), places });
  },
});

/** Row counts for one category, split by source, with rows missing a 13-number venueVector. */
export const countCategory = internalQuery({
  args: { kind: v.union(v.literal("place"), v.literal("event")), category: categoryValidator },
  handler: async (ctx, { kind, category }) => {
    const rows = await ctx.db
      .query(kind === "place" ? "places" : "events")
      .withIndex("by_category", (q) => q.eq("category", category))
      .collect();
    const bySource: Record<string, number> = {};
    let missingVector = 0;
    for (const row of rows) {
      const source = row.source ?? "unknown";
      bySource[source] = (bySource[source] ?? 0) + 1;
      if (row.venueVector?.length !== FEATURES.length) missingVector++;
    }
    return { total: rows.length, bySource, missingVector };
  },
});
