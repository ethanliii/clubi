// Owner: People session. Pure code for everything social: ranking positions, who may see a post,
// notification preferences, friend suggestions (ALGORITHM.md §6), trip member fit (§5.3), feed order (§7).
// No runtime imports, so `node --test` loads this file directly (tests/people.social.test.mjs).
// Where a formula needs the taste similarity of two people, the caller passes `similarity(a, b)` from recs.ts.
import type { Bucket, Category, FriendStatus, NotifPrefs, NotificationItem, Visibility } from "./contract";

// ── Weights and limits ──────────────────────────────────────────────────────────────────────────────
export const BUCKET_ORDER: Bucket[] = ["loved", "fine", "didnt"];
export const BUCKET_RANGE: Record<Bucket, [number, number]> = {
  loved: [6.7, 10],
  fine: [3.4, 6.7],
  didnt: [0, 3.3],
};
/**
 * A user's first rankings in a category are scored directly, 1.0 to 10.0: there is nothing yet to
 * compare against. From this many rankings on, a new one is placed by "which was better?" instead,
 * and every score in the category comes from its position.
 */
export const DIRECT_SCORE_RANKINGS = 5;
export const MIN_DIRECT_SCORE = 1;
export const MAX_DIRECT_SCORE = 10;

/** The bucket a directly given score belongs to. */
export const bucketOfScore = (score: number): Bucket =>
  score >= BUCKET_RANGE.loved[0] ? "loved" : score >= BUCKET_RANGE.fine[0] ? "fine" : "didnt";

/** The score to show for a ranking: the one its owner gave while the category is still small, else the one its position gives. */
export const shownScore = (placedScore: number, manualScore: number | undefined, rankingsInCategory: number) =>
  manualScore !== undefined && rankingsInCategory <= DIRECT_SCORE_RANKINGS ? manualScore : placedScore;

export const CATEGORY_NOUN: Record<Category, string> = {
  nightlife: "bars",
  food: "food spots",
  culture: "culture spots",
  outdoors: "outdoor spots",
  live: "shows",
  popup: "pop-ups",
};
export const FRIEND_W = { mutual: 0.4, taste: 0.3, coRank: 0.2, city: 0.1 };
export const AA_FULL = 3;
export const CO_RANK_SHRINK = 2;
export const SCORE_SPAN = 9;
export const TASTE_REASON_MIN_PCT = 70;
export const SHARED_PLACES_REASON_MIN = 2;
export const TRIP_W = { taste: 0.45, local: 0.25, shared: 0.2, friends: 0.1 };
export const TRIP_SHARED_FULL = 5;
export const TRIP_TASTE_REASON_MIN = 0.7;
export const TRIP_UPDATE_COOLDOWN_MS = 60 * 60 * 1000;
export const FEED_TAU_MS = 6 * 60 * 60 * 1000;
export const FEED_W = { closeness: 0.3, relevance: 0.2, photo: 0.1 };
export const DISPLAY_NAME_MAX = 40;
export const BIO_MAX = 160;
export const COMMENT_MAX = 500;
export const CAPTION_MAX = 500;
export const MAX_POST_PHOTOS = 4;
export const COMPARE_AGREE_MAX_GAP = 1.5;
export const COMPARE_SPLIT_MIN_GAP = 3;

const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// ── Ranking: positions and scores inside a category ─────────────────────────────────────────────────

/** The score of position `position` (1 = best) among `count` items of one bucket, one decimal. */
export function bucketScore(bucket: Bucket, position: number, count: number): number {
  const [low, high] = BUCKET_RANGE[bucket];
  const score = high - ((position - 0.5) * (high - low)) / count;
  return Math.round(score * 10) / 10;
}

export type Placed<T> = { id: T; bucket: Bucket; position: number; score: number; overall: number };

