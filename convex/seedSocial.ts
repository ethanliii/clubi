// Owner: People session. Demo accounts that make the app look lived-in: eight people with their own
// taste, rankings that follow from it, a post per ranking, friendships, and (for one real user) friends,
// incoming requests and a trip. `run` is safe to run twice; `clear` removes everything it made.
//
//   npx convex run seedSocial:run '{"forUsername": "ethan"}'      (after seedPlaces:run)
//   npx convex run seedSocial:clear
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Bucket, Category } from "./lib/contract";
import { sameCity, venueVectorOf } from "./lib/discovery";
import { FEATURES, contentScore, type Feature } from "./lib/recs";
import { renumber } from "./lib/social";
import { friendshipBetween } from "./friends";
import { deleteUserRows } from "./users";

/** Every demo username starts with this, so `clear` (and `users.purgeTestUsers`) can find them. */
export const DEMO_PREFIX = "demo_";
const UNSET_FEATURE = 0.15;
const SEED_PLACES_READ = 100;
const MIN_RANKINGS = 8;
const RANKINGS_SPREAD = 8;            // 8–15 per person
const SHARE_FAVORITES = 0.6;          // of a person's rankings: their best matches…
const SHARE_DISLIKES = 0.2;           // …their worst, and the rest from the middle
// Content scores of real venues bunch together near the top (about 6 to 10), so a fixed cut-off would
// put nearly everything in "loved". The bucket comes from where a place falls in that person's own range.
const LOVED_MIN_SHARE = 0.5;
const FINE_MIN_SHARE = 0.2;
const SPREAD_MS = 10 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEGREES_PER_HOUR = 15;
const FRIENDS_FOR_USER = 4;
const REQUESTS_FOR_USER = 2;
const TRIP_NAME = "Saturday in the Mission";
const TRIP_CITY = "San Francisco";
const TRIP_VOTES = 3;

const vec = (set: Partial<Record<Feature, number>>) => FEATURES.map((k) => set[k] ?? UNSET_FEATURE);

type DemoUser = {
  username: string; displayName: string; homeCity: string; bio: string; birthday: string; taste: number[];
};

const DEMO_USERS: DemoUser[] = [
  { username: "demo_maya", displayName: "Maya Okafor", homeCity: "San Francisco", birthday: "1997-03-14",
    bio: "Techno until sunrise. Ask me where the afters is.",
    taste: vec({ energy: 0.95, loudness: 0.9, crowdAge: 0.75, price: 0.5, dancing: 0.95, liveMusic: 0.4, electronic: 0.95, hiphop: 0.3 }) },
  { username: "demo_theo", displayName: "Theo Marchetti", homeCity: "San Francisco", birthday: "1991-11-02",
    bio: "Cocktails, a booth, and whoever is playing sax.",
    taste: vec({ energy: 0.45, loudness: 0.4, crowdAge: 0.4, price: 0.7, liveMusic: 0.7, indie: 0.5, culture: 0.4, food: 0.4 }) },
  { username: "demo_priya", displayName: "Priya Raman", homeCity: "San Francisco", birthday: "1994-07-21",
    bio: "I plan the night around dinner. Reservations are a love language.",
    taste: vec({ energy: 0.4, loudness: 0.35, crowdAge: 0.45, price: 0.6, food: 0.95, culture: 0.3 }) },
  { username: "demo_jonas", displayName: "Jonas Lindqvist", homeCity: "San Francisco", birthday: "1989-05-09",
    bio: "Trails before noon, museums after. Rarely out past ten.",
    taste: vec({ energy: 0.3, loudness: 0.15, crowdAge: 0.4, price: 0.25, culture: 0.9, outdoors: 0.95, food: 0.4 }) },
  { username: "demo_lena", displayName: "Lena Castillo", homeCity: "San Francisco", birthday: "1998-01-30",
    bio: "Front row at every small show. Will trade setlists.",
    taste: vec({ energy: 0.75, loudness: 0.8, crowdAge: 0.55, price: 0.25, dancing: 0.4, liveMusic: 0.95, indie: 0.9, food: 0.25 }) },
  { username: "demo_andre", displayName: "Andre Whitfield", homeCity: "Oakland", birthday: "1995-09-17",
    bio: "Hip-hop nights, late tacos, a good patio.",
    taste: vec({ energy: 0.8, loudness: 0.75, crowdAge: 0.65, price: 0.4, dancing: 0.8, hiphop: 0.95, pop: 0.5, outdoors: 0.35, food: 0.5 }) },
  { username: "demo_sofia", displayName: "Sofia Brandt", homeCity: "New York", birthday: "1993-12-05",
    bio: "In SF every other month. Natural wine and gallery openings.",
    taste: vec({ energy: 0.35, loudness: 0.3, crowdAge: 0.4, price: 0.75, indie: 0.45, culture: 0.85, food: 0.6 }) },
  { username: "demo_kenji", displayName: "Kenji Watanabe", homeCity: "Tokyo", birthday: "1996-04-26",
    bio: "Visiting from Tokyo. Pop-ups, markets, anything that's only here this week.",
    taste: vec({ energy: 0.65, loudness: 0.5, crowdAge: 0.6, price: 0.4, dancing: 0.4, pop: 0.6, electronic: 0.4, culture: 0.6, outdoors: 0.4, food: 0.7 }) },
];

