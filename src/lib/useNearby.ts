import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Filter, NearbyResult } from "../../convex/lib/contract";
import { useDemoLocation } from "./demoLocation";

export function useNearby(filter: Filter = "all"): NearbyResult | undefined {
  const { lat, lng } = useDemoLocation();
  return useQuery(api.discover.nearby, { lat, lng, filter });
}