/**
 * Re-numbers one category: every bucket gets positions 1..n with no gaps and the scores that go with
 * them, and `overall` counts across buckets (loved first). `insert` places one more item at a 1-based
 * position inside its bucket (clamped; anything that isn't a number goes last). `rankings.rank`,
 * `rankings.remove` and the demo seed all use this, so the three can never disagree.
 */
export function renumber<T>(
  rows: { id: T; bucket: Bucket; position: number }[],
  insert?: { id: T; bucket: Bucket; position: number },
): Placed<T>[] {
  const placed: Placed<T>[] = [];
  let above = 0;
  for (const bucket of BUCKET_ORDER) {
    const ordered = rows
      .filter((row) => row.bucket === bucket && row.id !== insert?.id)
      .map((row, index) => ({ row, index }))
      .sort((a, b) => a.row.position - b.row.position || a.index - b.index)
      .map(({ row }) => row.id);
    if (insert !== undefined && insert.bucket === bucket) {
      const wanted = Number.isFinite(insert.position) ? Math.round(insert.position) - 1 : ordered.length;
      ordered.splice(clip(wanted, 0, ordered.length), 0, insert.id);
    }
    for (const [index, id] of ordered.entries()) {
      placed.push({
        id,
        bucket,
        position: index + 1,
        score: bucketScore(bucket, index + 1, ordered.length),
        overall: above + index + 1,
      });
    }
    above += ordered.length;
  }
  return placed;
}

export const comparisonKey = (winnerId: string, loserId: string) => `${winnerId}>${loserId}`;

/**
 * The comparisons the taste model has not learned from yet: drops the ones already stored for this user
 * (same winner, same loser) and repeats inside the same call. A flipped outcome is new information and stays.
 */
export function unseenComparisons<C extends { winnerId: string; loserId: string }>(incoming: C[], seen: Iterable<string>): C[] {
  const known = new Set(seen);
  const fresh: C[] = [];
  for (const comparison of incoming) {
    const key = comparisonKey(comparison.winnerId, comparison.loserId);
    if (known.has(key)) continue;
    known.add(key);
    fresh.push(comparison);
  }
  return fresh;
}

export const rankLabel = (whose: "your" | "their", overall: number, category: Category, score: number) =>
  `#${overall} of ${whose} ${CATEGORY_NOUN[category]} · ${score.toFixed(1)}`;

// ── Notifications ───────────────────────────────────────────────────────────────────────────────────

export const NOTIF_PREF_FOR_TYPE: Record<NotificationItem["type"], keyof NotifPrefs> = {
  friend_posted: "friendPosts",
  friend_ranked_same: "friendPosts",
  friend_request: "friendRequests",
  friend_accepted: "friendRequests",
  event_tonight: "eventsTonight",
  artist_event: "artistAlerts",
  trip_invite: "tripUpdates",
  trip_update: "tripUpdates",
  post_reaction: "reactions",
  post_comment: "reactions",
};

/** A missing pref means on. Nobody is notified about their own action. */
export function shouldNotify(p: {
  receiverId: string; actorId?: string; type: NotificationItem["type"]; prefs?: Partial<NotifPrefs>;
}): boolean {
  if (p.actorId !== undefined && p.actorId === p.receiverId) return false;
  return p.prefs?.[NOTIF_PREF_FOR_TYPE[p.type]] !== false;
}

export function fullNotifPrefs(prefs?: Partial<NotifPrefs>): NotifPrefs {
  return {
    friendPosts: prefs?.friendPosts !== false,
    friendRequests: prefs?.friendRequests !== false,
    eventsTonight: prefs?.eventsTonight !== false,
    artistAlerts: prefs?.artistAlerts !== false,
    tripUpdates: prefs?.tripUpdates !== false,
    reactions: prefs?.reactions !== false,
  };
}

// ── Who can see a post ──────────────────────────────────────────────────────────────────────────────

/** The author always; `public` anyone signed in; `friends` (and unset) accepted friends; `private` nobody else. */
export function canSeePost(p: { viewerId: string | null; authorId: string; visibility?: Visibility; isFriend: boolean }): boolean {
  if (p.viewerId === null) return false;
  if (p.viewerId === p.authorId) return true;
  if (p.visibility === "public") return true;
  if (p.visibility === "private") return false;
  return p.isFriend;
}

