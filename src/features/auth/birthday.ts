/**
 * The birthday box on Sign up. The backend takes "YYYY-MM-DD" or nothing (convex/auth.ts), and only
 * checks the shape, so the calendar check (no Feb 31, no date in the future) happens here.
 */

/** Turn whatever was typed into "YYYY", "YYYY-MM" or "YYYY-MM-DD": digits only, dashes added. */
export function formatBirthdayInput(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/** What is wrong with a birthday, as a sentence, or null when it is fine. Empty is fine (it is optional). */
export function birthdayProblem(value: string, today: Date): string | null {
  const text = value.trim();
  if (text === "") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return "Use the form YYYY-MM-DD, like 2004-10-23, or leave it empty.";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const real = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  if (!real) return "That date doesn't exist. Check the month and the day.";
  if (year < 1900) return "Check the year.";
  if (date.getTime() > today.getTime()) return "A birthday can't be in the future.";
  return null;
}

/**
 * The birthday box on Sign up is typed the way people say a date, month first: "10/23/2004".
 * Digits only, slashes added. Someone who starts with the year ("2004…") gets "2004-10-23"
 * instead: no month starts with 19 or 20, so the two can't be confused.
 */
export function formatBirthdayEntry(text: string): string {
  let digits = text.replace(/\D/g, "");
  if (/^(19|20)/.test(digits)) return formatBirthdayInput(digits);
  // "4/7/2001" typed without the zeros: no month starts with 3-9 or is 13-18 or 21-29, and no day
  // starts with 4-9. A lone "1" or "2" waits for the next digit, which says month or year.
  if (/^([3-9]|1[3-8]|2[1-9])/.test(digits)) digits = `0${digits}`;
  if (/^\d{2}[4-9]/.test(digits)) digits = `${digits.slice(0, 2)}0${digits.slice(2)}`;
  digits = digits.slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** What the backend takes ("YYYY-MM-DD") for a finished entry, "" for an empty one, null for a half-typed one. */
export function birthdayEntryToIso(entry: string): string | null {
  const text = entry.trim();
  if (text === "") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}
