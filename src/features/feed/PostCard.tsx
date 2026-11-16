import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Icon, IconButton, Skeleton, Text, type IconName } from "../../components";
import { api, type FeedItem, type Visibility } from "../../lib/api";
import { categoryLabel, formatRelativeTime, formatScore } from "../../lib/format";
import { ratePath, userPath, venuePath } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, fontWeight, palette, spacing } from "../../theme";
import { POST_MEDIA_HEIGHT, POST_MEDIA_RADIUS, PostMedia } from "./PostMedia";
import { ScoreRing } from "./ScoreRing";

/** The three choices behind "Who sees it", in the order they are offered. */
export const VISIBILITY_OPTIONS: { value: Visibility; label: string; icon: IconName }[] = [
  { value: "friends", label: "Friends", icon: "users" },
  { value: "public", label: "Public", icon: "globe" },
  { value: "private", label: "Only me", icon: "lock" },
];

export type PostCardProps = {
  post: FeedItem;
  /** `post.author.userId === me.userId`: shows who can see it and the "⋯" menu. */
  mine: boolean;
  /** From `useNow()`, for "2h". */
  now: number;
  /** The comment button: the feed opens the comment sheet, the post page focuses its comment box. */
  onComments: () => void;
  /** The "⋯" button, drawn at the end of the action row on my own post only. */
  onMenu?: () => void;
  /** Tapping the line under the headline (standing and time) opens the post's own page. Left out on that page. */
  onOpenPost?: () => void;
};

/**
 * One post, read top to bottom: "<Name> ranked <Place>" with the score in its ring, the picture,
 * what they said, the short answers, and the like, comment and rank buttons.
 * Everything shown is what `FeedItem` carries; nothing is computed here.
 */