// ── Friends ─────────────────────────────────────────────────────────────────────────────────────────

/** My status with the other person of a friendship row (`userA` asked `userB`). A declined pair reads as none. */
export function friendStatus(
  row: { userA: string; userB: string; status: "pending" | "accepted" | "declined" } | null | undefined,
  me: string,
): FriendStatus {
  if (row === null || row === undefined || row.status === "declined") return "none";
  if (row.status === "accepted") return "friends";
  return row.userA === me ? "outgoing" : "incoming";
}

/** Adamic–Adar over the mutual friends: each counts 1 / ln(1 + their number of friends). */
export function adamicAdar(mutualDegrees: number[]): number {
  return mutualDegrees.reduce((sum, degree) => sum + 1 / Math.log(1 + Math.max(1, degree)), 0);
}

/** Every "% taste match" in the app: `sim` is `similarity(a, b)` from recs.ts, in [-1, 1]. */
export function tasteMatchPct(sim: number): number {
  if (!Number.isFinite(sim)) return 50;
  return Math.round(100 * clip((sim + 1) / 2, 0, 1));
}

/** Agreement on the places both ranked, shrunk toward 0 when there are few of them. */
export function coRankAgreement(pairs: { mine: number; theirs: number }[]): number {
  const n = pairs.length;
  if (n === 0) return 0;
  const meanGap = pairs.reduce((sum, pair) => sum + Math.abs(pair.mine - pair.theirs), 0) / n;
  return clip((n / (n + CO_RANK_SHRINK)) * (1 - meanGap / SCORE_SPAN), 0, 1);
}

/** ALGORITHM.md §6. `aa` = adamicAdar(...), `taste` = similarity (negatives count as 0), `coRank` = coRankAgreement(...). */
export function friendSuggestionScore(p: { aa: number; taste: number; coRank: number; sameCity: boolean }): number {
  const score = FRIEND_W.mutual * Math.min(1, Math.max(0, p.aa) / AA_FULL)
    + FRIEND_W.taste * clip(p.taste, 0, 1)
    + FRIEND_W.coRank * clip(p.coRank, 0, 1)
    + FRIEND_W.city * (p.sameCity ? 1 : 0);
  return Math.round(clip(score, 0, 1) * 1000) / 1000;
}

/** Never empty. The first that applies, plus the taste match when it is worth showing. */
export function suggestionReason(p: {
  mutualCount: number; mutualName?: string;
  sharedPlaces: number; sharedPlaceName?: string;
  sameCity: boolean; city?: string;
  tasteMatchPct: number;
}): string {
  const taste = `${p.tasteMatchPct}% taste match`;
  let lead: string | undefined;
  if (p.mutualCount === 1) lead = p.mutualName ? `Friends with ${p.mutualName}` : "1 mutual friend";
  else if (p.mutualCount > 1) lead = `${p.mutualCount} mutual friends`;
  else if (p.sharedPlaces >= SHARED_PLACES_REASON_MIN) {
    lead = p.sharedPlaceName
      ? `You both ranked ${p.sharedPlaceName} and ${p.sharedPlaces - 1} more`
      : `You both ranked ${p.sharedPlaces} of the same places`;
  } else if (p.sameCity) lead = p.city?.trim() ? `Also in ${p.city.trim()}` : "Lives in your city";
  if (lead === undefined) return taste;
  return p.tasteMatchPct >= TASTE_REASON_MIN_PCT ? `${lead} · ${taste}` : lead;
}

// ── Trips ───────────────────────────────────────────────────────────────────────────────────────────

/** The mean of several taste vectors (the group's taste). Empty input gives an empty vector. */
export function centroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const length = vectors[0].length;
  return Array.from({ length }, (_, k) => vectors.reduce((sum, vector) => sum + (vector[k] ?? 0), 0) / vectors.length);
}

