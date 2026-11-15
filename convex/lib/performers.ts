// Owner: Data session. Pure code: performer names, genre vectors, affinity and the alert rule
// (docs/ALGORITHM.md section 4). No runtime Convex imports, so `node --test` can load it.
import { FEATURES, similarity, type Feature } from "./recs";

export const AFFINITY_NEUTRAL = 5;
export const AFFINITY_MIN_STEP = 0.3;
export const SUPPORT_ACT_STEP = 0.5;
export const FOLLOW_FLOOR = 8;
export const SPILL_KAPPA = 0.5;
export const SPILL_MIN_SIM = 0.6;
export const PERFORMER_RHO = 1.5;
export const ALERT_MIN_AFFINITY = 7.5;
export const ALERT_RADIUS_KM = 60;
export const ALERT_MAX_PER_DAY = 2;
export const ALERT_HORIZON_DAYS = 120;
/** The Data brief alerts users who have not set a home city; ALGORITHM.md 4.2 would not. One switch. */
export const ALERT_WITHOUT_HOME_CITY = true;
export const MAX_PERFORMERS = 5;
export const MAX_NAME_WORDS = 5;
export const MAX_NAME_LENGTH = 40;
export const FUZZY_MIN_LENGTH = 6;
export const DEFAULT_TIME_ZONE = "America/Los_Angeles";
const DAY_MS = 24 * 60 * 60 * 1000;

// ───────────────────────────── names ─────────────────────────────

/** Key for comparing performer names: "The Chainsmokers" = "chainsmokers", "Beyoncé" = "beyonce", "Above & Beyond" = "above and beyond". */
export function normalizePerformerName(name: string): string {
  const key = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ'’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^the /, "");
  return key || name.trim().toLowerCase();
}

const withoutDj = (key: string) => key.replace(/^dj /, "");

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i);
}

/** Same performer after normalising: equal, equal without a leading "DJ", or one typo apart for names of 6+ characters. */
export function sameName(a: string, b: string): boolean {
  const x = normalizePerformerName(a);
  const y = normalizePerformerName(b);
  if (x === "" || y === "") return false;
  if (x === y || withoutDj(x) === withoutDj(y)) return true;
  return Math.min(x.length, y.length) >= FUZZY_MIN_LENGTH && editDistanceAtMostOne(x, y);
}

/** The keys to look a name up by: itself, without "dj ", and with it. */
export function nameKeys(name: string): string[] {
  const key = normalizePerformerName(name);
  if (!key) return [];
  const bare = withoutDj(key);
  return [...new Set([key, bare, "dj " + bare])].filter(Boolean);
}

// A piece of a title containing any of these words is not a performer.
const GENERIC_WORDS = new Set(
  (
    "monday tuesday wednesday thursday friday saturday sunday weekend weekly monthly daily annual nightly tonight " +
    "january february march april june july august september october november december " +
    "night nights party parties market markets brunch lunch dinner supper breakfast happy hour open mic trivia karaoke " +
    "festival fest meetup meetups friends guests guest more tba tbd workshop workshops class classes lesson lessons " +
    "show shows showcase concert concerts tickets ticket free live music annual edition vol volume session sessions " +
    "social mixer club dance dancing experience celebration release launch series presents tribute halloween nye " +
    "christmas holiday holidays thanksgiving valentines pride birthday anniversary networking yoga run hike food " +
    "wine drinks beer coffee cocktails art arts tech startup startups founders investors community fundraiser gala " +
    "benefit screening film movie movies book books poetry crafts vibes pop popup rave afterparty opening closing " +
    "reception tour tasting sale swap bazaar fair expo conference summit panel talk talks lecture seminar webinar " +
    "course bootcamp hackathon demo game games tournament league bingo quiz crawl cruise picnic potluck bbq " +
    "beginner beginners intro introduction every bar pub lounge rooftop patio jam cypher battle competition contest " +
    "awards ceremony recital residency takeover special various artists lineup djs bands silent disco " +
    "day evening morning afternoon sunset sunrise midnight headline comedy standup " +
    // words of a sentence, not of a name: "Love Is a Place", "Finding Your Voice"
    "is are your my our we you this that it its for to how why what who"
  ).split(" "),
);
// A piece that starts with a genre or scene word is a night, not an act: "Latin Sundays", "Bachata in North Beach".
const GENRE_LEADS = new Set(
  (
    "bachata salsa latin jazz blues techno house disco reggaeton hip hiphop rnb soul funk comedy improv emo indie " +
    "rock punk metal country kpop afrobeats edm trance dnb queer gay lesbian drag burlesque open local all"
  ).split(" "),
);
const GENERIC_PHRASES = /^(special guests?|and more|many more|more tba|friends|guests|support|tba|tbd|local support|surprise guests?|open decks)$/;

