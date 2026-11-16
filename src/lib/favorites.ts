/** The most favorites a profile shows (`MAX_PINS` in convex/onboarding.ts). */
export const MAX_FAVORITES = 9;

/**
 * Marks or unmarks one favorite. A new one goes last, so the profile shows favorites in the order
 * they were marked. At the limit nothing is added: `full` says so.
 */
export function toggleFavorite<T>(ids: readonly T[], id: T, max: number = MAX_FAVORITES): { ids: T[]; full: boolean } {
  if (ids.includes(id)) return { ids: ids.filter((other) => other !== id), full: false };
  if (ids.length >= max) return { ids: [...ids], full: true };
  return { ids: [...ids, id], full: false };
}

/**
 * The favorites to show, in the order they were marked: each marked id that has a post the viewer
 * can see. A post that was deleted, or that the viewer may not see, is left out. `loading` is true
 * while any marked post has not arrived yet.
 */
export function shownFavorites<Id extends string, Post>(
  marked: readonly Id[] | undefined,
  byId: Record<string, Post | null | undefined | Error>,
): { posts: Post[]; loading: boolean } {
  if (marked === undefined) return { posts: [], loading: true };
  const posts: Post[] = [];
  let loading = false;
  for (const id of marked) {
    const post = byId[id];
    if (post === undefined) loading = true;
    else if (post !== null && !(post instanceof Error)) posts.push(post);
  }
  return { posts, loading };
}
