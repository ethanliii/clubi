import type { NearbyItem } from "../../../convex/lib/contract";

export type MapSurfaceProps = {
  items: NearbyItem[];
  center: { lat: number; lng: number };
  selectedId: string | null;
  onSelect: (item: NearbyItem | null) => void;
  /** Bump to move the camera back to `center`. */
  recenterKey: number;
};
