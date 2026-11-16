import { useQuery } from "convex/react";
import { api, type Id } from "../../lib/api";
import { radius } from "../../theme";
import { PlacePhoto } from "../trips/PlacePhoto";

/** A steady colour from a name, for an artist with no picture (decoration only). */
export function hueOf(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) % 360;
  return hash;
}

/**
 * The picture of one show. An artist's list of shows carries no pictures, so this reads the event
 * itself (`api.places.get`) and uses its `imageUrl`; until that arrives, or when the event has
 * none, it is the category picture for live shows.
 */
export function ShowPhoto({ eventId, size }: { eventId: Id<"events">; size: number }) {
  const event = useQuery(api.places.get, { kind: "event", id: eventId });
  return (
    <PlacePhoto
      uri={event?.imageUrl}
      category={event?.category ?? "live"}
      height={size}
      width={size}
      round={radius.lg}
    />
  );
}
