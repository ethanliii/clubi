// Owner: People session. The friend feed: posts, photos, reactions, comments.
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Category } from "./lib/contract";

export type TargetId = Id<"places"> | Id<"events">;
export type TargetInfo = {
  name: string;
  category: Category;
  city?: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  startsAt?: number;
};

/** What a ranking, post or save points at: the few fields of a place or event that People code shows. */
export async function targetOf(
  ctx: QueryCtx,
  kind: "place" | "event",
  id: TargetId,
): Promise<TargetInfo | null> {
  if (kind === "place") {
    const place = await ctx.db.get("places", id as Id<"places">);
    return (
      place && {
        name: place.name,
        category: place.category,
        city: place.city,
        lat: place.lat,
        lng: place.lng,
        imageUrl: place.imageUrl,
      }
    );
  }
  const event = await ctx.db.get("events", id as Id<"events">);
  return (
    event && {
      name: event.title,
      category: event.category,
      city: event.city,
      lat: event.lat,
      lng: event.lng,
      imageUrl: event.imageUrl,
      startsAt: event.start,
    }
  );
}

/** How many reactions and comments one post delete will clear. Posts with more than this don't exist yet. */
const CASCADE_LIMIT = 1000;

/** Deletes a post with its reactions, comments and stored photos. The ranking stays. */
export async function deletePostCascade(ctx: MutationCtx, post: Doc<"posts">) {
  const reactions = await ctx.db
    .query("reactions")
    .withIndex("by_post", (q) => q.eq("postId", post._id))
    .take(CASCADE_LIMIT);
  for (const reaction of reactions) {
    await ctx.db.delete("reactions", reaction._id);
  }
  const comments = await ctx.db
    .query("comments")
    .withIndex("by_post", (q) => q.eq("postId", post._id))
    .take(CASCADE_LIMIT);
  for (const comment of comments) {
    await ctx.db.delete("comments", comment._id);
  }
  for (const photo of post.photos ?? []) {
    await ctx.storage.delete(photo);
  }
  await ctx.db.delete("posts", post._id);
}
