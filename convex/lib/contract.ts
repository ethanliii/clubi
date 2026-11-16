import { Id } from "../_generated/dataModel";

export type Category = "nightlife" | "food" | "culture" | "outdoors" | "live" | "popup";
export type Filter = "tonight" | "bars" | "food" | "events" | "popups" | "outdoors" | "all";
export type Tier = "top" | "good" | "other";   // top = top 5 (big ringed pin), good = labeled pin, other = dot
export type Bucket = "loved" | "fine" | "didnt";
export type Source = "seed" | "osm" | "ticketmaster" | "luma" | "partiful" | "manual" | "eventbrite" | "google";

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
  // v2, all optional
  performers?: string[];    // events: who is playing / hosting
  saved?: boolean;          // I saved it ("want to go")
  going?: boolean;          // I marked "going" (events)
  ratingCount?: number;     // how many clubi rankings it has
  // v3, optional: set when imageUrl is a Google Places photo. Show it as small text on or under the image.
  imageAttribution?: string;   // e.g. "Photo: Ana Lopez"
};

export type NearbyResult = { items: NearbyItem[]; center: { lat: number; lng: number }; algo: string; generatedAt: number; attribution?: string };

export type VenueDetail = NearbyItem & {
  address?: string; hours?: string; tags: string[];
  breakdown?: { label: string; value: number }[];
  friendRankings: (FriendScore & { caption?: string; when: number; photoUrl?: string })[];
  ticketUrl?: string;
  myRanking?: { score: number; position: number; outOf: number; bucket: Bucket };
  // v2, all optional
  insights?: { highlights: string[]; bestFor: string[] };   // from post-rating answers, see VenueInsights
  performerCards?: PerformerCard[];
  website?: string; phone?: string;
};

export type RankResult = { rankingId: Id<"rankings">; score: number; position: number; outOf: number; label: string };

export type FeedItem = {
  postId: Id<"posts">;
  author: { userId: Id<"users">; displayName: string; avatarUrl?: string };
  target: { kind: "place" | "event"; id: Id<"places"> | Id<"events">; name: string; category: Category; imageUrl?: string };
  score: number; position: number; label: string;
  caption?: string; photoUrls: string[]; tags: string[]; createdAt: number;
  myScoreForIt?: number;
  // v2, all optional
  rankingId?: Id<"rankings">;
  visibility?: Visibility;
  reactionCount?: number; myReaction?: string; commentCount?: number;
  insightChips?: string[];   // short answers from the post-rating questions, e.g. "Packed", "Mostly 20s"
};

export type NotificationItem = {
  id: Id<"notifications">;
  type: "friend_posted" | "friend_ranked_same" | "event_tonight" | "friend_request"
    | "friend_accepted" | "artist_event" | "trip_invite" | "trip_update" | "post_reaction" | "post_comment";
  title: string; body: string;
  link?: string;        // expo-router path, e.g. "/venue/place/<id>"
  read: boolean; createdAt: number;
  actor?: { userId: Id<"users">; displayName: string; avatarUrl?: string };
};

export type PlanSlot = "early" | "mid" | "late";
export type PlanMember = { userId: Id<"users">; displayName: string; avatarUrl?: string };
export type PlanStop = NearbyItem & {
  slot: PlanSlot;
  slotLabel: string;      // "Start", "Then", "End the night"
  memberScores: (PlanMember & { score: number })[];   // the item's score is the group score
};
export type PlanResult = { stops: PlanStop[]; members: PlanMember[]; vibe: string; center: { lat: number; lng: number }; algo: string; generatedAt: number };

// ─────────────────────────────────────────────────────────────────────────────
// v2 (Nov 15, afternoon): social, settings, venue insights, trips, performers.
// Same rule as above: shapes only grow. Never rename or remove a field.
// ─────────────────────────────────────────────────────────────────────────────

export type Visibility = "friends" | "public" | "private";
export type UserCard = { userId: Id<"users">; username: string; displayName: string; avatarUrl?: string; homeCity?: string };

// Friends (owner: People)
export type FriendStatus = "none" | "friends" | "incoming" | "outgoing" | "self";
export type FriendItem = UserCard & { since?: number; tasteMatchPct?: number; rankedCount?: number };
export type FriendRequestItem = { requestId: Id<"friendships">; user: UserCard; createdAt?: number; mutualCount?: number };
export type FriendsOverview = { friends: FriendItem[]; incoming: FriendRequestItem[]; outgoing: FriendRequestItem[] };
export type UserSearchResult = UserCard & { status: FriendStatus; requestId?: Id<"friendships">; mutualCount?: number };
export type FriendSuggestion = UserCard & {
  reason: string;          // never empty, e.g. "3 mutual friends · 82% taste match"
  mutualCount: number; tasteMatchPct: number; sharedPlaces: number;
  score: number;           // 0–1, list is already sorted by it
};

// Feed (owner: People)
export type CommentItem = { id: Id<"comments">; author: UserCard; text: string; createdAt: number; mine: boolean };

