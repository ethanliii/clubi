# clubi API contract (backend ↔ UI)

Same as section 6 of `ethan.md`. Captain 1's first task (R1) commits it as `docs/CONTRACT.md` and `convex/lib/contract.ts`. Owners: C1 = Ethan's Recs captain, C2 = Ethan's People captain, C3 = Ethan's Live-data captain.

**Rules**
- UI reads data only through these functions (`useQuery` / `useMutation`) with Convex's generated types. No screen computes a score, rank, tier, pin size or "why".
- The owner may change the math any time. The shape may only grow: new fields optional; never rename or remove a field.
- Every score shown comes with a non-empty `why`. `useQuery` returns `undefined` while loading: show a skeleton.
- Need a field that isn't here? Ask its owner to add it as optional.


`convex/lib/contract.ts` (owner Captain 1):

```ts
import { Id } from "../_generated/dataModel";

export type Category = "nightlife" | "food" | "culture" | "outdoors" | "live" | "popup";
export type Filter = "tonight" | "bars" | "food" | "events" | "popups" | "outdoors" | "all";
export type Tier = "top" | "good" | "other";   // top = top 5 (big ringed pin), good = labeled pin, other = dot
export type Bucket = "loved" | "fine" | "didnt";
export type Source = "seed" | "osm" | "ticketmaster" | "luma" | "partiful" | "manual";

export type FriendScore = { userId: Id<"users">; displayName: string; avatarUrl?: string; score: number; isLocal?: boolean };

export type NearbyItem = {
  kind: "place" | "event";
  id: Id<"places"> | Id<"events">;
  name: string;
  category: Category;
  subcategory?: string;
  lat: number; lng: number;
  distanceMeters: number;
  score: number;        // predicted 1–10, one decimal
  matchPct: number;     // 0–100
  why: string;          // never empty
  tier: Tier;
  rank: number;         // 1 = best
  imageUrl?: string;
  blurb?: string;
  priceLevel?: 1 | 2 | 3 | 4;
  openNow?: boolean;
  startsAt?: number;    // events, ms epoch
  source?: Source;
  sourceUrl?: string;   // "View on Luma / Partiful / Ticketmaster"
  friends: FriendScore[];   // up to 3
};

export type NearbyResult = { items: NearbyItem[]; center: { lat: number; lng: number }; algo: string; generatedAt: number; attribution?: string };

export type VenueDetail = NearbyItem & {
  address?: string; hours?: string; tags: string[];
  breakdown?: { label: string; value: number }[];
  friendRankings: (FriendScore & { caption?: string; when: number; photoUrl?: string })[];
  ticketUrl?: string;
  myRanking?: { score: number; position: number; outOf: number; bucket: Bucket };
};

export type RankResult = { rankingId: Id<"rankings">; score: number; position: number; outOf: number; label: string };

export type FeedItem = {
  postId: Id<"posts">;
  author: { userId: Id<"users">; displayName: string; avatarUrl?: string };
  target: { kind: "place" | "event"; id: Id<"places"> | Id<"events">; name: string; category: Category };
  score: number; position: number; label: string;
  caption?: string; photoUrls: string[]; tags: string[]; createdAt: number;
  myScoreForIt?: number;
};

export type NotificationItem = {
  id: Id<"notifications">;
  type: "friend_posted" | "friend_ranked_same" | "event_tonight" | "friend_request";
  title: string; body: string;
  link?: string;        // expo-router path, e.g. "/venue/place/<id>"
  read: boolean; createdAt: number;
  actor?: { userId: Id<"users">; displayName: string; avatarUrl?: string };
};
```

| Function | Kind | Args → Returns | Owner |
| --- | --- | --- | --- |
| `api.discover.nearby` | query | `{lat, lng, radiusMeters?=2500, filter?="all", limit?=60}` → `NearbyResult` | C1 |
| `api.discover.tonight` | query | `{lat, lng}` → `{topPicks, friendsGoing, events}: NearbyItem[]` | C1 |
| `api.discover.plan` | query (stretch) | `{lat, lng, memberIds, vibe}` → 3 stops with each member's score | C1 |
| `api.places.get` | query | `{kind, id}` → `VenueDetail \| null` | C1 |
| `api.places.search` | query | `{text, lat, lng}` → `NearbyItem[]` (≤10) | C1 |
| `lib/useNearby.ts` | hook | `useNearby(filter)` → `NearbyResult \| undefined` | C1 |
| `lib/demoLocation.ts` | hook | `useDemoLocation()` → `{lat, lng, isDemo, setDemo}` | C1 |
| `api.users.me` | query | `{}` → `{userId, username, displayName, avatarUrl?, homeCity?, onboarded, tasteSummary: {label, pct}[]} \| null` | C2 |
| `api.users.saveQuiz` | mutation | `{answers: number[][]}` → `{tasteSummary}` | C2 |
| `api.rankings.listInBucket` | query | `{category, bucket}` → `{id, kind, name, score, position}[]` | C2 |
| `api.rankings.rank` | mutation | `{kind, id, bucket, position, comparisons: {winnerId, loserId}[], tags, caption?, photoStorageId?}` → `RankResult` (also creates the post + notifications) | C2 |
| `api.notifications.list` | query | `{}` → `NotificationItem[]` (newest 50) | C2 |
| `api.notifications.unreadCount` | query | `{}` → `number` | C2 |
| `api.notifications.markAllRead` | mutation | `{}` → `null` | C2 |
| `notify(ctx, {userId, type, title, body, link?, actorId?})` | plain helper exported from `convex/notifications.ts` | for other owners' mutations | C2 |
| `api.posts.friendsFeed` | query | `{}` → `FeedItem[]` | Albert |
| `api.posts.generateUploadUrl` | mutation | `{}` → `string` | Albert |
| `api.friends.list` / `request({username})` / `respond({requestId, accept})` | query / mutations | | Albert |
| `api.profile.get` | query | `{userId?}` → `{user, lists: {category, items}[], counts}` | Albert |

