import type { NearbyItem } from "../../lib/api";

export type LatLng = { lat: number; lng: number };

/**
 * The map itself. Two files draw it: `MapCanvas.native.tsx` (react-native-maps) and
 * `MapCanvas.web.tsx` (MapLibre GL). Both take exactly these props and draw the same three pins.
 */
export type MapCanvasProps = {
  /** What the backend returned, already ranked. Pins follow this list as it changes. */
  items: NearbyItem[];
  /** Where the camera sits. It moves there whenever this changes or `recenterKey` goes up. */
  center: LatLng;
  /** The user's own position (never anyone else's). null until it is known. */
  user: LatLng | null;
  /** The pin that is picked out, by item id. */
  selectedId: string | null;
  /** A pin was tapped (the item) or the bare map was tapped (null). */
  onSelect: (item: NearbyItem | null) => void;
  /** Add one to move the camera back to `center` ("Recenter"). */
  recenterKey: number;
  /** How much of the map is covered by the search bar (top) and the list (bottom), in points. */
  padding: { top: number; bottom: number };
};

/** Bryan's map tab (`MapSurface.*`): the same idea with fewer props. */
export type MapSurfaceProps = {
  items: NearbyItem[];
  center: { lat: number; lng: number };
  selectedId: string | null;
  onSelect: (item: NearbyItem | null) => void;
  /** Bump to move the camera back to `center`. */
  recenterKey: number;
  /** + / − buttons: bump `key` to zoom one step in (`dir` 1) or out (-1). */
  zoom?: { key: number; dir: 1 | -1 };
};
