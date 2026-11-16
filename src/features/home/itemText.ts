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

/**
 * A name fit for a card or a row: an organiser's ALL CAPS title is set in title case, anything after
 * " | " or " — " is cut, and a trailing "!" is dropped. The full name still goes to screen readers.
 */
const SMALL_WORDS = new Set(["A", "AN", "AND", "AT", "BY", "FOR", "IN", "OF", "ON", "OR", "THE", "TO", "VS", "WITH", "BAR", "DAY", "NEW", "ALL", "BIG"]);

export function displayName(name: string): string {
  let text = name.split(" | ")[0].split(" — ")[0].replace(/!+$/, "").trim();
  const letters = text.replace(/[^A-Za-z]/g, "");
  const upper = letters.replace(/[^A-Z]/g, "").length;
  if (letters.length >= 4 && upper / letters.length > 0.6) {
    // Short capitals that are not small words are initials ("USA", "DJ", "SF") and stay as they are.
    text = text
      .split(" ")
      .map((word) =>
        word.length <= 3 && /^[A-Z]+$/.test(word) && !SMALL_WORDS.has(word)
          ? word
          : word.toLowerCase().replace(/(^|[(\-\/])([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase()),
      )
      .join(" ");
  }
  return text === "" ? name : text;
}

/** The two facts under a card's name, short enough to fit: an event "Today · 1 PM", a place "Wine bar · 970 m". */
export function cardFacts(item: NearbyItem, now: number): string {
  if (item.startsAt !== undefined) return formatEventTime(item.startsAt, now);
  return [categoryLabel(item.category, item.subcategory), formatDistance(item.distanceMeters)].filter((part) => part !== "").join(" · ");
}
