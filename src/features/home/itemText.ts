import type { NearbyItem } from "../../lib/api";
import { categoryLabel, formatDistance, formatEventTime, formatPrice, formatScore } from "../../lib/format";

/** "Cocktail bar · $$ · 350 m" from what the backend sent; missing parts are left out. */
export function metaLine(item: NearbyItem): string {
  return [categoryLabel(item.category, item.subcategory), formatPrice(item.priceLevel), formatDistance(item.distanceMeters)]
    .filter((part) => part !== "")
    .join(" · ");
}

/** An event's start ("Today · 9 PM"), or null for a place. */
export function whenLine(item: NearbyItem, now: number): string | null {
  return item.startsAt !== undefined ? formatEventTime(item.startsAt, now) : null;
}

/** What a screen reader says for the whole card. */
export function cardLabel(item: NearbyItem): string {
  return `${item.name}, ${formatScore(item.score)} for you. ${item.why}`;
}

/** "Maya 9.1 · Jo 8.4": each friend's first name and the score they gave. */
export function friendsLine(item: NearbyItem): string {
  return item.friends.map((friend) => `${friend.displayName.split(" ")[0]} ${formatScore(friend.score)}`).join(" · ");
}
