const DAYS = ["su", "mo", "tu", "we", "th", "fr", "sa"];
const IGNORED_DAY_TOKENS = ["ph", "sh"];
const DAY_MINUTES = 24 * 60;

function parseDays(spec: string): number[] | null {
  if (spec === "") return [0, 1, 2, 3, 4, 5, 6];
  const days: number[] = [];
  for (const part of spec.split(",")) {
    const [from, to] = part.trim().split("-").map((d) => d.trim());
    if (IGNORED_DAY_TOKENS.includes(from)) continue;
    const start = DAYS.indexOf(from);
    const end = to === undefined ? start : DAYS.indexOf(to);
    if (start < 0 || end < 0) return null;
    for (let d = start; ; d = (d + 1) % 7) {
      days.push(d);
      if (d === end) break;
    }
  }
  return days;
}

/**
 * Reads the common OpenStreetMap opening_hours forms ("24/7", "Mo-Fr 09:00-17:00; Sa,Su 10:00-02:00", "Su off").
 * Returns undefined when the text is missing or uses a form this does not understand.
 */
export function isOpenAt(hours: string | undefined, day: number, minutes: number): boolean | undefined {
  if (!hours) return undefined;
  const text = hours.trim().toLowerCase();
  if (text === "24/7") return true;
  const spansByDay: ([number, number][] | undefined)[] = [undefined, undefined, undefined, undefined, undefined, undefined, undefined];
  for (const rule of text.split(";")) {
    const match = rule.trim().match(/^((?:[a-z]{2}(?:\s*[-,]\s*[a-z]{2})*)?)\s*(.*)$/);
    if (!match) return undefined;
    const days = parseDays(match[1]);
    if (days === null) return undefined;
    const rest = match[2].trim();
    const spans: [number, number][] = [];
    if (rest !== "off" && rest !== "closed") {
      for (const part of rest.split(",")) {
        const time = part.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\+?$/);
        if (!time) return undefined;
        const open = Number(time[1]) * 60 + Number(time[2]);
        const close = Number(time[3]) * 60 + Number(time[4]);
        spans.push([open, close <= open ? close + DAY_MINUTES : close]);
      }
    }
    for (const d of days) spansByDay[d] = spans;
  }
  const today = spansByDay[day] ?? [];
  const yesterday = spansByDay[(day + 6) % 7] ?? [];
  return today.some(([open, close]) => minutes >= open && minutes < close)
    || yesterday.some(([, close]) => minutes + DAY_MINUTES < close);
}
