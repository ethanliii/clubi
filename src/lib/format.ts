/** Display formatting only. Nothing here changes a score, a rank or an order. */
import type { Category } from "../../convex/lib/contract";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 350 → "350 m", 1240 → "1.2 km", 12400 → "12 km". */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "";
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** 8.66 → "8.7". Scores are always shown with one decimal. */
export function formatScore(score: number): string {
  return score.toFixed(1);
}

/** 2 → "$$". Empty string when the level is missing. */
export function formatPrice(level?: number | null): string {
  if (level == null || level < 1) return "";
  return "$".repeat(Math.min(4, Math.round(level)));
}

/** 21:00 → "9 PM", 21:30 → "9:30 PM". */
export function formatClock(ms: number): string {
  const date = new Date(ms);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const suffix = hours < 12 ? "AM" : "PM";
  return minutes === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** "Today", "Tomorrow", or "Sat Dec 5" (with the year when it is not this year). */
export function formatDay(ms: number, now: number = Date.now()): string {
  const days = Math.round((startOfDay(ms) - startOfDay(now)) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  const date = new Date(ms);
  const base = `${WEEKDAYS[date.getDay()]} ${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === new Date(now).getFullYear() ? base : `${base}, ${date.getFullYear()}`;
}

/** An event's start: "Today · 9 PM", "Sat Dec 5 · 9:30 PM". */
export function formatEventTime(ms: number, now: number = Date.now()): string {
  return `${formatDay(ms, now)} · ${formatClock(ms)}`;
}

/** A trip's dates: "Mar 12–15", "Mar 30 – Apr 2", "Mar 12". Empty string when there are none. */
export function formatDateRange(start?: number | null, end?: number | null): string {
  const short = (ms: number) => {
    const date = new Date(ms);
    return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  };
  if (start == null && end == null) return "";
  if (start == null || end == null || startOfDay(start) === startOfDay(end)) return short((start ?? end) as number);
  const a = new Date(start);
  const b = new Date(end);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${short(start)}–${b.getDate()}`;
  return `${short(start)} – ${short(end)}`;
}

/** Time since something happened: "now", "5m", "2h", "3d", then "Dec 5". */
export function formatRelativeTime(ms: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ms);
  if (diff < MINUTE) return "now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;
  const date = new Date(ms);
  const base = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === new Date(now).getFullYear() ? base : `${base}, ${date.getFullYear()}`;
}

/** 1 → "1 friend", 3 → "3 friends". */
export function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** 132 → "99+" style cap for badges. */
export function formatCount(count: number, cap: number = 99): string {
  return count > cap ? `${cap}+` : String(count);
}

/** "Ethan Li" → "EL", "ethan_test" → "E". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? words[0].slice(0, 1) : words[0].slice(0, 1) + words[words.length - 1].slice(0, 1);
  return letters.toUpperCase();
}

const CATEGORY_LABELS: Record<Category, string> = {
  nightlife: "Nightlife",
  food: "Food",
  culture: "Culture",
  outdoors: "Outdoors",
  live: "Live show",
  popup: "Pop-up",
};

/** What kind of place it is: the subcategory when there is one ("Cafe"), else the category ("Food"). */
export function categoryLabel(category: Category, subcategory?: string | null): string {
  const text = subcategory?.trim();
  if (text) return text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, " ");
  return CATEGORY_LABELS[category] ?? category;
}

/** The plural tab name for a category: "Bars", "Food", "Culture", "Outdoors", "Shows", "Pop-ups". */
export const CATEGORY_TABS: { category: Category; label: string }[] = [
  { category: "nightlife", label: "Bars" },
  { category: "food", label: "Food" },
  { category: "culture", label: "Culture" },
  { category: "outdoors", label: "Outdoors" },
  { category: "live", label: "Shows" },
  { category: "popup", label: "Pop-ups" },
];

const CATEGORY_HUES: Record<Category, number> = {
  nightlife: 320,
  food: 28,
  culture: 265,
  outdoors: 150,
  live: 200,
  popup: 48,
};

/** A hue (0–360) per category, for `VenuePhoto` and pins. Looks only; it says nothing about the score. */
export function categoryHue(category: Category): number {
  return CATEGORY_HUES[category] ?? 300;
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
