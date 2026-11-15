import { useEffect, useState } from "react";

/** The value, `delayMs` after it last changed. For search boxes: `const text = useDebounced(input, 300)`. */
export function useDebounced<T>(value: T, delayMs: number = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