export function PostCard({ post, mine, now, onComments, onMenu, onOpenPost }: PostCardProps) {
  const { run: react, pending: reacting } = useMutationToast(api.posts.react);
  const { author, target } = post;
  const liked = post.myReaction !== undefined;
  const reactionCount = post.reactionCount ?? 0;
  const commentCount = post.commentCount ?? 0;
  // The short answers and the tags, as they came, on one grey line.
  const facts = [...(post.insightChips ?? []), ...post.tags];
  const visibility = VISIBILITY_OPTIONS.find((option) => option.value === (post.visibility ?? "friends"));
  const time = formatRelativeTime(post.createdAt, now);
  const hasScore = post.score > 0;
  // The place's own photo, once the backend sends one with the post.
  const placePhotoUrl = (target as { imageUrl?: string }).imageUrl;

  // The backend's label ends with the score ("#1 of their bars · 9.5"); the score is already in
  // the ring, so that ending is not repeated. Any other label is shown as it came.
  const scoreEnding = ` · ${formatScore(post.score)}`;
  const standing =
    post.label === target.name ? null : post.label.endsWith(scoreEnding) ? post.label.slice(0, -scoreEnding.length) : post.label;

  // Under the headline: where it stands in their list, or what kind of place it is.
  const detail = standing ?? categoryLabel(target.category);

  const openVenue = () => router.push(venuePath(target.kind, target.id));
  const openAuthor = () => router.push(userPath(author.userId));
  // Sending my current emoji again is how the backend removes a reaction; with none, it adds the default heart.
  const onLike = () => void react(post.myReaction ? { postId: post.postId, emoji: post.myReaction } : { postId: post.postId });

  const likes = reactionCount === 1 ? "1 like" : `${reactionCount} likes`;
  const comments = commentCount === 1 ? "1 comment" : `${commentCount} comments`;

  return (
    <View style={styles.post}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${author.displayName}'s profile`}
          onPress={openAuthor}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Avatar name={author.displayName} uri={author.avatarUrl} size={AVATAR} />
        </Pressable>
        <View style={styles.who}>
          {/* "<Name> ranked <Place>": the name opens the person, the place opens the place. */}
          <Text numberOfLines={3} style={styles.headline}>
            <Text accessibilityLabel={`${author.displayName}'s profile`} onPress={openAuthor} style={styles.strong}>
              {author.displayName}
            </Text>
            <Text style={styles.verb}> ranked </Text>
            <Text accessibilityLabel={`Open ${target.name}`} onPress={openVenue} style={styles.strong}>
              {target.name}
            </Text>
          </Text>
          <Text numberOfLines={1} style={styles.place}>
            {detail}
          </Text>
        </View>
        {hasScore ? <ScoreRing score={post.score} /> : null}
      </View>

      {post.caption ? (
        <Text style={styles.caption}>
          <Text style={styles.strong}>Notes: </Text>
          {post.caption}
        </Text>
      ) : null}
      {facts.length > 0 ? (
        <View style={styles.facts}>
          {facts.map((fact, index) => (
            <View key={`${fact}-${index}`} style={styles.fact}>
              <Text numberOfLines={1} style={styles.factText}>
                {fact}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <PostMedia photoUrls={post.photoUrls} placePhotoUrl={placePhotoUrl} name={target.name} onPress={openVenue} />

      {reactionCount > 0 || commentCount > 0 ? (
        <Text style={styles.likes}>
          {[reactionCount > 0 ? likes : null, commentCount > 0 ? comments : null].filter(Boolean).join("  ·  ")}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Action
          icon={liked ? "heartFilled" : "heart"}
          accessibilityLabel="Like"
          color={liked ? colors.accent : colors.fg}
          selected={liked}
          disabled={reacting}
          onPress={onLike}
        />
        <Action icon="comment" accessibilityLabel="Comments" color={colors.fg} onPress={onComments} />
        {mine || post.myScoreForIt !== undefined ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rank it too"
            hitSlop={4}
            onPress={() => router.push(ratePath(target.kind, target.id))}
            style={({ pressed }) => [styles.rankToo, pressed && styles.pressed]}
          >
            <Icon name="plusCircle" size={22} color={colors.fg} />
            <Text style={styles.rankTooText}>Rank it too</Text>
          </Pressable>
        )}
        <View style={styles.flex} />
        {mine && onMenu ? (
          <IconButton icon="more" accessibilityLabel="Post options" size={44} plain color={colors.fg} onPress={onMenu} style={styles.menu} />
        ) : mine ? null : post.myScoreForIt !== undefined ? (
          <View accessibilityLabel={`You gave it ${formatScore(post.myScoreForIt)}`} style={styles.yours}>
            <Text style={styles.yoursText}>You gave it {formatScore(post.myScoreForIt)}</Text>
            <View style={styles.checkRing}>
              <Icon name="check" size={13} color={palette.soft} />
            </View>
          </View>
        ) : null}
      </View>

      <Pressable
        accessibilityRole={onOpenPost ? "button" : undefined}
        accessibilityLabel={onOpenPost ? "Open post" : time}
        disabled={!onOpenPost}
        hitSlop={{ top: 6, bottom: 14, left: 8, right: 8 }}
        onPress={onOpenPost}
        style={({ pressed }) => [styles.line, pressed && styles.pressed]}
      >
        <Text style={styles.time}>{time}</Text>
        {mine && visibility ? (
          <View accessibilityLabel={`Who sees it: ${visibility.label}`} style={styles.visibility}>
            <Text style={styles.time}>·</Text>
            <Icon name={visibility.icon} size={11} color={colors.muted} />
            <Text style={styles.time}>{visibility.label}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

/** Like and comment: a line icon, 44 tall so it is easy to hit; the counts are on the line above. */
function Action({
  icon,
  accessibilityLabel,
  color,
  selected,
  disabled,
  onPress,
}: {
  icon: IconName;
  accessibilityLabel: string;
  color: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Icon name={icon} size={24} color={color} />
    </Pressable>
  );
}

/** The shape of a post while the feed is loading. */
export function PostSkeleton() {
  return (
    <View style={styles.post}>
      <View style={styles.top}>
        <Skeleton width={AVATAR} height={AVATAR} round={AVATAR / 2} />
        <View style={[styles.flex, styles.lines]}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="40%" height={11} />
        </View>
        <Skeleton width={44} height={44} round={22} />
      </View>
      <Skeleton height={POST_MEDIA_HEIGHT} round={POST_MEDIA_RADIUS} />
      <Skeleton width="70%" height={14} />
    </View>
  );
}

/** A few `PostSkeleton`s, for the first load. */
export function PostSkeletons({ count = 2 }: { count?: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.skeletons}>
      {Array.from({ length: count }, (_, index) => (
        <PostSkeleton key={index} />
      ))}
    </View>
  );
}

/** The hairline between two posts in a list, drawn edge to edge by the list. */
export function PostDivider() {
  return <View style={styles.divider} />;
}

/** The space above and below the hairline between two posts. */
export const POST_GAP = 16;

/** The author's picture, the size of the one in the reference feed. */
const AVATAR = 56;

const styles = StyleSheet.create({
  post: { gap: 10 },
  flex: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: AVATAR },
  who: { flex: 1, gap: 3 },
  headline: { fontSize: 16, lineHeight: 21, color: colors.fg, letterSpacing: -0.2 },
  strong: { fontWeight: fontWeight.bold, color: colors.fg },
  verb: { fontWeight: fontWeight.regular, color: colors.fg },
  place: { fontSize: 13, lineHeight: 18, color: colors.muted },
  caption: { fontSize: 15, lineHeight: 21, color: colors.fg, marginTop: 2 },
  // The short answers: tiny grey pills that wrap.
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  fact: { height: 24, paddingHorizontal: 9, borderRadius: 12, justifyContent: "center", backgroundColor: colors.surface, maxWidth: "100%" },
  factText: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.medium, color: palette.soft },
  likes: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.semibold, color: colors.fg, marginTop: 2 },
  // The icon row hugs the lines around it.
  actions: { flexDirection: "row", alignItems: "center", gap: 2, marginVertical: -8, marginLeft: -10, minHeight: 44 },
  action: { alignItems: "center", justifyContent: "center", width: 44, minHeight: 44 },
  rankToo: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 6 },
  rankTooText: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.semibold, color: colors.fg },
  // The dots line up with the picture's right edge.
  menu: { marginRight: -11 },
  yours: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  yoursText: { fontSize: 12, lineHeight: 16, color: colors.muted, fontVariant: ["tabular-nums"] },
  checkRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  line: { flexDirection: "row", alignItems: "center", gap: 4 },
  visibility: { flexDirection: "row", alignItems: "center", gap: 4 },
  time: { fontSize: 12, lineHeight: 16, color: colors.muted },
  pressed: { opacity: 0.6 },
  lines: { gap: spacing.sm },
  skeletons: { gap: POST_GAP * 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: POST_GAP },
});
