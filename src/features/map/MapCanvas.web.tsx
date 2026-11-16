/**
 * The map in a browser: MapLibre GL drawing OpenFreeMap's light street map (vector), with the pins drawn
 * as HTML. The native twin is MapCanvas.native.tsx (Apple Maps on iOS); both follow pinLook.ts and
 * pinLayout.ts, so the two draw the same pins.
 *
 * Why vector tiles: OpenStreetMap's picture tiles are made for ordinary screens and go blurry on a
 * Retina one. A vector map is drawn at the screen's own resolution and stays sharp at every zoom.
 * OpenFreeMap needs no key and no account.
 */
import "maplibre-gl/dist/maplibre-gl.css";
import { Map as GLMap, Marker, getVersion, setWorkerUrl } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { NearbyItem } from "../../lib/api";
import { formatScore } from "../../lib/format";
import { colors } from "../../theme";
import { layoutPins, scaleForZoom, type PinPlacement } from "./pinLayout";
import { PIN, START_ZOOM, pinColor, pinGlyph, pinLabel, pinOrder, pinSignature, SELECT_ZOOM } from "./pinLook";
import type { LatLng, MapCanvasProps } from "./types";

/** The map picture's own credit. The screen shows it after "© OpenStreetMap contributors". */
export const TILE_ATTRIBUTION = "OpenFreeMap © OpenMapTiles";

/**
 * MapLibre does its heavy work on a background worker that lives in a separate file. Expo's bundler
 * does not ship that file with the app, so it is loaded from a public CDN, at exactly the installed version.
 */
setWorkerUrl(`https://cdn.jsdelivr.net/npm/maplibre-gl@${getVersion()}/dist/maplibre-gl-worker.mjs`);

/** "positron" is OpenFreeMap's quiet light style: pale streets and parks, so the pins carry the colour. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
/** MapLibre counts zoom on 512-pixel tiles, one less than the usual web-map number for the same view. */
const GL_ZOOM_OFFSET = -1;
const MIN_ZOOM = 2;
const MAX_ZOOM = 18;
/** A map click this soon after a pin click is the same click arriving twice. */
const SAME_CLICK_MS = 100;
/** A pin under the pointer comes to the front, over every other pin. */
const HOVER_ORDER = 6000;
const STYLE_ID = "clubi-map-style-5";
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const SVG_NS = "http://www.w3.org/2000/svg";
const B = PIN.bubble;
const T = PIN.bubbleTop;

