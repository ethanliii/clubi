import { useQueries, useQuery, type RequestForQueries } from "convex/react";
import { useMemo } from "react";
import { api, type FeedItem, type Id } from "../../lib/api";
import { shownFavorites } from "../../lib/favorites";

/**
 * The places someone marked as favorites, in their order: the posts `onboarding.pins` lists, each
 * read through `posts.get`, so the backend decides which of them this viewer may see.
 * Pass `undefined` to read nothing yet.
 */
export function useFavorites(userId: Id<"users"> | undefined): { posts: FeedItem[]; loading: boolean } {
  const marked = useQuery(api.onboarding.pins, userId === undefined ? "skip" : { userId });
  const queries = useMemo(() => {
    const requests: RequestForQueries = {};
    for (const postId of marked ?? []) requests[postId] = { query: api.posts.get, args: { postId } };
    return requests;
  }, [marked]);
  const byId: Record<string, FeedItem | null | undefined | Error> = useQueries(queries);
  return useMemo(() => shownFavorites(userId === undefined ? undefined : marked, byId), [userId, marked, byId]);
}
