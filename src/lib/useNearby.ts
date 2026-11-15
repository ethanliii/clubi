import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Filter, NearbyResult } from "../../convex/lib/contract";
import { useDemoLocation } from "./demoLocation";

export function useNearby(filter: Filter = "all"): NearbyResult | undefined {
  const { lat, lng, ready } = useDemoLocation();
  return useQuery(api.discover.nearby, ready ? { lat, lng, filter } : "skip");
}
