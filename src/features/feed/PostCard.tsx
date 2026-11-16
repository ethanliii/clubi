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

  return (
    <View style={styles.post}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${author.displayName}'s profile`}
          hitSlop={4}
          onPress={openAuthor}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Avatar name={author.displayName} uri={author.avatarUrl} size={40} />
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
          <Pressable
            accessibilityRole={onOpenPost ? "button" : undefined}
            accessibilityLabel={onOpenPost ? "Open post" : `${detail}, ${time}`}
            disabled={!onOpenPost}
            hitSlop={8}
            onPress={onOpenPost}
            style={({ pressed }) => [styles.line, pressed && styles.pressed]}
          >
            <Text muted numberOfLines={1} style={[styles.meta, styles.shrink]}>
              {detail}
            </Text>
            <Text muted style={styles.meta}>
              · {time}
            </Text>
            {mine && visibility ? (
              <View accessibilityLabel={`Who sees it: ${visibility.label}`} style={styles.visibility}>
                <Icon name={visibility.icon} size={12} color={colors.muted} />
                <Text muted style={styles.meta}>
                  {visibility.label}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        {hasScore ? <ScoreRing score={post.score} /> : null}
      </View>

      <PostMedia photoUrls={post.photoUrls} placePhotoUrl={placePhotoUrl} name={target.name} onPress={openVenue} />

      {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
      {facts.length > 0 ? (
        <Text muted numberOfLines={2} style={styles.meta}>
          {facts.join(" · ")}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Action
          icon={liked ? "heartFilled" : "heart"}
          accessibilityLabel="Like"
          color={liked ? palette.danger : palette.soft}
          selected={liked}
          disabled={reacting}
          count={reactionCount}
          onPress={onLike}
        />
        <Action icon="comment" accessibilityLabel="Comments" color={palette.soft} count={commentCount} onPress={onComments} />
        <View style={styles.flex} />
        {mine && onMenu ? (
          <IconButton icon="more" accessibilityLabel="Post options" size={44} plain color={palette.soft} onPress={onMenu} style={styles.menu} />
        ) : mine ? null : post.myScoreForIt !== undefined ? (
          <View accessibilityLabel={`You gave it ${formatScore(post.myScoreForIt)}`} style={styles.yours}>
            <Text muted style={styles.meta}>
              You gave it
            </Text>
            <ScoreRing score={post.myScoreForIt} size={32} />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rank it too"
            hitSlop={8}
            onPress={() => router.push(ratePath(target.kind, target.id))}
            style={({ pressed }) => [styles.rankToo, pressed && styles.pressed]}
          >
            <Icon name="plusCircle" size={20} color={palette.soft} />
            <Text style={styles.rankTooText}>Rank it too</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Like and comment: an icon with its count beside it, 44 tall so it is easy to hit. */
function Action({
  icon,
  accessibilityLabel,
  color,
  count,
  selected,
  disabled,
  onPress,
}: {
  icon: IconName;
  accessibilityLabel: string;
  color: string;
  count: number;
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
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Icon name={icon} size={21} color={color} />
      {count > 0 ? <Text style={styles.count}>{count}</Text> : null}
    </Pressable>
  );
}

/** The shape of a post while the feed is loading. */
export function PostSkeleton() {
  return (
    <View style={styles.post}>
      <View style={styles.top}>
        <Skeleton width={40} height={40} round={20} />
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
export const POST_GAP = 14;

const styles = StyleSheet.create({
  post: { gap: 10 },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  who: { flex: 1, gap: 2 },
  headline: { fontSize: 15, lineHeight: 20, color: colors.fg },
  strong: { fontWeight: fontWeight.bold, color: colors.fg },
  verb: { fontWeight: fontWeight.regular, color: palette.soft },
  line: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { fontSize: 13, lineHeight: 18 },
  visibility: { flexDirection: "row", alignItems: "center", gap: 3, marginLeft: 4 },
  caption: { fontSize: 15, lineHeight: 21 },
  // The row hugs what is above it; the icons are quiet until tapped.
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: -6, marginBottom: -8, minHeight: 44 },
  action: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 40, minHeight: 44 },
  count: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.medium, color: palette.soft, fontVariant: ["tabular-nums"] },
  // The dots line up with the picture's right edge.
  menu: { marginRight: -11 },
  yours: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  rankToo: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  rankTooText: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.semibold, color: palette.soft },
  pressed: { opacity: 0.6 },
  lines: { gap: spacing.sm },
  skeletons: { gap: POST_GAP * 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: POST_GAP },
});
