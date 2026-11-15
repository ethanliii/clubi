import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";
import type { Filter, NearbyResult } from "../../convex/lib/contract";
import { useDemoLocation } from "./demoLocation";

const AREA_DEGREES = 0.02;
const requestedAreas = new Set<string>();

export function useNearby(filter: Filter = "all"): NearbyResult | undefined {
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
  return useQuery(api.discover.nearby, ready ? { lat, lng, filter } : "skip");
}
