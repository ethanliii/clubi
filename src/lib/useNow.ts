import { useEffect, useState } from "react";

/**
 * The current time in ms, refreshed every `everyMs` (default one minute), so "2m ago" keeps moving.
 * Use this instead of calling `Date.now()` while rendering, which the linter rejects:
 *   const now = useNow();  <Text>{formatRelativeTime(post.createdAt, now)}</Text>
 */
export function useNow(everyMs: number = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
