import { useQuery, type OptionalRestArgsOrSkip } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { useState } from "react";

/**
 * `useQuery` for a query whose args include the device location. When the location moves, the
 * args change and plain `useQuery` answers `undefined` until the new result arrives, which screens
 * draw as a first load (skeletons, pins gone, scrolled to the top). This keeps the last answer on
 * screen until the next one lands.
 *
 * `key` names what is being asked apart from the location (the place, the filter, the search text).
 * When it changes, the old answer is for something else and is dropped.
 */
export function useKeptQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query> | "skip",
  key: string,
): FunctionReturnType<Query> | undefined {
  const live: FunctionReturnType<Query> | undefined = useQuery(query, ...([args] as OptionalRestArgsOrSkip<Query>));
  const [kept, setKept] = useState<{ key: string; value: FunctionReturnType<Query> | undefined }>({
    key,
    value: undefined,
  });
  if (live !== undefined && (kept.value !== live || kept.key !== key)) setKept({ key, value: live });
  if (args === "skip") return undefined;
  if (live !== undefined) return live;
  return kept.key === key ? kept.value : undefined;
}
