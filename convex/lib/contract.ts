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