/**
 * ALGORITHM.md §5.3: how well a friend fits a trip. `tasteSim` = similarity(friend's taste, the joined
 * members' mean taste); `sharedPlaces` = places both the friend and any joined member ranked;
 * `friendShare` = share of joined members who are friends with them.
 */
export function tripFit(c: {
  tasteSim: number; isLocal: boolean; sharedPlaces: number; friendShare: number;
  city?: string; sharedWithName?: string; friendsOnTrip?: number;
}): { fitPct: number; reason: string } {
  const taste = clip(Number.isFinite(c.tasteSim) ? c.tasteSim : 0, 0, 1);
  const fit = TRIP_W.taste * taste
    + TRIP_W.local * (c.isLocal ? 1 : 0)
    + TRIP_W.shared * Math.min(1, Math.max(0, c.sharedPlaces) / TRIP_SHARED_FULL)
    + TRIP_W.friends * clip(c.friendShare, 0, 1);
  const pct = tasteMatchPct(c.tasteSim);
  const friendsOnTrip = c.friendsOnTrip ?? 0;
  let reason: string;
  if (c.isLocal) {
    reason = c.city?.trim() ? `Lives in ${c.city.trim()}, knows the city` : "Lives there, knows the city";
    if (taste >= TRIP_TASTE_REASON_MIN) reason += ` · ${pct}% match with the group`;
  } else if (taste >= TRIP_TASTE_REASON_MIN) reason = `${pct}% taste match with the group`;
  else if (c.sharedPlaces >= SHARED_PLACES_REASON_MIN) {
    reason = c.sharedWithName
      ? `Ranked ${c.sharedPlaces} of the same places as ${c.sharedWithName}`
      : `Ranked ${c.sharedPlaces} of the same places as the group`;
  } else if (c.friendShare > 0 && friendsOnTrip > 0) {
    reason = friendsOnTrip === 1 ? "Friends with 1 person on this trip" : `Friends with ${friendsOnTrip} people on this trip`;
  } else reason = "Your friend";
  return { fitPct: Math.round(100 * clip(fit, 0, 1)), reason };
}

export type VoteRow = { targetKind: "place" | "event"; targetId: string; userId: string; vote: number; createdAt: number };
export type ShortlistTally = {
  kind: "place" | "event"; targetId: string; votesUp: number; votesDown: number;
  myVote?: 1 | -1; addedBy?: string; firstAt: number;
};

/** One row per voted item. `addedBy` is whoever gave the earliest +1 still standing. */
export function tallyVotes(votes: VoteRow[], me?: string): ShortlistTally[] {
  const byTarget = new Map<string, ShortlistTally & { addedAt: number }>();
  for (const vote of votes) {
    if (vote.vote !== 1 && vote.vote !== -1) continue;
    let tally = byTarget.get(vote.targetId);
    if (tally === undefined) {
      tally = { kind: vote.targetKind, targetId: vote.targetId, votesUp: 0, votesDown: 0, firstAt: vote.createdAt, addedAt: Infinity };
      byTarget.set(vote.targetId, tally);
    }
    tally.firstAt = Math.min(tally.firstAt, vote.createdAt);
    if (vote.vote === 1) {
      tally.votesUp += 1;
      if (vote.createdAt < tally.addedAt) {
        tally.addedAt = vote.createdAt;
        tally.addedBy = vote.userId;
      }
    } else tally.votesDown += 1;
    if (me !== undefined && vote.userId === me) tally.myVote = vote.vote;
  }
  return [...byTarget.values()].map(({ addedAt: _addedAt, ...tally }) => tally);
}

/** The shortlist: every item with at least one +1, most net votes first, then most +1s, then oldest. */
export function shortlistOrder(tallies: ShortlistTally[]): ShortlistTally[] {
  return tallies
    .filter((tally) => tally.votesUp >= 1)
    .sort((a, b) =>
      (b.votesUp - b.votesDown) - (a.votesUp - a.votesDown) || b.votesUp - a.votesUp || a.firstAt - b.firstAt);
}

