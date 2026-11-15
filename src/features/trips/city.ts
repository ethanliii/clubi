/**
 * Where a trip's city is on the map. The table of cities is the backend's own (the one behind the
 * "Local" mark and the "is coming to your city" alerts), read here so a trip named for New York is
 * planned around New York and not around wherever its organizer is standing.
 * A city the backend does not know gives `undefined`.
 */
import { cityCenter } from "../../../convex/lib/performers";

export function citySpot(city: string | undefined): { lat: number; lng: number } | undefined {
  const center = cityCenter(city?.trim());
  return center === undefined ? undefined : { lat: center.lat, lng: center.lng };
}
