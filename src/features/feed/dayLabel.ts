/** "Today" / "Yesterday" / "Nov 12": the divider shown when the day changes between two rows (formatting only). */
export function dayLabel(ms: number, now: number): string {
  const day = new Date(ms);
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return "Today";
  if (day.toDateString() === yesterday.toDateString()) return "Yesterday";
  return day.toLocaleDateString([], { month: "short", day: "numeric" });
}