// Profile (owner: People)
export type RankedListItem = {
  rankingId: Id<"rankings">; kind: "place" | "event"; id: Id<"places"> | Id<"events">;
  name: string; category: Category; score: number; position: number; bucket: Bucket; imageUrl?: string; rankedAt: number;
};
export type ProfileResult = {
  user: UserCard & { bio?: string; isMe: boolean; status: FriendStatus; requestId?: Id<"friendships"> };
  canSee: boolean;         // false = private or not friends: show the header only
  counts: { ranked: number; friends: number; posts: number };
  tasteSummary: { label: string; pct: number }[];
  lists: { category: Category; noun: string; items: RankedListItem[] }[];
  recentPosts: FeedItem[];
};
export type CompareResult = {
  me: UserCard; them: UserCard;
  tasteMatchPct: number;                       // 0–100 from the two taste vectors
  agreePct?: number;                           // of the places you both ranked, how often you put them in the same bucket
  dims: { label: string; me: number; them: number }[];   // 0–100 meters, same labels as tasteSummary
  shared: { kind: "place" | "event"; id: Id<"places"> | Id<"events">; name: string; category: Category; myScore: number; theirScore: number; imageUrl?: string }[];
  theirTopNewToMe: RankedListItem[];           // their best places I have not ranked
  summary: string;                             // one line, never empty
};

// Settings (owner: People)
export type NotifPrefs = {
  friendPosts: boolean; friendRequests: boolean; eventsTonight: boolean;
  artistAlerts: boolean; tripUpdates: boolean; reactions: boolean;
};
export type SettingsResult = {
  username: string; displayName: string; bio?: string; avatarUrl?: string; homeCity?: string; birthday?: string;
  defaultVisibility: Visibility;
  discoverable: boolean;   // show me in search and friend suggestions
  notifPrefs: NotifPrefs;
};

// Venue insights: the multiple-choice questions asked right after a ranking (owner: Brain)
export type InsightOption = { id: string; label: string };
export type InsightQuestion = { id: string; text: string; multi: boolean; options: InsightOption[] };
export type InsightAnswer = { questionId: string; optionIds: string[] };
export type InsightDistribution = {
  questionId: string; text: string; total: number;
  options: (InsightOption & { count: number; pct: number })[];
  top?: string;            // label of the leading option once there are enough answers
};
export type VenueInsights = {
  kind: "place" | "event"; id: Id<"places"> | Id<"events">;
  nRatings: number; avgScore?: number; nAnswers: number;
  distributions: InsightDistribution[];
  highlights: string[];    // "Packed after 11", "Mostly 20s", "$$"
  bestFor: string[];       // "Dancing", "Date night"
  confidence: "low" | "medium" | "high";
};
export type VenueDashboard = VenueInsights & {
  audience: { label: string; pct: number }[];          // taste profile of people who loved it
  localsPct: number;                                    // share of raters who are locals
  buckets: { loved: number; fine: number; didnt: number };
  visitsByHour: number[];                               // 24 counts
  visitsByDay: number[];                                // 7 counts, 0 = Sunday
  winRate?: number;                                     // share of head-to-head comparisons it won
  beats: { id: Id<"places"> | Id<"events">; name: string; wins: number; losses: number }[];
  alsoLoved: { kind: "place" | "event"; id: Id<"places"> | Id<"events">; name: string; lift: number }[];
  trend: { weekStart: number; avgScore: number; n: number }[];
};

// Trips and groups (tables + CRUD owner: People; group scoring owner: Brain)
export type TripMemberStatus = "invited" | "joined" | "declined";
export type TripSummary = {
  tripId: Id<"trips">; name: string; city?: string; startDate?: number; endDate?: number;
  memberCount: number; myStatus: TripMemberStatus | "owner"; ownerName: string;
};
export type TripShortlistItem = {
  kind: "place" | "event"; id: Id<"places"> | Id<"events">; name: string; category: Category;
  votesUp: number; votesDown: number; myVote?: 1 | -1; addedBy?: UserCard;
  imageUrl?: string;
};
export type TripDetail = TripSummary & {
  lat?: number; lng?: number; vibe?: string;
  members: (UserCard & { status: TripMemberStatus; isOwner: boolean; isLocal?: boolean })[];
  shortlist: TripShortlistItem[];
};
export type TripMemberSuggestion = UserCard & { reason: string; fitPct: number; isLocal: boolean };
export type GroupItem = NearbyItem & {               // score = the group score
  memberScores: (PlanMember & { score: number })[];
  agreement: number;                                  // 0–1, 1 = everyone scores it the same
};
export type GroupResult = { items: GroupItem[]; members: PlanMember[]; center: { lat: number; lng: number }; algo: string; generatedAt: number };

// Performers: artists, DJs, teams, hosts (owner: Data)
export type PerformerCard = {
  performerId: Id<"performers">; name: string; imageUrl?: string; genres: string[];
  following: boolean;
  affinity?: number;       // 0–10, how much I like them, from my rankings of their events
  nextEvent?: { id: Id<"events">; title: string; startsAt: number; venueName?: string };
};

// Follows and public accounts (owner: Bryan, convex/follows.ts). Additive: decision Q20.
export type FollowStatus = {
  isPublic: boolean;        // public accounts can be followed without a request
  followers: number; following: number;
  iFollow: boolean;         // the viewer follows this user
  isMe: boolean;
};

// Saves (owner: People)
export type SaveType = "want" | "going";
export type SavedItem = {
  kind: "place" | "event"; id: Id<"places"> | Id<"events">; name: string; category: Category;
  type: SaveType; createdAt: number; startsAt?: number; imageUrl?: string; lat: number; lng: number;
};