// A pin is one element holding all three of its pictures (bubble, dot, name); `data-mode` and
// `data-name` say which show, so a zoom only flips attributes and the change can be animated.
// `--c` is the rating colour of the pin's score.
const CSS = `
.clubi-map { background: ${colors.page}; outline: none; font-family: ${FONT}; }
.clubi-map .maplibregl-canvas { outline: none; }
.clubi-anchor { width: 0 !important; height: 0 !important; margin: 0 !important; overflow: visible; background: none; border: none; outline: none; }
.clubi-anchor:hover { z-index: ${HOVER_ORDER} !important; }
.clubi-pin {
  position: absolute; left: 0; top: 0; width: 0; height: 0; cursor: pointer;
  font-family: ${FONT}; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;
}
.clubi-pin[data-mode="hidden"] { pointer-events: none; }

.clubi-bubble {
  position: absolute; left: 0; top: 0; box-sizing: border-box;
  width: ${B.width}px; height: ${B.height}px; margin: ${-(B.height + PIN.tip)}px 0 0 ${-B.width / 2}px;
  transform-origin: 50% calc(100% + ${PIN.tip}px);
  display: flex; align-items: center; justify-content: center; gap: 3px;
  border-radius: 99px; background: ${PIN.fill}; color: var(--c);
  box-shadow: 0 0 0 1px ${PIN.hairline}, 0 2px 6px ${PIN.shadow};
  font-size: ${B.font}px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.2px; line-height: 1;
  opacity: 0; transform: scale(.4); pointer-events: none;
  transition: transform .18s cubic-bezier(.2,.9,.3,1.2), opacity .14s ease, background-color .14s ease, color .14s ease, box-shadow .14s ease;
}
/* The tip: its point is the anchor, which is the place's exact lat/lng. Scaling turns around that point. */
.clubi-bubble::after {
  content: ""; position: absolute; left: 50%; top: 100%; margin-left: ${-PIN.tipHalf}px; width: 0; height: 0;
  border-left: ${PIN.tipHalf}px solid transparent; border-right: ${PIN.tipHalf}px solid transparent; border-top: ${PIN.tip}px solid ${PIN.fill};
  filter: drop-shadow(0 2px 1px rgba(17,17,20,.14));
}
.clubi-pin.is-selected .clubi-bubble::after { border-top-color: ${PIN.selectedFill}; filter: none; }
.clubi-pin.is-selected::after {
  content: ""; position: absolute; left: -4px; top: -4px; width: 8px; height: 8px; border-radius: 50%; box-sizing: border-box;
  background: ${colors.white}; border: 2px solid ${PIN.selectedFill}; pointer-events: none;
}
.clubi-bubble svg { flex: none; width: ${B.glyph}px; height: ${B.glyph}px; }
.clubi-pin.is-top .clubi-bubble {
  width: ${T.width}px; height: ${T.height}px; margin: ${-(T.height + PIN.tip)}px 0 0 ${-T.width / 2}px; font-size: ${T.font}px;
}
.clubi-pin.is-top .clubi-bubble svg { width: ${T.glyph}px; height: ${T.glyph}px; }
.clubi-pin[data-mode="bubble"] .clubi-bubble { opacity: 1; transform: scale(1); pointer-events: auto; }
.clubi-pin[data-mode="bubble"]:hover .clubi-bubble { transform: scale(1.06); }
.clubi-pin[data-mode="bubble"]:active .clubi-bubble { transform: scale(.96); }
.clubi-pin.is-selected .clubi-bubble {
  background: ${PIN.selectedFill}; color: ${PIN.selectedInk};
  box-shadow: 0 4px 12px rgba(17,17,20,.32);
  transform: scale(${PIN.selectedScale}) !important;
}

.clubi-dot {
  position: absolute; left: 0; top: 0; box-sizing: border-box;
  width: ${PIN.dot}px; height: ${PIN.dot}px; margin: ${-PIN.dot / 2}px 0 0 ${-PIN.dot / 2}px; border-radius: 50%;
  background: var(--c); box-shadow: 0 0 0 ${PIN.edge}px ${PIN.edgeColor}, 0 1px 3px ${PIN.shadow};
  opacity: 0; transform: scale(.3); pointer-events: none;
  transition: transform .18s ease, opacity .14s ease;
}
/* The dot is small; the clear box around it is the tap target. */
.clubi-dot::before { content: ""; position: absolute; top: -12px; right: -12px; bottom: -12px; left: -12px; }
.clubi-pin[data-mode="dot"] .clubi-dot { opacity: 1; transform: scale(1); pointer-events: auto; }
.clubi-pin[data-mode="dot"]:hover .clubi-dot { opacity: 1; transform: scale(1.4); }

.clubi-name {
  position: absolute; left: ${-PIN.name.maxWidth / 2}px; top: ${PIN.name.gap}px; width: ${PIN.name.maxWidth}px;
  height: ${PIN.name.height}px; line-height: ${PIN.name.height}px; text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: ${colors.fg}; font-size: ${PIN.name.font}px; font-weight: 600; letter-spacing: 0.1px;
  text-shadow: 0 0 2px ${colors.white}, 0 0 2px ${colors.white}, 0 0 3px ${colors.white}, 0 0 4px ${colors.white};
  opacity: 0; pointer-events: none; transition: opacity .14s ease;
}

.clubi-pin.is-selected .clubi-name { top: ${PIN.name.gap + 3}px; font-weight: 700; }
.clubi-pin[data-mode="bubble"][data-name="1"] .clubi-name { opacity: 1; }

.clubi-anchor:focus-visible .clubi-bubble, .clubi-anchor:focus-visible .clubi-dot { outline: 2px solid ${colors.fg}; outline-offset: 3px; }
.clubi-user {
  position: absolute; left: -8px; top: -8px; box-sizing: border-box; width: 16px; height: 16px; border-radius: 50%;
  background: ${PIN.user}; border: 3px solid ${colors.white};
  box-shadow: 0 0 0 9px ${PIN.userHalo}, 0 1px 4px ${PIN.shadow}; pointer-events: none;
}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/**
 * One pin as an element. Text goes in with `textContent`, never as HTML: names come from
 * event sites and must not be able to inject markup.
 */
function pinElement(item: NearbyItem, selected: boolean, placement: PinPlacement): HTMLElement {
  const pin = document.createElement("div");
  pin.className = ["clubi-pin", item.tier === "top" ? "is-top" : "", selected ? "is-selected" : ""].filter(Boolean).join(" ");
  pin.style.setProperty("--c", pinColor(item.score));
  pin.dataset.pin = item.tier;
  pin.dataset.mode = placement.mode;
  pin.dataset.name = placement.name ? "1" : "0";

  const bubble = document.createElement("div");
  bubble.className = "clubi-bubble";
  const glyph = document.createElementNS(SVG_NS, "svg");
  glyph.setAttribute("viewBox", "0 0 24 24");
  glyph.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pinGlyph(item.category));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2.4");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  glyph.append(path);
  const score = document.createElement("span");
  score.textContent = formatScore(item.score);
  bubble.append(glyph, score);

  const dot = document.createElement("div");
  dot.className = "clubi-dot";

  const name = document.createElement("div");
  name.className = "clubi-name";
  name.setAttribute("aria-hidden", "true");
  name.textContent = item.name;

  pin.append(dot, bubble, name);
  return pin;
}

/**
 * A pin on the map is a zero-size anchor that MapLibre moves, with the pin centered on it.
 * (MapLibre writes its own `transform` on the element it is given, so the pin cannot be that element.)
 */
function anchorFor(pin: HTMLElement, order: number): HTMLDivElement {
  const anchor = document.createElement("div");
  anchor.className = "clubi-anchor";
  anchor.style.zIndex = String(order);
  anchor.append(pin);
  return anchor;
}

const lngLat = (at: LatLng): [number, number] => [at.lng, at.lat];
const HIDDEN: PinPlacement = { mode: "hidden", name: false };

/**
 * Put `target` in the middle of the part of the map that is not covered by the search bar and the list.
 * `zoom` null keeps the current zoom and slides; a number flies there.
 */
function moveCamera(map: GLMap, target: LatLng, zoom: number | null, padding: { top: number; bottom: number }, animate: boolean) {
  const view = {
    center: lngLat(target),
    padding: { top: padding.top, bottom: padding.bottom, left: 0, right: 0 },
    ...(zoom === null ? {} : { zoom: zoom + GL_ZOOM_OFFSET }),
  };
  if (!animate) map.jumpTo(view);
  else if (zoom === null) map.easeTo({ ...view, duration: 350 });
  else map.flyTo({ ...view, duration: 600 });
}

type Drawn = { marker: Marker; anchor: HTMLDivElement; signature: string; item: NearbyItem };

export function MapCanvas({ items, center, user, selectedId, onSelect, recenterKey, padding }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GLMap | null>(null);
  const drawnRef = useRef(new Map<string, Drawn>());
  const userMarkerRef = useRef<Marker | null>(null);
  // When a pin was last clicked. Only read and written in click handlers.
  const pinClickedAt = useRef(0);
  // The newest values for code that runs later (map clicks, camera moves, zooms) without re-running effects.
  const latest = useRef({ onSelect, padding, center, items, selectedId });
  useEffect(() => {
    latest.current = { onSelect, padding, center, items, selectedId };
  });

  /** Decide bubble, dot or hidden for every pin at the current zoom, and show it. */
  const arrange = useRef(() => {
    const map = mapRef.current;
    if (!map) return;
    const { items: list, selectedId: picked } = latest.current;
    const placements = layoutPins(list, scaleForZoom(map.getZoom()), picked);
    for (const [id, entry] of drawnRef.current) {
      const placement = placements.get(id) ?? HIDDEN;
      const pin = entry.anchor.firstElementChild as HTMLElement | null;
      if (!pin) continue;
      if (pin.dataset.mode !== placement.mode) {
        pin.dataset.mode = placement.mode;
        entry.anchor.style.zIndex = String(pinOrder(entry.item, placement.mode === "bubble", id === picked));
        // A pin that is not shown is not a stop for the keyboard or a screen reader either.
        entry.anchor.tabIndex = placement.mode === "hidden" ? -1 : 0;
        entry.anchor.setAttribute("aria-hidden", placement.mode === "hidden" ? "true" : "false");
      }
      const name = placement.name ? "1" : "0";
      if (pin.dataset.name !== name) pin.dataset.name = name;
    }
  }).current;

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    ensureStyle();
    const drawn = drawnRef.current;
    let map: GLMap;
    try {
      map = new GLMap({
        container,
        style: STYLE_URL,
        center: lngLat(latest.current.center),
        zoom: START_ZOOM + GL_ZOOM_OFFSET,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        // The screen shows the attribution itself, above the list, where it can always be read.
        attributionControl: false,
        // North stays up and the map stays flat, like the native one.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        rollEnabled: false,
        maxPitch: 0,
      });
    } catch {
      // No WebGL in this browser: the page keeps its plain background and the list below still works.
      return;
    }
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    moveCamera(map, latest.current.center, START_ZOOM, latest.current.padding, false);
    map.on("click", () => {
      if (performance.now() - pinClickedAt.current < SAME_CLICK_MS) return;
      latest.current.onSelect(null);
    });
    // Pins only change places with each other when the zoom changes; a pan moves them all together.
    let frame = 0;
    map.on("zoom", () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        arrange();
      });
    });
    mapRef.current = map;

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      drawn.clear();
    };
  }, [arrange]);

  // Pins follow the list: add the new, redraw the changed, remove the gone.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const drawn = drawnRef.current;
    const placements = layoutPins(items, scaleForZoom(map.getZoom()), selectedId);
    const seen = new Set<string>();
    for (const item of items) {
      const id: string = item.id;
      seen.add(id);
      const selected = id === selectedId;
      const signature = pinSignature(item, selected);
      const placement = placements.get(id) ?? HIDDEN;
      const order = pinOrder(item, placement.mode === "bubble", selected);
      const existing = drawn.get(id);
      if (existing) {
        existing.item = item;
        const at = existing.marker.getLngLat();
        if (at.lat !== item.lat || at.lng !== item.lng) existing.marker.setLngLat(lngLat(item));
        if (existing.signature !== signature) {
          const old = existing.anchor.firstElementChild as HTMLElement | null;
          // Start from the mode it had, so a pin that turns into a bubble grows instead of blinking.
          const pin = pinElement(item, selected, old ? { mode: old.dataset.mode as PinPlacement["mode"], name: old.dataset.name === "1" } : placement);
          existing.anchor.replaceChildren(pin);
          existing.anchor.setAttribute("aria-label", pinLabel(item));
          existing.signature = signature;
        }
        existing.anchor.style.zIndex = String(order);
        continue;
      }
      const anchor = anchorFor(pinElement(item, selected, placement), order);
      anchor.tabIndex = placement.mode === "hidden" ? -1 : 0;
      anchor.setAttribute("role", "button");
      anchor.setAttribute("aria-label", pinLabel(item));
      anchor.setAttribute("aria-hidden", placement.mode === "hidden" ? "true" : "false");
      const marker = new Marker({ element: anchor, anchor: "center" }).setLngLat(lngLat(item));
      const entry: Drawn = { marker, anchor, signature, item };
      const select = (event: Event) => {
        // The same click would otherwise reach the map underneath and clear the pick again.
        event.stopPropagation();
        pinClickedAt.current = performance.now();
        latest.current.onSelect(entry.item);
      };
      anchor.addEventListener("click", select);
      anchor.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        select(event);
      });
      marker.addTo(map);
      drawn.set(id, entry);
    }
    for (const [id, entry] of drawn) {
      if (seen.has(id)) continue;
      entry.marker.remove();
      drawn.delete(id);
    }
    // After the new elements are in the page, so a changed mode animates.
    latest.current = { ...latest.current, items, selectedId };
    const frame = requestAnimationFrame(arrange);
    return () => cancelAnimationFrame(frame);
  }, [items, selectedId, arrange]);

  // The user's own dot.
  const userLat = user?.lat;
  const userLng = user?.lng;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userLat === undefined || userLng === undefined) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([userLng, userLat]);
      return;
    }
    const dot = document.createElement("div");
    dot.className = "clubi-user";
    dot.setAttribute("aria-label", "You are here");
    const anchor = anchorFor(dot, 500);
    anchor.style.pointerEvents = "none";
    userMarkerRef.current = new Marker({ element: anchor, anchor: "center" }).setLngLat([userLng, userLat]).addTo(map);
  }, [userLat, userLng]);

  // Demo switch, a new position, or "Recenter": back to the center at the starting zoom.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      // The map was created on this center a moment ago.
      first.current = false;
      return;
    }
    const map = mapRef.current;
    if (map) moveCamera(map, { lat: center.lat, lng: center.lng }, START_ZOOM, latest.current.padding, true);
  }, [center.lat, center.lng, recenterKey]);

  // A picked pin slides into view. The zoom stays where the user left it.
  const selected = selectedId === null ? undefined : items.find((item) => item.id === selectedId);
  const selectedLat = selected?.lat;
  const selectedLng = selected?.lng;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedLat === undefined || selectedLng === undefined) return;
    // Fly to the exact point, close enough to see the block. Never zooms back out.
    const zoom = Math.max(map.getZoom() - GL_ZOOM_OFFSET, SELECT_ZOOM);
    moveCamera(map, { lat: selectedLat, lng: selectedLng }, zoom, latest.current.padding, true);
  }, [selectedLat, selectedLng]);

  return (
    <div
      ref={containerRef}
      className="clubi-map"
      role="application"
      aria-label="Map"
      // zIndex 0 keeps the map's own layers and the pins underneath the search bar and the list.
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 0 }}
    />
  );
}