const BRACKETS = /\s*[([{][^)\]}]*[)\]}]\s*/g;
const PRESENTS = /^(.*?)\b(?:presents?|starring)\b:?\s+(.+)$/i;
const VENUE_CUT = /\s+(?:at|@)\s+|\s*@\s*|\s+[|—–-]\s+|\s*[|:]\s+|\s+live in\s+|\s+in concert\b/i;
const TRAILERS =
  /[\s,.:!-]+(?:live!?|headline show|tour|world tour|north american tour|us tour|album release|sold out|21\s?\+|18\s?\+|all ages|(?:19|20)\d\d|dj set|live set|& friends|and friends|\+ friends)$/i;
const STRONG_SPLIT = /\s+(?:b2b|b3b|w\/|feat\.?|ft\.?|featuring|vs\.?)\s+/i;
// Lowercase "x" only, so "DJ X" stays a name.
const WEAK_SPLIT = /\s+(?:with|and)\s+|\s+[+&×]\s+|\s+x\s+|\s*,\s*|\s+\/\s+/;
const CASE_FREE = (pattern: RegExp, text: string) => text.split(new RegExp(pattern.source, "i"));

function isGenericPiece(piece: string): boolean {
  const key = normalizePerformerName(piece);
  if (key.length < 2 || piece.length > MAX_NAME_LENGTH || !/\p{L}/u.test(key)) return true;
  if (GENERIC_PHRASES.test(key)) return true;
  const tokens = key.split(" ");
  if (tokens.length > MAX_NAME_WORDS) return true;
  if (GENRE_LEADS.has(tokens[0])) return true;
  return tokens.some(
    (token) => GENERIC_WORDS.has(token) || GENERIC_WORDS.has(token.replace(/s$/, "")) || /^\d+(st|nd|rd|th|yr|hr)$/.test(token),
  );
}

