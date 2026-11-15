/**
 * The map in a browser: MapLibre GL drawing OpenFreeMap's night-blue vector map, with the same three pins as
 * the native map drawn as HTML. The native twin is MapCanvas.native.tsx (Apple Maps on iOS).
 *
 * Why vector tiles: the first version used OpenStreetMap's picture tiles, which are made for
 * ordinary screens. On a Retina screen each one is stretched to twice its size, so streets and names
 * were blurry, and the night look was a colour-invert filter over a daytime map. A vector map is drawn
 * at the screen's own resolution and has a real dark style. OpenFreeMap needs no key and no account.
 * Apple Maps in a browser (MapKit JS) would need a token from a paid Apple Developer account.
 */
import "maplibre-gl/dist/maplibre-gl.css";
import { Map as GLMap, Marker, getVersion, setWorkerUrl } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { NearbyItem } from "../../lib/api";
import { formatScore } from "../../lib/format";
import { colors } from "../../theme";
import { PIN, START_ZOOM, pinColor, pinGlow, pinLabel, pinOrder, pinSignature } from "./pinLook";
import type { LatLng, MapCanvasProps } from "./types";

/** The map picture's own credit. The screen shows it after "© OpenStreetMap contributors". */
export const TILE_ATTRIBUTION = "OpenFreeMap © OpenMapTiles";

/**
 * MapLibre does its heavy work on a background worker that lives in a separate file. Expo's bundler
 * does not ship that file with the app, so it is loaded from a public CDN, at exactly the installed version.
 */
setWorkerUrl(`https://cdn.jsdelivr.net/npm/maplibre-gl@${getVersion()}/dist/maplibre-gl-worker.mjs`);

