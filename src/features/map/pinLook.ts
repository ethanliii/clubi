/**
 * How a pin looks, shared by the native and the web map so they match.
 * Every number on a pin comes from the backend; this file is paint only.
 *
 * A pin is one of two pictures. The best ones are score bubbles: a white pill edged in the kind of
 * place's colour, a round badge in that colour with the kind's glyph, and the score in its rating
 * colour. The rest are solid dots in the kind's colour (`pinLook`). The
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

/**
 * Kind of place → colour and glyph, so a bar, a club, a cafe and a park read apart at a glance.
 * Matched on the backend's `subcategory` words first, then the category. Paint only.
 */
type Look = { color: string; glyph: string };
const G = {
  cocktail: CATEGORY_GLYPH.nightlife,
  beer: "M6 7h9v12a2 2 0 01-2 2H8a2 2 0 01-2-2zM15 10h2a2 2 0 012 2v3a2 2 0 01-2 2h-2M6 11h9",
  wine: "M8 3h8l-.8 6a3.2 3.2 0 01-6.4 0zM12 12.2V20M9 20h6",
  disco: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18",
  mic: "M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3zM6 11a6 6 0 0012 0M12 17v4",
  fork: CATEGORY_GLYPH.food,
  coffee: "M5 9h11v5a5 5 0 01-5 5h-1a5 5 0 01-5-5zM16 10.5h1.5a2.5 2.5 0 010 5H16M8.5 3.5v2.5M12 3.5v2.5",
  cone: "M7.5 10.5a4.5 4.5 0 119 0zM7.5 10.5L12 21l4.5-10.5",
  columns: CATEGORY_GLYPH.culture,
  film: "M4 9h16v10H4zM4 9l2.6-4.5L10 9M10 9l2.6-4.5L16 9",
  tree: CATEGORY_GLYPH.outdoors,
  notes: CATEGORY_GLYPH.live,
  spark: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z",
  ticket: CATEGORY_GLYPH.popup,
};
const KIND_LOOKS: { match: RegExp; look: Look }[] = [
  { match: /night ?club|dance|club\b|disco|rave/, look: { color: "#c026d3", glyph: G.disco } },
  { match: /karaoke/, look: { color: "#9333ea", glyph: G.mic } },
  { match: /wine/, look: { color: "#be123c", glyph: G.wine } },
  { match: /pub|brew|beer|sports bar|tavern/, look: { color: "#b45309", glyph: G.beer } },
  { match: /bar|lounge|speakeasy|hookah/, look: { color: "#7c3aed", glyph: G.cocktail } },
  { match: /cafe|café|coffee|bakery|tea/, look: { color: "#92400e", glyph: G.coffee } },
  { match: /ice cream|dessert|gelato|sweet/, look: { color: "#ec4899", glyph: G.cone } },
  { match: /cinema|theat|comedy|film/, look: { color: "#4f46e5", glyph: G.film } },
  { match: /museum|gallery|arts?\b|arts centre/, look: { color: "#0284c7", glyph: G.columns } },
  { match: /music|concert|venue|live/, look: { color: "#db2777", glyph: G.notes } },
  { match: /party/, look: { color: "#e11d48", glyph: G.spark } },
  { match: /market|pop.?up|fair/, look: { color: "#d97706", glyph: G.ticket } },
  { match: /park|garden|beach|trail|lake/, look: { color: "#16a34a", glyph: G.tree } },
];
const CATEGORY_LOOK: Record<Category, Look> = {
  nightlife: { color: "#7c3aed", glyph: G.cocktail },
  food: { color: "#ea580c", glyph: G.fork },
  culture: { color: "#0284c7", glyph: G.columns },
  outdoors: { color: "#16a34a", glyph: G.tree },
  live: { color: "#db2777", glyph: G.notes },
  popup: { color: "#d97706", glyph: G.ticket },
};

/** The colour and glyph for one pin: by kind of place (subcategory), else by category. */
export function pinLook(item: Pick<NearbyItem, "category" | "subcategory">): Look {
  const words = (item.subcategory ?? "").toLowerCase();
  if (words) {
    for (const { match, look } of KIND_LOOKS) if (match.test(words)) return look;
  }
  return CATEGORY_LOOK[item.category] ?? { color: "#6b7280", glyph: FALLBACK_GLYPH };
}

/** The `d` of the little drawing in a bubble. */
export function pinGlyph(category: Category): string {
  return CATEGORY_GLYPH[category] ?? FALLBACK_GLYPH;
}

export const PIN = {
  /** A score bubble: the top five are a touch bigger than the rest. */
  bubble: { width: 60, height: 28, font: 13, glyph: 12 },
  bubbleTop: { width: 66, height: 32, font: 15, glyph: 14 },
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

/**
 * A photo pin: the place's picture in a circle, its score on a small chip over the bottom edge.
 * Zoomed in, a bubble whose place has a picture is drawn this way; zoomed out it is the score pill again.
 */
export const PHOTO_PIN = { size: 46, sizeTop: 54, border: 2.5, chipHeight: 16, chipFont: 11, chipDrop: 6 } as const;

/** The room a pin's head takes above its point: the pill, or the photo circle when `photo`. */
export function pinSize(item: NearbyItem, photo: boolean): { width: number; height: number } {
  if (!photo) return bubbleSize(item);
  const size = item.tier === "top" ? PHOTO_PIN.sizeTop : PHOTO_PIN.size;
  return { width: size, height: size };
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
  return [item.tier, item.category, item.subcategory ?? "", formatScore(item.score), item.name, selected ? "1" : "0", item.imageUrl ?? ""].join("|");
}

/** Initial zoom on the web map: about 1.4 km across a phone, a short walk in every direction. */
export const START_ZOOM = 15;
/** About the same view for react-native-maps, as degrees of latitude from top to bottom. */
export const START_LAT_DELTA = 0.022;
/** A picked place is shown at least this close: the block it is on. */
export const SELECT_ZOOM = 17;
/** The same for react-native-maps. */
export const SELECT_LAT_DELTA = START_LAT_DELTA / 4;