function stripTrailers(text: string): string {
  let out = text.trim();
  for (let i = 0; i < 4; i++) {
    const next = out.replace(TRAILERS, "").trim();
    if (next === out) break;
    out = next;
  }
  return out.replace(/^[\s"'“”]+|[\s"'“”!.,:;-]+$/g, "");
}

function splitLineup(text: string): { pieces: string[]; strong: boolean } {
  const strongParts = text.split(STRONG_SPLIT);
  const pieces = strongParts.flatMap((part) =>
    // "with" / "and" are matched in any case; the bare "x" only in lower case.
    part.split(WEAK_SPLIT).flatMap((p) => CASE_FREE(/\s+(?:with|and)\s+/, p)),
  );
  return { pieces: pieces.map(stripTrailers).filter(Boolean), strong: strongParts.length > 1 };
}

export type ParseOptions = {
  /** Accept a bare title ("Khruangbin") as one name. Only for events already known to be a performance. */
  solo?: boolean;
  /** True when a normalised name is a performer we already have: keeps "Above & Beyond" in one piece. */
  known?: (normalizedName: string) => boolean;
};

/**
 * Performer names in an event title, headliner first, at most 5. Conservative: a title only yields
 * names when it has a line-up cue (" at ", "@", "b2b", "w/", "feat.", "presents", "+", "&", a comma)
 * and no piece that reads like an occasion ("Sunday Farmers Market" gives nothing).
 */
export function parsePerformers(title: string, options: ParseOptions = {}): string[] {
  let text = title.replace(BRACKETS, " ").replace(/\s+/g, " ").trim();
  if (!text) return [];
  let cue = false;
  const presented = text.match(PRESENTS);
  if (presented) {
    text = presented[2];
    cue = true;
  }
  const head = text.split(VENUE_CUT)[0];
  if (head.length < text.length) cue = true;
  const lineup = stripTrailers(head);
  if (lineup !== head.trim()) cue = true;
  if (!lineup) return [];

  if (options.known?.(normalizePerformerName(lineup))) return [lineup];
  const { pieces, strong } = splitLineup(lineup);
  if (pieces.length > 1 || strong) cue = true;
  if (!cue && !options.solo) return [];
  // One generic piece ("Jazz Night w/ Friends") means the line is an occasion, except that
  // trailing filler ("+ special guests", "& more") is simply dropped.
  const names: string[] = [];
  const seen = new Set<string>();
  for (const [index, piece] of pieces.entries()) {
    const key = normalizePerformerName(piece);
    if (GENERIC_PHRASES.test(key)) continue;
    if (isGenericPiece(piece)) {
      if (index === 0) return [];
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(piece);
  }
  return names.slice(0, MAX_PERFORMERS);
}

/** Name used in docs/ALGORITHM.md 4.3. */
export const extractPerformerNames = parsePerformers;

/** True when the title itself says who is on: " at ", "@", "b2b", "presents" (ALGORITHM.md 4.3: when a performer may be created from a title). */
export const titleNamesLineup = (title: string) =>
  /\s(?:at|@|b2b|w\/|feat\.?|ft\.?|featuring)\s|\b(?:presents?|starring)\b/i.test(title);

// ───────────────────────────── genre vectors ─────────────────────────────

type Weights = Partial<Record<Feature, number>>;

const PERFORMER_BASE: Weights = {
  energy: 0.6, loudness: 0.6, crowdAge: 0.5, price: 0.5, dancing: 0.3, liveMusic: 0.7,
  pop: 0.3, hiphop: 0.3, electronic: 0.3, indie: 0.3, culture: 0.35, outdoors: 0.1, food: 0.05,
};

// A value of 0.5 or more raises the feature to at least that value; a lower value caps it
// (the same rule as the featurizer in convex/ingest.ts, which also runs these on event text).
export const GENRE_RULES: { match: RegExp; set: Weights }[] = [
  { match: /\b(house|techno|edm|electronic|electronica|trance|dubstep|electro|drum (and|&|n) bass|dnb|d&b|bass music|hardstyle|garage|club)\b|dance\/electronic/, set: { electronic: 0.9, dancing: 0.85, energy: 0.85, loudness: 0.8, liveMusic: 0.4 } },
  { match: /\b(disco|funk|nu[- ]disco|boogie)\b/, set: { dancing: 0.85, energy: 0.75, electronic: 0.6, pop: 0.55 } },
  { match: /hip[- ]?hop|\b(rap|trap|drill|grime)\b/, set: { hiphop: 0.9, energy: 0.75, loudness: 0.75 } },
  { match: /r&b|\b(rnb|soul|neo[- ]soul|motown)\b/, set: { hiphop: 0.7, pop: 0.55, dancing: 0.5 } },
  { match: /\bpop\b(?![- ]?up)|top ?40|k-?pop|j-?pop|synthpop/, set: { pop: 0.9, dancing: 0.55 } },
  { match: /\b(latin|reggaeton|salsa|bachata|cumbia|merengue|afrobeats?|amapiano|dancehall|reggae|soca|banda|corridos|regional mexican)\b/, set: { pop: 0.6, dancing: 0.85, energy: 0.75 } },
  { match: /\b(rock|indie|alternative|punk|emo|shoegaze|grunge|post[- ]punk|new wave|psych|psychedelic)\b/, set: { indie: 0.85, liveMusic: 0.85 } },
  { match: /\b(metal|hardcore|punk|thrash)\b/, set: { indie: 0.7, loudness: 0.95, energy: 0.9 } },
  { match: /\b(folk|acoustic|singer[- ]songwriter|country|americana|bluegrass)\b/, set: { liveMusic: 0.9, indie: 0.55, loudness: 0.4, dancing: 0.15 } },
  { match: /\b(jazz|blues|swing|big band)\b/, set: { liveMusic: 0.9, culture: 0.6, loudness: 0.45 } },
  { match: /\b(classical|orchestra|symphony|opera|chamber|choral)\b/, set: { liveMusic: 0.9, culture: 0.85, energy: 0.25, loudness: 0.2, crowdAge: 0.2, dancing: 0.05 } },
  { match: /\b(comedy|comedian|stand[- ]?up|improv)\b/, set: { culture: 0.7, energy: 0.55, loudness: 0.45, liveMusic: 0.2, dancing: 0.1 } },
  { match: /\b(theat(re|er)|musical|broadway|ballet|performance art|spoken word)\b/, set: { culture: 0.9, liveMusic: 0.4, dancing: 0.1, loudness: 0.3 } },
  { match: /\bdrag\b|\bqueer\b|\bburlesque\b/, set: { pop: 0.7, energy: 0.7, dancing: 0.65, culture: 0.55 } },
  { match: /\b(sports?|basketball|football|baseball|hockey|soccer|nba|nfl|mlb|nhl|mls|wrestling|boxing|mma)\b/, set: { energy: 0.85, loudness: 0.85, liveMusic: 0.1, dancing: 0.05, culture: 0.2 } },
];

const applyRules = (vec: Record<Feature, number>, text: string) => {
  let matched = false;
  for (const rule of GENRE_RULES) {
    if (!rule.match.test(text)) continue;
    matched = true;
    for (const [f, value] of Object.entries(rule.set) as [Feature, number][]) {
      vec[f] = value >= 0.5 ? Math.max(vec[f], value) : Math.min(vec[f], value);
    }
  }
  return matched;
};

/** A performer's 13 features (FEATURES order, each 0 to 1) from genre names such as ["Dance/Electronic", "House"]. */
export function genresToVector(genres: readonly string[]): number[] {
  const vec = Object.fromEntries(FEATURES.map((f) => [f, PERFORMER_BASE[f] ?? 0.3])) as Record<Feature, number>;
  applyRules(vec, genres.join(" | ").toLowerCase().replace(/_/g, " "));
  return FEATURES.map((f) => Math.round(Math.min(1, Math.max(0, vec[f])) * 100) / 100);
}

/** True when any genre is one the rules understand. */
export const hasKnownGenre = (genres: readonly string[]) =>
  GENRE_RULES.some((rule) => rule.match.test(genres.join(" | ").toLowerCase()));

/** Mean of the performers' vectors blended into an event vector: `weight` of the result comes from the performers. */
export function blendVectors(base: number[], performerVectors: number[][], weight = 0.4): number[] {
  const usable = performerVectors.filter((v) => v.length === base.length);
  if (usable.length === 0) return base;
  return base.map((x, k) => {
    const mean = usable.reduce((sum, v) => sum + v[k], 0) / usable.length;
    return Math.round(((1 - weight) * x + weight * mean) * 100) / 100;
  });
}

/** How alike two performers are, -1 to 1, from their genre vectors. */
export const performerSimilarity = (a: number[], b: number[]) => similarity(a, b);

// ───────────────────────────── affinity ─────────────────────────────

const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * New affinity (0 to 10) after the user scores an event `score`, having ranked `n` of this performer's
 * events before. The first ranking sets it to the score; later ones move it 30 to 50% of the way.
 * Support acts (`headliner` false) take half the step.
 */
export function affinityStep(old: number | undefined, score: number, n: number, headliner = true): number {
  const from = old === undefined || !Number.isFinite(old) ? AFFINITY_NEUTRAL : old;
  const eta = Math.max(AFFINITY_MIN_STEP, 1 / (1 + Math.max(0, n))) * (headliner ? 1 : SUPPORT_ACT_STEP);
  return clip(from + eta * (clip(score, 0, 10) - from), 0, 10);
}

/** Following lifts the affinity to at least FOLLOW_FLOOR. */
export const effectiveAffinity = (score: number, following: boolean) =>
  following ? Math.max(score, FOLLOW_FLOOR) : score;

/** The performer term of the event score (ALGORITHM.md 4.1), from the best effective affinity on the bill. */
export const performerBoost = (bestAffinity: number | undefined) =>
  bestAffinity === undefined ? 0 : clip((PERFORMER_RHO * (bestAffinity - AFFINITY_NEUTRAL)) / 5, -0.75, 1.5);

// ───────────────────────────── alerts ─────────────────────────────

type City = { lat: number; lng: number; timeZone: string; aliases?: string[] };
export const CITY_CENTERS: Record<string, City> = {
  "san francisco": { lat: 37.7749, lng: -122.4194, timeZone: "America/Los_Angeles", aliases: ["sf", "san francisco ca", "the city"] },
  oakland: { lat: 37.8044, lng: -122.2712, timeZone: "America/Los_Angeles" },
  berkeley: { lat: 37.8715, lng: -122.273, timeZone: "America/Los_Angeles" },
  "san jose": { lat: 37.3382, lng: -121.8863, timeZone: "America/Los_Angeles" },
  "palo alto": { lat: 37.4419, lng: -122.143, timeZone: "America/Los_Angeles" },
  "los angeles": { lat: 34.0522, lng: -118.2437, timeZone: "America/Los_Angeles", aliases: ["la"] },
  "san diego": { lat: 32.7157, lng: -117.1611, timeZone: "America/Los_Angeles" },
  seattle: { lat: 47.6062, lng: -122.3321, timeZone: "America/Los_Angeles" },
  portland: { lat: 45.5152, lng: -122.6784, timeZone: "America/Los_Angeles" },
  "las vegas": { lat: 36.1699, lng: -115.1398, timeZone: "America/Los_Angeles" },
  denver: { lat: 39.7392, lng: -104.9903, timeZone: "America/Denver" },
  austin: { lat: 30.2672, lng: -97.7431, timeZone: "America/Chicago" },
  chicago: { lat: 41.8781, lng: -87.6298, timeZone: "America/Chicago" },
  "new york": { lat: 40.7128, lng: -74.006, timeZone: "America/New_York", aliases: ["nyc", "new york city", "manhattan", "brooklyn"] },
  boston: { lat: 42.3601, lng: -71.0589, timeZone: "America/New_York" },
  miami: { lat: 25.7617, lng: -80.1918, timeZone: "America/New_York" },
  atlanta: { lat: 33.749, lng: -84.388, timeZone: "America/New_York" },
  washington: { lat: 38.9072, lng: -77.0369, timeZone: "America/New_York", aliases: ["dc", "washington dc"] },
  london: { lat: 51.5074, lng: -0.1278, timeZone: "Europe/London" },
};

const cityKey = (name: string) =>
  name.toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim().replace(/ (ca|california|ny|usa)$/, "");

export function cityCenter(name: string | undefined): City | undefined {
  if (!name) return undefined;
  const key = cityKey(name);
  if (CITY_CENTERS[key]) return CITY_CENTERS[key];
  return Object.values(CITY_CENTERS).find((city) => city.aliases?.includes(key));
}

function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** "Near" without a live location: same city name, or within ALERT_RADIUS_KM of the centre of the user's home city. */
export function isNearHome(homeCity: string | undefined, event: { city?: string; lat: number; lng: number }): boolean {
  if (!homeCity || homeCity.trim() === "") return ALERT_WITHOUT_HOME_CITY;
  if (event.city && cityKey(homeCity) === cityKey(event.city)) return true;
  const home = cityCenter(homeCity);
  if (!home) return false;
  if (event.city && cityCenter(event.city) === home) return true;
  return kmBetween(home, event) <= ALERT_RADIUS_KM;
}

export type AlertInput = {
  following: boolean;
  score: number;
  nRankings: number;
  homeCity?: string;
  event: { id: string; start: number; city?: string; lat: number; lng: number };
  now: number;
  lastNotifiedEventId?: string;
  /** artist_event notifications this user got in the last 24 hours */
  alertsLastDay: number;
  /** the user already ranked this event or marked "going" */
  alreadyEngaged: boolean;
};

/** The alert rule of ALGORITHM.md 4.2: every condition must hold. */
export function shouldAlert(input: AlertInput): boolean {
  const fan = input.following || (input.score >= ALERT_MIN_AFFINITY && input.nRankings >= 1);
  if (!fan) return false;
  if (input.event.start <= input.now || input.event.start > input.now + ALERT_HORIZON_DAYS * DAY_MS) return false;
  if (input.lastNotifiedEventId !== undefined && input.lastNotifiedEventId === input.event.id) return false;
  if (input.alertsLastDay >= ALERT_MAX_PER_DAY) return false;
  if (input.alreadyEngaged) return false;
  return isNearHome(input.homeCity, input.event);
}

/** "Sat Dec 5" in the event's own time zone. */
export function formatEventDay(start: number, city?: string): string {
  const timeZone = cityCenter(city)?.timeZone ?? DEFAULT_TIME_ZONE;
  try {
    const parts = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone }).formatToParts(start);
    const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${pick("weekday")} ${pick("month")} ${pick("day")}`;
  } catch {
    return new Date(start).toUTCString().slice(0, 11).replace(",", "");
  }
}

/** Title and body of the artist alert: "Calvin Harris is coming to San Francisco" / "Sat Dec 5 · The Midway · you rated them 9.4". */
export function alertText(input: {
  performerName: string;
  city?: string;
  start: number;
  venueName?: string;
  following: boolean;
  score: number;
  nRankings: number;
}): { title: string; body: string } {
  const rated = input.nRankings >= 1 && input.score >= ALERT_MIN_AFFINITY;
  const reason = rated ? `you rated them ${input.score.toFixed(1)}` : "you follow them";
  return {
    title: `${input.performerName} is coming to ${input.city?.trim() || "town"}`,
    body: [formatEventDay(input.start, input.city), input.venueName?.trim() || undefined, reason]
      .filter((part) => part !== undefined)
      .join(" · "),
  };
}