/** "fiord" is OpenFreeMap's night style with readable streets; their "dark" one is close to black on black. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/fiord";
/** MapLibre counts zoom on 512-pixel tiles, one less than the usual web-map number for the same view. */
const GL_ZOOM_OFFSET = -1;
const MIN_ZOOM = 2;
const MAX_ZOOM = 18;
/** A map click this soon after a pin click is the same click arriving twice. */
const SAME_CLICK_MS = 100;
/** A pin under the pointer comes to the front, over every other pin. */
const HOVER_ORDER = 6000;
const STYLE_ID = "clubi-map-style";
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// Pins are plain elements styled by class; `--c` is the category color and `--g` its glow.
const CSS = `
.clubi-map { background: ${colors.page}; outline: none; font-family: ${FONT}; }
.clubi-map .maplibregl-canvas { outline: none; }
.clubi-anchor { width: 0 !important; height: 0 !important; margin: 0 !important; overflow: visible; background: none; border: none; outline: none; }
.clubi-anchor:hover { z-index: ${HOVER_ORDER} !important; }
.clubi-pin {
  position: absolute; left: 0; top: 0; transform: translate(-50%, -50%);
  box-sizing: border-box; display: flex; align-items: center; justify-content: center;
  color: ${PIN.text}; font-family: ${FONT}; white-space: nowrap; cursor: pointer;
  -webkit-user-select: none; user-select: none;
  transition: width .15s ease, height .15s ease, background-color .15s ease, box-shadow .15s ease;
}
.clubi-anchor:focus-visible .clubi-pin { outline: 2px solid ${colors.white}; outline-offset: 3px; }
.clubi-top {
  width: ${PIN.top}px; height: ${PIN.top}px; border-radius: 50%;
  background: ${PIN.fill}; border: ${PIN.ring}px solid var(--c);
  box-shadow: 0 0 0 4px var(--g), 0 0 18px var(--g), 0 6px 16px rgba(0,0,0,.55);
  font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums;
}
.clubi-top.is-event { border-radius: 14px; }
.clubi-top:hover { box-shadow: 0 0 0 6px var(--g), 0 0 22px var(--g), 0 6px 16px rgba(0,0,0,.55); }
.clubi-top.is-selected { width: ${PIN.topSelected}px; height: ${PIN.topSelected}px; background: var(--c); color: ${colors.bg}; font-size: 17px; }
.clubi-label {
  height: ${PIN.label}px; max-width: ${PIN.labelMaxWidth}px; padding: 0 10px 0 8px; gap: 6px;
  border-radius: ${PIN.label / 2}px; background: rgba(20,17,25,.94); border: 1px solid ${PIN.border};
  box-shadow: 0 4px 12px rgba(0,0,0,.5); font-size: 12px; font-weight: 600;
}
.clubi-label:hover { border-color: var(--c); }
.clubi-label .clubi-swatch { flex: none; width: 9px; height: 9px; border-radius: 50%; background: var(--c); }
.clubi-label.is-event .clubi-swatch { border-radius: 2px; transform: rotate(45deg); }
.clubi-label .clubi-name { overflow: hidden; text-overflow: ellipsis; }
.clubi-label .clubi-score { flex: none; font-weight: 700; color: var(--c); font-variant-numeric: tabular-nums; }
.clubi-label.is-selected { background: var(--c); border-color: var(--c); color: ${colors.bg}; }
.clubi-label.is-selected .clubi-swatch { background: ${colors.bg}; }
.clubi-label.is-selected .clubi-score { color: ${colors.bg}; }
.clubi-dot {
  width: ${PIN.dot}px; height: ${PIN.dot}px; border-radius: 50%;
  background: var(--c); border: 2px solid ${PIN.fill}; box-shadow: 0 1px 4px rgba(0,0,0,.6);
}
.clubi-dot::before { content: ""; position: absolute; top: -12px; right: -12px; bottom: -12px; left: -12px; }
.clubi-dot.is-event { border-radius: 3px; transform: translate(-50%, -50%) rotate(45deg); }
.clubi-dot:hover { border-color: ${colors.white}; }
.clubi-dot.is-selected { width: ${PIN.dotSelected}px; height: ${PIN.dotSelected}px; border-color: ${colors.white}; }
.clubi-user {
  width: 16px; height: 16px; border-radius: 50%; background: ${PIN.user}; border: 3px solid ${colors.white};
  box-shadow: 0 0 0 9px rgba(74,168,255,.22); cursor: default; pointer-events: none;
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
function pinElement(item: NearbyItem, selected: boolean): HTMLElement {
  const pin = document.createElement("div");
  const kind = item.tier === "top" ? "clubi-top" : item.tier === "good" ? "clubi-label" : "clubi-dot";
  pin.className = ["clubi-pin", kind, item.kind === "event" ? "is-event" : "", selected ? "is-selected" : ""]
    .filter(Boolean)
    .join(" ");
  pin.style.setProperty("--c", pinColor(item.category));
  pin.style.setProperty("--g", pinGlow(item.category));
  pin.setAttribute("aria-label", pinLabel(item));
  pin.dataset.pin = item.tier;

  if (item.tier === "top") {
    pin.textContent = formatScore(item.score);
  } else if (item.tier === "good") {
    const swatch = document.createElement("span");
    swatch.className = "clubi-swatch";
    const name = document.createElement("span");
    name.className = "clubi-name";
    name.textContent = item.name;
    const score = document.createElement("span");
    score.className = "clubi-score";
    score.textContent = formatScore(item.score);
    pin.append(swatch, name, score);
  }
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
  // The newest values for code that runs later (map clicks, camera moves) without re-running effects.
  const latest = useRef({ onSelect, padding, center });
  useEffect(() => {
    latest.current = { onSelect, padding, center };
  });

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
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      drawn.clear();
    };
  }, []);

  // Pins follow the list: add the new, redraw the changed, remove the gone.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const drawn = drawnRef.current;
    const seen = new Set<string>();
    for (const item of items) {
      const id: string = item.id;
      seen.add(id);
      const selected = id === selectedId;
      const signature = pinSignature(item, selected);
      const existing = drawn.get(id);
      if (existing) {
        existing.item = item;
        const at = existing.marker.getLngLat();
        if (at.lat !== item.lat || at.lng !== item.lng) existing.marker.setLngLat(lngLat(item));
        if (existing.signature !== signature) {
          existing.anchor.replaceChildren(pinElement(item, selected));
          existing.anchor.style.zIndex = String(pinOrder(item, selected));
          existing.anchor.setAttribute("aria-label", pinLabel(item));
          existing.signature = signature;
        }
        continue;
      }
      const anchor = anchorFor(pinElement(item, selected), pinOrder(item, selected));
      anchor.tabIndex = 0;
      anchor.setAttribute("role", "button");
      anchor.setAttribute("aria-label", pinLabel(item));
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
  }, [items, selectedId]);

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
    dot.className = "clubi-pin clubi-user";
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
    moveCamera(map, { lat: selectedLat, lng: selectedLng }, null, latest.current.padding, true);
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
