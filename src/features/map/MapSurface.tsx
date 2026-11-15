import { MapCanvas } from "./MapCanvas";
import type { MapSurfaceProps } from "./types";

/**
 * Browser version of Bryan's map tab. react-native-maps is native only, so the browser draws the
 * MapLibre map from MapCanvas.web.tsx instead (same pins, same selection).
 */
export function MapSurface({ items, center, selectedId, onSelect, recenterKey }: MapSurfaceProps) {
  return (
    <MapCanvas
      items={items}
      center={center}
      user={null}
      selectedId={selectedId}
      onSelect={onSelect}
      recenterKey={recenterKey}
      padding={{ top: 0, bottom: 0 }}
    />
  );
}