/** Friendships among the demo users, by index: a loose circle with a few chords, so everyone has mutuals. */
const DEMO_FRIENDSHIPS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [0, 4], [0, 5], [1, 6], [2, 6], [3, 7], [2, 4],
];

const CAPTIONS: Record<Bucket, string[]> = {
  loved: [
    "Exactly my kind of place.", "Came for one, stayed all night.", "Already planning the next visit.",
    "Bring friends. Trust me.", "This is why I live here.", "Worth crossing town for.",
  ],
  fine: ["Solid, wouldn't plan a night around it.", "Good for what it is.", "Fine in a pinch.", "Better with the right crowd."],
  didnt: ["Not for me.", "Once was enough.", "I see the appeal, it just isn't mine."],
};

const bucketFor = (share: number): Bucket =>
  share >= LOVED_MIN_SHARE ? "loved" : share >= FINE_MIN_SHARE ? "fine" : "didnt";

/**
 * Which places a person ranks, from their taste alone: mostly their best matches, a few they'd dislike,
 * the rest from the middle, each in the bucket its content score falls in (measured within the
 * person's own range of scores: 0 = their worst match among these places, 1 = their best).
 */
export function pickRankings(taste: number[], places: Doc<"places">[], count: number) {
  const scored = places
    .map((place) => ({ place, fit: contentScore(taste, venueVectorOf(place)) }))
    .sort((a, b) => b.fit - a.fit);
  const n = Math.min(count, scored.length);
  const favorites = Math.ceil(n * SHARE_FAVORITES);
  const dislikes = Math.min(Math.floor(n * SHARE_DISLIKES), scored.length - favorites);
  const middle = n - favorites - dislikes;
  const rest = scored.slice(favorites, scored.length - dislikes);
  const step = middle === 0 ? 1 : Math.max(1, Math.floor(rest.length / middle));
  const picked = [
    ...scored.slice(0, favorites),
    ...Array.from({ length: middle }, (_, k) => rest[k * step]).filter((row) => row !== undefined),
    ...(dislikes === 0 ? [] : scored.slice(-dislikes)),
  ];
  const worst = scored[scored.length - 1]?.fit ?? 0;
  const range = (scored[0]?.fit ?? 0) - worst || 1;
  return picked.map((row) => ({ ...row, bucket: bucketFor((row.fit - worst) / range) }));
}

async function demoUsers(ctx: MutationCtx) {
  return await ctx.db
    .query("users")
    .withIndex("by_username", (q) =>
      q.gte("username", DEMO_PREFIX).lt("username", DEMO_PREFIX + "￿"),
    )
    .take(DEMO_USERS.length * 2);
}

async function befriend(
  ctx: MutationCtx,
  userA: Id<"users">,
  userB: Id<"users">,
  status: "accepted" | "pending",
) {
  if (userA === userB || (await friendshipBetween(ctx, userA, userB)) !== null) {
    return 0;
  }
  await ctx.db.insert("friendships", { userA, userB, status });
  return 1;
}

