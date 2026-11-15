import { usePaginatedQuery } from "convex/react";
import { useCallback, useEffect, useRef } from "react";
import { api } from "../../lib/api";

export const FEED_PAGE_SIZE = 15;
/** The most the backend reads per call. Used to get past a dry stretch of the feed quickly. */
const CATCH_UP_PAGE_SIZE = 50;

/**
 * The friend feed, page by page: `api.posts.feed` through `usePaginatedQuery`.
 *
 * The backend pages through every post by time and keeps mine and my friends', so a page can come
 * back short or even empty while there is still more to read. A list only asks for more when it is
 * scrolled to its end, and an empty page gives it nothing new to scroll. So this hook reads on by
 * itself, until something new arrives or the feed is exhausted, when:
 *   - nothing is on screen yet;
 *   - the posts so far do not fill the screen (`fillsScreen` is false);
 *   - the user reached the end and the page that came back added nothing.
 */
export function useFeed({ fillsScreen }: { fillsScreen: boolean }) {
  const { results, status, loadMore } = usePaginatedQuery(api.posts.feed, {}, { initialNumItems: FEED_PAGE_SIZE });
  const count = results.length;
  /** How many posts were showing when the user last reached the end; null when they are not waiting. */
  const waitingSince = useRef<number | null>(null);

  useEffect(() => {
    if (status !== "CanLoadMore") return;
    if (waitingSince.current !== null && count > waitingSince.current) waitingSince.current = null;
    if (count === 0 || !fillsScreen || waitingSince.current !== null) loadMore(CATCH_UP_PAGE_SIZE);
  }, [status, count, fillsScreen, loadMore]);

  /** Call when the list reaches its end (and from the "Load more" button). */
  const more = useCallback(() => {
    if (status !== "CanLoadMore") return;
    waitingSince.current = count;
    loadMore(FEED_PAGE_SIZE);
  }, [status, count, loadMore]);

  return {
    posts: results,
    /** No answer yet, or only empty pages so far with more to read. */
    loading: status === "LoadingFirstPage" || (count === 0 && status !== "Exhausted"),
    /** Reading the next page, or about to because the list is not full yet. */
    loadingMore: status === "LoadingMore" || (status === "CanLoadMore" && !fillsScreen),
    canLoadMore: status === "CanLoadMore",
    exhausted: status === "Exhausted",
    more,
  };
}
