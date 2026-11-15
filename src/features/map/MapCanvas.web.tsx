/**
 * The map in a browser: Leaflet on OpenStreetMap's own tiles, turned dark with a CSS filter, with the
 * same three pins as the native map drawn as HTML. The native twin is MapCanvas.native.tsx.
 *
 * Why not a ready-made dark tile set: CARTO's dark tiles now answer "API KEY REQUIRED" without a key,
 * and this app has no map key. To switch later, change TILE_URL and TILE_ATTRIBUTION and drop the filter.
 */
import "leaflet/dist/leaflet.css";
import * as L from "leaflet";
import { useEffect, useRef } from "react";
import type { NearbyItem } from "../../lib/api";
import { formatScore } from "../../lib/format";
import { colors } from "../../theme";
import { PIN, START_ZOOM, pinColor, pinGlow, pinLabel, pinOrder, pinSignature } from "./pinLook";
import type { LatLng, MapCanvasProps } from "./types";

/** The tiles are OpenStreetMap's, and the screen already shows "© OpenStreetMap contributors". */
export const TILE_ATTRIBUTION = "";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
/** Light map in, night map out: flip the lightness, turn the hues back, then calm it down. */
const TILE_FILTER = "invert(1) hue-rotate(180deg) brightness(0.82) contrast(0.92) saturate(0.45)";
const STYLE_ID = "clubi-map-style";
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// Pins are plain elements styled by class; `--c` is the category color and `--g` its glow.
const CSS = `
.clubi-map { background: ${colors.page}; outline: none; font-family: ${FONT}; }
.clubi-map .leaflet-pane, .clubi-map .leaflet-tile { -webkit-user-select: none; user-select: none; }
.clubi-map .leaflet-tile-pane { filter: ${TILE_FILTER}; }
.clubi-anchor { width: 0 !important; height: 0 !important; margin: 0 !important; overflow: visible; background: none; border: none; outline: none; }
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

function pinIcon(element: HTMLElement): L.DivIcon {
  return L.divIcon({ html: element, className: "clubi-anchor", iconSize: [0, 0] });
}

/**
 * Put `target` in the middle of the part of the map that is not covered by the search bar and the list.
 * `zoom` null keeps the current zoom and slides; a number flies there.
 */
function moveCamera(map: L.Map, target: LatLng, zoom: number | null, padding: { top: number; bottom: number }, animate: boolean) {
  const nextZoom = zoom ?? map.getZoom();
  const shift = (padding.bottom - padding.top) / 2;
  const point = map.project([target.lat, target.lng], nextZoom).add([0, shift]);
  const latLng = map.unproject(point, nextZoom);
  if (!animate) map.setView(latLng, nextZoom, { animate: false });
  else if (zoom === null) map.panTo(latLng, { animate: true, duration: 0.35 });
  else map.flyTo(latLng, nextZoom, { duration: 0.6 });
}

type Drawn = { marker: L.Marker; signature: string; item: NearbyItem };

export function MapCanvas({ items, center, user, selectedId, onSelect, recenterKey, padding }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnRef = useRef(new Map<string, Drawn>());
  const userMarkerRef = useRef<L.Marker | null>(null);
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
    const map = L.map(container, {
      zoomControl: false,
      // The screen shows the attribution itself, above the list, where it can always be read.
      attributionControl: false,
      minZoom: 3,
      maxZoom: 19,
      worldCopyJump: true,
    });
    L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(map);
    moveCamera(map, latest.current.center, START_ZOOM, latest.current.padding, false);
    map.on("click", () => latest.current.onSelect(null));
    mapRef.current = map;

    // Leaflet has to be told when its box changes size (window resize, coming back to this tab).
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => map.invalidateSize());
    observer?.observe(container);

    return () => {
      observer?.disconnect();
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
        const at = existing.marker.getLatLng();
        if (at.lat !== item.lat || at.lng !== item.lng) existing.marker.setLatLng([item.lat, item.lng]);
        if (existing.signature !== signature) {
          existing.marker.setIcon(pinIcon(pinElement(item, selected)));
          existing.marker.setZIndexOffset(pinOrder(item, selected));
          existing.signature = signature;
        }
        continue;
      }
      const marker = L.marker([item.lat, item.lng], {
        icon: pinIcon(pinElement(item, selected)),
        zIndexOffset: pinOrder(item, selected),
        keyboard: true,
        riseOnHover: true,
        riseOffset: 6000,
      });
      const entry: Drawn = { marker, signature, item };
      marker.on("click", () => latest.current.onSelect(entry.item));
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
      userMarkerRef.current.setLatLng([userLat, userLng]);
      return;
    }
    const dot = document.createElement("div");
    dot.className = "clubi-pin clubi-user";
    dot.setAttribute("aria-label", "You are here");
    userMarkerRef.current = L.marker([userLat, userLng], {
      icon: pinIcon(dot),
      interactive: false,
      keyboard: false,
      zIndexOffset: 500,
    }).addTo(map);
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
      // zIndex 0 keeps Leaflet's own layers (z-index up to 1000) underneath the search bar and the list.
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 0 }}
    />
  );
}