export const run = internalMutation({
  args: { forUsername: v.optional(v.string()) },
  handler: async (ctx, { forUsername }) => {
    const now = Date.now();
    const places = await ctx.db
      .query("places")
      .withIndex("by_source", (q) => q.eq("source", "seed"))
      .take(SEED_PLACES_READ);
    if (places.length === 0) {
      throw new Error("No seeded places yet: run seedPlaces:run first");
    }
    const made = { users: 0, rankings: 0, posts: 0, comparisons: 0, friendships: 0, requests: 0, trips: 0 };

    const ids: Id<"users">[] = [];
    for (const [index, demo] of DEMO_USERS.entries()) {
      const profile = {
        username: demo.username,
        displayName: demo.displayName,
        homeCity: demo.homeCity,
        bio: demo.bio,
        birthday: demo.birthday,
        tasteVector: demo.taste,
        tastePrior: demo.taste,
      };
      const existing = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", demo.username))
        .first();
      let userId: Id<"users">;
      if (existing === null) {
        userId = await ctx.db.insert("users", profile);
        made.users += 1;
      } else {
        userId = existing._id;
        await ctx.db.patch("users", userId, profile);
      }
      ids.push(userId);

      // A second run leaves a demo user's rankings and posts as they are.
      const already = await ctx.db
        .query("rankings")
        .withIndex("by_user_category", (q) => q.eq("userId", userId))
        .first();
      if (already !== null) {
        continue;
      }
      const picks = pickRankings(demo.taste, places, MIN_RANKINGS + ((index * 3) % RANKINGS_SPREAD));
      const byCategory = new Map<Category, typeof picks>();
      for (const pick of picks) {
        byCategory.set(pick.place.category, [...(byCategory.get(pick.place.category) ?? []), pick]);
      }
      let serial = 0;
      for (const [category, inCategory] of byCategory) {
        // Positions and scores come from the same code rankings.rank uses.
        const order = [...inCategory].sort((a, b) => b.fit - a.fit);
        const placed = renumber(
          order.map((pick, position) => ({ id: pick.place._id, bucket: pick.bucket, position })),
        );
        const pickOf = new Map(order.map((pick) => [pick.place._id, pick]));
        for (const row of placed) {
          const pick = pickOf.get(row.id);
          if (pick === undefined) {
            continue;
          }
          serial += 1;
          // Spread over the last ten days, different for every person and place, the same on every run.
          const visitedAt = now - ((serial * 7_919_003 + index * 104_729_011) % SPREAD_MS) - HOUR_MS;
          const local = new Date(visitedAt + Math.round(pick.place.lng / DEGREES_PER_HOUR) * HOUR_MS);
          const rankingId = await ctx.db.insert("rankings", {
            userId,
            placeId: pick.place._id,
            category,
            bucket: row.bucket,
            position: row.position,
            score: row.score,
            tags: (pick.place.tags ?? []).filter((tag) => tag !== "demo").slice(0, 2),
            visitedAt,
            wasLocal: sameCity(demo.homeCity, pick.place.city),
            dayOfWeek: local.getUTCDay(),
            hour: local.getUTCHours(),
            groupSize: 1 + ((serial + index) % 4),
          });
          made.rankings += 1;
          const captions = CAPTIONS[row.bucket];
          await ctx.db.insert("posts", {
            userId,
            rankingId,
            targetKind: "place",
            targetId: pick.place._id,
            photos: [],
            caption: captions[(serial + index) % captions.length],
            visibility: "friends",
            createdAt: visitedAt,
          });
          made.posts += 1;
        }
        // Head-to-head rows for neighbours in the list (the better one won). These are records only:
        // place Elo is left alone so that `clear` puts everything back exactly.
        for (let k = 0; k + 1 < placed.length; k++) {
          await ctx.db.insert("comparisons", {
            userId,
            winnerId: placed[k].id,
            loserId: placed[k + 1].id,
            category,
            createdAt: now - SPREAD_MS + k,
          });
          made.comparisons += 1;
        }
      }
    }

    for (const [a, b] of DEMO_FRIENDSHIPS) {
      made.friendships += await befriend(ctx, ids[a], ids[b], "accepted");
    }

    if (forUsername !== undefined) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", forUsername))
        .first();
      if (user === null) {
        throw new Error(`No user named ${forUsername}`);
      }
      for (const demoId of ids.slice(0, FRIENDS_FOR_USER)) {
        made.friendships += await befriend(ctx, demoId, user._id, "accepted");
      }
      for (const demoId of ids.slice(FRIENDS_FOR_USER, FRIENDS_FOR_USER + REQUESTS_FOR_USER)) {
        made.requests += await befriend(ctx, demoId, user._id, "pending");
      }
      // One trip: a demo friend owns it, the user and another demo friend have joined, a few votes are in.
      const ownerId = ids[2];
      const owned = await ctx.db
        .query("trips")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .take(20);
      if (!owned.some((trip) => trip.name === TRIP_NAME)) {
        const anchor = places[0];
        const tripId = await ctx.db.insert("trips", {
          ownerId,
          name: TRIP_NAME,
          city: TRIP_CITY,
          lat: anchor.lat,
          lng: anchor.lng,
          vibe: "balanced",
          createdAt: now,
        });
        for (const memberId of [user._id, ids[0]]) {
          await ctx.db.insert("tripMembers", {
            tripId,
            userId: memberId,
            status: "joined",
            createdAt: now,
            invitedBy: ownerId,
          });
        }
        const favorites = pickRankings(DEMO_USERS[2].taste, places, TRIP_VOTES);
        for (const [k, pick] of favorites.entries()) {
          for (const voter of k === 0 ? [ownerId, ids[0]] : [ownerId]) {
            await ctx.db.insert("tripVotes", {
              tripId,
              userId: voter,
              targetKind: "place",
              targetId: pick.place._id,
              vote: 1,
              createdAt: now + k,
            });
          }
        }
        made.trips += 1;
      }
    }
    return made;
  },
});

export const clear = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ deletedUsers: number; continuing: boolean }> => {
    // Everything the seed made hangs off a demo user (their rankings, posts, comparisons, friendships
    // and requests in both directions, the trip they own with its members and votes), so deleting
    // those users' rows removes all of it and nothing else. Demo users never had a sign-in.
    let deletedUsers = 0;
    let continuing = false;
    for (const user of await demoUsers(ctx)) {
      if (await deleteUserRows(ctx, user._id)) {
        await ctx.db.delete("users", user._id);
        deletedUsers += 1;
      } else {
        continuing = true;
      }
    }
    if (continuing) {
      await ctx.scheduler.runAfter(0, internal.seedSocial.clear, {});
    }
    return { deletedUsers, continuing };
  },
});
