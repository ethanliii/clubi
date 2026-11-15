/**
 * How a pin looks, shared by the native and the web map so they match.
 * Which pin an item gets (`tier`) and every number on it come from the backend; this file is paint only.
 */
import type { Category, NearbyItem } from "../../lib/api";
import { formatScore } from "../../lib/format";
import { colors, ratingColor } from "../../theme";

/** The pin color: the rating scale (green down to red) for the backend's score, as on every score badge. */
export function pinColor(score: number): string {
  return ratingColor(score);
}

/** The soft accent glow behind a top pin. */
export const PIN_GLOW = "rgba(255,79,154,0.38)";

const CATEGORY_GLYPH: Record<Category, string> = {
  nightlife: "🍸",
  food: "🍴",
  culture: "🏛",
  outdoors: "🌳",
  live: "🎵",
  popup: "✨",
};

/** The little picture in a pin's colored circle. */
export function pinGlyph(category: Category): string {
  return CATEGORY_GLYPH[category] ?? "📍";
}

export const PIN = {
  /** Height of the big ringed pin: a white bubble with an accent ring. */
  top: 34,
  ring: 2.5,
  /** Height of the labeled pin. */
  label: 28,
  labelMaxWidth: 190,
  /** Diameter of the colored circle inside a bubble. */
  icon: 22,
  /** Diameter of the dot. */
  dot: 11,
  dotSelected: 16,
  /** How much a picked bubble grows. */
  selectedScale: 1.15,
  fill: colors.white,
  text: "#111111",
  ringColor: colors.accent,
  event: colors.mid,
  user: "#4aa8ff",
} as const;

/** What a screen reader and a hover tooltip say for a pin. */
export function pinLabel(item: NearbyItem): string {
  return `${item.name}, ${formatScore(item.score)} for you`;
}

/** Draw order: top pins over labeled pins over dots, better ranks over worse, the picked pin over all. */
export function pinOrder(item: NearbyItem, selected: boolean): number {
  if (selected) return 5000;
  const base = item.tier === "top" ? 3000 : item.tier === "good" ? 2000 : 1000;
  return base - Math.min(item.rank, 999);
}

/** Everything a pin's picture depends on. When it changes, the pin is redrawn. */
export function pinSignature(item: NearbyItem, selected: boolean): string {
  return [item.tier, item.kind, item.category, formatScore(item.score), item.name, selected ? "1" : "0"].join("|");
}

/** Initial zoom on the web map: about 1.4 km across a phone, a short walk in every direction. */
export const START_ZOOM = 15;
/** About the same view for react-native-maps, as degrees of latitude from top to bottom. */
export const START_LAT_DELTA = 0.022;
