/**
 * How a pin looks, shared by the native and the web map so they match.
 * Every number on a pin comes from the backend; this file is paint only.
 *
 * A pin is one of two pictures. The best ones are score bubbles: a white pill with a small category
 * glyph and the score, both in the score's rating colour. The rest are solid dots in that colour. The
 * picked bubble is filled black with white ink. Which one a pin
 * gets is decided by `layoutPins` (pinLayout.ts), from how much room there is at the current zoom.
 */
import type { Category, NearbyItem } from "../../lib/api";
import { formatScore } from "../../lib/format";
import { colors, ratingColor } from "../../theme";

/** The pin colour: the rating scale (green down to red) for the backend's score, as on every score badge. */
export function pinColor(score: number): string {
  return ratingColor(score);
}

/**
 * The category glyph in a bubble: a line drawing in a 24-unit box, the same style as the app's icons.
 * One `d` string each, so the web map (inline SVG) and the native map (react-native-svg) draw the same thing.
 */
const CATEGORY_GLYPH: Record<Category, string> = {
  // A cocktail glass.
  nightlife: "M4.5 5h15L12 13.5zM12 13.5V20M8 20h8",
  // A fork and a knife.
  food: "M6 3v5a2.5 2.5 0 005 0V3M8.5 3v18M17 21V3c-2.2 1.8-3.2 4.8-3.2 9H17",
  // A building with columns.
  culture: "M3.5 9.5L12 4l8.5 5.5zM5 20h14M7 10v7M12 10v7M17 10v7",
  // A tree.
  outdoors: "M12 3l5.5 8h-3l4.5 6.5H5L9.5 11h-3zM12 17.5V21",
  // Two joined notes.
  live: "M9 17.5V6l10-2v11.5M9 17.5a2.3 2.3 0 11-4.6 0 2.3 2.3 0 014.6 0zM19 15.5a2.3 2.3 0 11-4.6 0 2.3 2.3 0 014.6 0z",
  // A ticket.
  popup: "M3 8.5V6h18v2.5a3.5 3.5 0 000 7V18H3v-2.5a3.5 3.5 0 000-7zM14.5 6v12",
};
const FALLBACK_GLYPH = "M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z";

/** The `d` of the little drawing in a bubble. */
export function pinGlyph(category: Category): string {
  return CATEGORY_GLYPH[category] ?? FALLBACK_GLYPH;
}

export const PIN = {
  /** A score bubble: the top five are a touch bigger than the rest. */
  bubble: { width: 52, height: 28, font: 13, glyph: 12 },
  bubbleTop: { width: 58, height: 32, font: 15, glyph: 14 },
  /** A bubble is white on the light map; a hairline and a soft shadow lift it off the streets. */
  fill: colors.white,
  hairline: "rgba(17,17,20,0.12)",
  shadow: "rgba(17,17,20,0.22)",
  /** The white edge around a dot. */
  edge: 2,
  edgeColor: colors.white,
  /** The picked bubble: black with white ink, a little bigger. */
  selectedScale: 1.18,
  selectedFill: colors.fg,
  selectedInk: colors.white,
  /** The pointed tip under a bubble. Its point is the place's exact coordinate. */
  tip: 7,
  tipHalf: 6,
  /** A dot. Its centre is the place's exact coordinate. */
  dot: 10,
  /** The name under a bubble, when there is room for it. */
  name: { font: 11, height: 14, maxWidth: 104, gap: 3 },
  user: "#2f7df6",
  userHalo: "rgba(47,125,246,0.18)",
} as const;

export function bubbleSize(item: NearbyItem) {
  return item.tier === "top" ? PIN.bubbleTop : PIN.bubble;
}

/** What a screen reader and a hover tooltip say for a pin. */
export function pinLabel(item: NearbyItem): string {
  return `${item.name}, ${formatScore(item.score)} for you`;
}

/** Draw order: bubbles over dots, better ranks over worse, the picked pin over all. */
export function pinOrder(item: NearbyItem, bubble: boolean, selected: boolean): number {
  if (selected) return 5000;
  return (bubble ? 3000 : 1000) - Math.min(item.rank, 999);
}

/** Everything a pin's picture depends on besides its mode. When it changes, the pin is redrawn. */
export function pinSignature(item: NearbyItem, selected: boolean): string {
  return [item.tier, item.category, formatScore(item.score), item.name, selected ? "1" : "0"].join("|");
}

/** Initial zoom on the web map: about 1.4 km across a phone, a short walk in every direction. */
export const START_ZOOM = 15;
/** About the same view for react-native-maps, as degrees of latitude from top to bottom. */
export const START_LAT_DELTA = 0.022;
/** A picked place is shown at least this close: the block it is on. */
export const SELECT_ZOOM = 17;
/** The same for react-native-maps. */
export const SELECT_LAT_DELTA = START_LAT_DELTA / 4;
