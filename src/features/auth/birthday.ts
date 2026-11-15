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
