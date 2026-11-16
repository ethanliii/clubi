import type { NearbyItem } from "../../lib/api";
import { categoryLabel, formatDistance, formatEventTime, formatPrice, formatScore } from "../../lib/format";

/**
 * The one grey line under a card's name, from what the backend sent; missing parts are left out.
 * A place: "350 m · $$ · Cocktail bar". An event: "Today · 9 PM · 350 m".
 */
export function metaLine(item: NearbyItem, now: number): string {
  const parts =
    item.startsAt !== undefined
      ? [formatEventTime(item.startsAt, now), formatDistance(item.distanceMeters)]
      : [formatDistance(item.distanceMeters), formatPrice(item.priceLevel), categoryLabel(item.category, item.subcategory)];
  return parts.filter((part) => part !== "").join(" · ");
}

/** What a screen reader says for the whole card. */
export function cardLabel(item: NearbyItem): string {
  return `${item.name}, ${formatScore(item.score)} for you. ${item.why}`;
}

/** "Maya 9.1 · Jo 8.4": each friend's first name and the score they gave. */
export function friendsLine(item: NearbyItem): string {
  return item.friends.map((friend) => `${friend.displayName.split(" ")[0]} ${formatScore(friend.score)}`).join(" · ");
}

/** The name as cards and rows show it (`displayName` in lib/format). */
export { displayName } from "../../lib/format";

/** The two facts under a card's name, short enough to fit: an event "Today · 1 PM", a place "Wine bar · 970 m". */
export function cardFacts(item: NearbyItem, now: number): string {
  if (item.startsAt !== undefined) return formatEventTime(item.startsAt, now);
  return [categoryLabel(item.category, item.subcategory), formatDistance(item.distanceMeters)].filter((part) => part !== "").join(" · ");
}
