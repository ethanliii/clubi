/**
 * Which pins are score bubbles, which are dots and which wait for a closer zoom.
 *
 * Pins never pile up: going down the backend's ranking, a pin becomes a bubble only if its bubble
 * would not touch one that is already placed; otherwise it is a dot, and a dot that would sit under
 * a bubble or on another dot is left out until the map is zoomed in. Names go under the bubbles
 * that have clear room below. The picked pin is always a bubble with its name.
 *
 * It only looks at how far apart pins are on screen, so the answer changes with the zoom, never
 * with a pan. Both maps call it: the web one with MapLibre's zoom, the native one with its region.
 */
import type { NearbyItem } from "../../lib/api";
import { PIN, pinSize } from "./pinLook";

export type PinMode = "bubble" | "dot" | "hidden";
export type PinPlacement = { mode: PinMode; name: boolean; /** Drawn as its photo in a circle, not as a score pill. */ photo?: boolean };

/**
 * Photos show from this zoom in (MapLibre's number; the map opens one level closer than this).
 * Further out there is no room for pictures: every pin scales down to a small circle in its score's colour.
 */
export const PHOTO_ZOOM = 12.9;
export const photosAt = (scale: number) => scale >= scaleForZoom(PHOTO_ZOOM);

type Box = { left: number; top: number; right: number; bottom: number };

/** Clear space kept between two bubbles. */
const BUBBLE_GAP = 6;
/** A pin outside the backend's "top" and "good" tiers needs this much more room to get a bubble. */
const OTHER_GAP = 18;
/** Two dots closer than this (center to center) would read as one blob. */
const DOT_GAP = 13;
/** Rough width of one letter of a name, to know how wide its label will be. */
const NAME_LETTER = 6.2;

const touches = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const grow = (box: Box, by: number): Box => ({ left: box.left - by, top: box.top - by, right: box.right + by, bottom: box.bottom + by });

/** Screen pixels across the whole world (360° of longitude) at a MapLibre zoom. */
export const scaleForZoom = (zoom: number) => 512 * 2 ** zoom;
/** The same from a react-native-maps region: the map is `width` points wide and shows `longitudeDelta` degrees. */
export const scaleForRegion = (width: number, longitudeDelta: number) => (width / Math.max(longitudeDelta, 1e-6)) * 360;

/** Web Mercator, in pixels at `scale`. */
function project(lat: number, lng: number, scale: number) {
  const sin = Math.min(0.9999, Math.max(-0.9999, Math.sin((lat * Math.PI) / 180)));
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

export function layoutPins(items: readonly NearbyItem[], scale: number, selectedId: string | null): Map<string, PinPlacement> {
  const placed = new Map<string, PinPlacement>();
  // The picked pin first, then the backend's order of rank. The scores and ranks are never changed here.
  const order = [...items].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId) || a.rank - b.rank);
  const points = new Map(order.map((item) => [item.id as string, project(item.lat, item.lng, scale)]));

  const photos = photosAt(scale);
  const hasPhoto = (item: NearbyItem) => photos && !!item.imageUrl;
  const bubbles: { id: string; box: Box }[] = [];
  const waiting: NearbyItem[] = [];
  for (const item of order) {
    const at = points.get(item.id)!;
    const selected = item.id === selectedId;
    const size = pinSize(item, hasPhoto(item));
    const grown = selected ? PIN.selectedScale : 1;
    const box: Box = {
      left: at.x - (size.width * grown) / 2,
      right: at.x + (size.width * grown) / 2,
      // The bubble stands on its tip: all of it is above the place's point.
      top: at.y - (size.height + PIN.tip) * grown,
      bottom: at.y,
    };
    const room = grow(box, item.tier === "other" ? OTHER_GAP : BUBBLE_GAP);
    // Zoomed out there is no room for pictures or scores: every pin but the picked one is a small circle.
    if (selected || (photos && !bubbles.some((other) => touches(room, other.box)))) {
      bubbles.push({ id: item.id, box });
      placed.set(item.id, { mode: "bubble", name: false, photo: hasPhoto(item) });
    } else {
      waiting.push(item);
    }
  }

  const dots: { x: number; y: number }[] = [];
  const half = PIN.dot / 2 + 2;
  for (const item of waiting) {
    const at = points.get(item.id)!;
    const box: Box = { left: at.x - half, right: at.x + half, top: at.y - half, bottom: at.y + half };
    const covered =
      bubbles.some((bubble) => touches(box, bubble.box)) ||
      dots.some((dot) => Math.hypot(dot.x - at.x, dot.y - at.y) < DOT_GAP);
    if (covered) {
      placed.set(item.id, { mode: "hidden", name: false });
    } else {
      dots.push(at);
      placed.set(item.id, { mode: "dot", name: false });
    }
  }

  // Names, best pins first, wherever the strip under a bubble is clear of bubbles, dots and other names.
  const names: Box[] = [];
  for (const bubble of bubbles) {
    const item = order.find((candidate) => candidate.id === bubble.id)!;
    const width = Math.min(PIN.name.maxWidth, item.name.length * NAME_LETTER + 6);
    const center = (bubble.box.left + bubble.box.right) / 2;
    const top = bubble.box.bottom + PIN.name.gap;
    const box: Box = { left: center - width / 2, right: center + width / 2, top, bottom: top + PIN.name.height };
    const clear =
      !bubbles.some((other) => other.id !== bubble.id && touches(box, grow(other.box, 2))) &&
      !names.some((other) => touches(box, grow(other, 3))) &&
      !dots.some((dot) => touches(box, { left: dot.x - half, right: dot.x + half, top: dot.y - half, bottom: dot.y + half }));
    if (bubble.id === selectedId || clear) {
      names.push(box);
      placed.set(bubble.id, { mode: "bubble", name: true, photo: hasPhoto(item) });
    }
  }
  return placed;
}
