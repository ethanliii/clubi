import { useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";
import type { Filter, NearbyResult } from "../../convex/lib/contract";
import { useDemoLocation } from "./demoLocation";
import { useKeptQuery } from "./useKeptQuery";

const AREA_DEGREES = 0.02;
const requestedAreas = new Set<string>();

export function useNearby(filter: Filter = "all", limit?: number): NearbyResult | undefined {
  const { lat, lng, ready } = useDemoLocation();
  const ensureArea = useMutation(api.ingest.ensureArea);
  const area = `${Math.floor(lat / AREA_DEGREES)}:${Math.floor(lng / AREA_DEGREES)}`;
  useEffect(() => {
    if (!ready || requestedAreas.has(area)) return;
    requestedAreas.add(area);
    ensureArea({ lat, lng }).then(
      ({ status }) => {
        if (status === "throttled") requestedAreas.delete(area);
      },
      () => requestedAreas.delete(area),
    );
  }, [ready, area, lat, lng, ensureArea]);
  // Kept while the location moves, so the pins and the list do not blink out on every new fix.
  // `limit` asks for more than the default 60: the map, where zooming in makes room for more pins.
  return useKeptQuery(api.discover.nearby, ready ? { lat, lng, filter, ...(limit === undefined ? {} : { limit }) } : "skip", filter);
}