/** `YYYY-MM-DD` → ms at midnight UTC, or undefined when it is not a real date. */
export function parseDay(day: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== day) return undefined;
  return ms;
}

// ── Feed ────────────────────────────────────────────────────────────────────────────────────────────

/** ALGORITHM.md §7, only for re-ordering inside one page: recency first, then closeness, relevance, photo. */
export function feedScore(p: { ageMs: number; closeness: number; relevant: boolean; hasPhoto: boolean }): number {
  const recency = Math.exp(-Math.max(0, p.ageMs) / FEED_TAU_MS);
  return recency * (1 + FEED_W.closeness * clip(p.closeness, 0, 1) + FEED_W.relevance * (p.relevant ? 1 : 0) + FEED_W.photo * (p.hasPhoto ? 1 : 0));
}

// ── Text people type ────────────────────────────────────────────────────────────────────────────────

export function cleanDisplayName(text: string): string {
  const name = text.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > DISPLAY_NAME_MAX) throw new Error(`Your name must be 1 to ${DISPLAY_NAME_MAX} characters`);
  return name;
}

export function cleanBio(text: string): string {
  const bio = text.trim();
  if (bio.length > BIO_MAX) throw new Error(`Your bio can be at most ${BIO_MAX} characters`);
  return bio;
}

export function cleanBirthday(text: string): string {
  if (parseDay(text) === undefined) throw new Error("Birthday must be a real date, written YYYY-MM-DD");
  return text;
}

export function cleanComment(text: string): string {
  const comment = text.trim();
  if (comment.length < 1) throw new Error("Write something first");
  if (comment.length > COMMENT_MAX) throw new Error(`A comment can be at most ${COMMENT_MAX} characters`);
  return comment;
}

/** undefined when there is no caption left after trimming. */
export function cleanCaption(text: string | undefined): string | undefined {
  const caption = text?.trim();
  if (caption === undefined || caption === "") return undefined;
  if (caption.length > CAPTION_MAX) throw new Error(`A caption can be at most ${CAPTION_MAX} characters`);
  return caption;
}

// ── Comparing two people ────────────────────────────────────────────────────────────────────────────

/** Of the places both ranked, how often they landed in the same bucket (0–100). undefined with nothing shared. */
export function agreePct(pairs: { mine: Bucket; theirs: Bucket }[]): number | undefined {
  if (pairs.length === 0) return undefined;
  return Math.round((100 * pairs.filter((pair) => pair.mine === pair.theirs).length) / pairs.length);
}

const listOf = (words: string[]) =>
  words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

/** One line, never empty: "You two agree on bars, split on food". */
export function compareSummary(shared: { category: Category; myScore: number; theirScore: number }[], matchPct: number): string {
  if (shared.length === 0) return `${matchPct}% taste match · no places in common yet`;
  const gaps = new Map<Category, number[]>();
  for (const row of shared) gaps.set(row.category, [...(gaps.get(row.category) ?? []), Math.abs(row.myScore - row.theirScore)]);
  const agree: string[] = [];
  const split: string[] = [];
  for (const [category, list] of gaps) {
    const mean = list.reduce((sum, gap) => sum + gap, 0) / list.length;
    if (mean <= COMPARE_AGREE_MAX_GAP) agree.push(CATEGORY_NOUN[category]);
    else if (mean >= COMPARE_SPLIT_MIN_GAP) split.push(CATEGORY_NOUN[category]);
  }
  if (agree.length > 0 && split.length > 0) return `You two agree on ${listOf(agree)}, split on ${listOf(split)}`;
  if (agree.length > 0) return `You two agree on ${listOf(agree)}`;
  if (split.length > 0) return `You two split on ${listOf(split)}`;
  return `${matchPct}% taste match · close but not identical on the ${shared.length === 1 ? "place" : `${shared.length} places`} you both ranked`;
}
