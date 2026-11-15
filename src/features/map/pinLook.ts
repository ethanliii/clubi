/**
 * How a pin looks, shared by the native and the web map so they match.
 * Which pin an item gets (`tier`) and every number on it come from the backend; this file is paint only.
 */
import type { Category, NearbyItem } from "../../lib/api";
import { categoryHue, formatScore } from "../../lib/format";
import { colors } from "../../theme";

/** The pin color for a category: the app's category hue, bright enough to read on a dark map. */
export function pinColor(category: Category): string {
  return `hsl(${categoryHue(category)}, 90%, 64%)`;
}

/** The soft glow behind a top pin. */
export function pinGlow(category: Category): string {
  return `hsla(${categoryHue(category)}, 90%, 60%, 0.45)`;
}

export const PIN = {
  /** Diameter of the big ringed pin. */
  top: 46,
  topSelected: 54,
  ring: 3,
  /** Height of the labeled pin. */
  label: 30,
  labelMaxWidth: 190,
  /** Diameter of the dot. */
  dot: 14,
  dotSelected: 20,
  fill: colors.bg,
  text: colors.fg,
  border: "rgba(255,255,255,0.14)",
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
