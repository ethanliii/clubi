import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Icon, IconButton, Skeleton, Text, type IconName } from "../../components";
import { api, type FeedItem, type Visibility } from "../../lib/api";
import { categoryHue, categoryLabel, formatRelativeTime, formatScore } from "../../lib/format";
import { ratePath, userPath, venuePath } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, fontWeight, ratingColor, spacing } from "../../theme";
import { POST_MEDIA_HEIGHT, POST_MEDIA_RADIUS, PostMedia } from "./PostMedia";

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
  /** The "⋯" button, drawn on my own post only. */
  onMenu?: () => void;
  /** Tapping the time opens the post's own page. Left out on that page. */
  onOpenPost?: () => void;
};

/**
 * One post, read top to bottom: who and when, the picture with the place and the score on it,
 * what they said, the short answers, and the like, comment and rank buttons.
 * Everything shown is what `FeedItem` carries; nothing is computed here.
 */
export function PostCard({ post, mine, now, onComments, onMenu, onOpenPost }: PostCardProps) {
  const { run: react, pending: reacting } = useMutationToast(api.posts.react);
  const { author, target } = post;
  const liked = post.myReaction !== undefined;
  const reactionCount = post.reactionCount ?? 0;
  const commentCount = post.commentCount ?? 0;
  const answers = post.insightChips ?? [];
  const visibility = VISIBILITY_OPTIONS.find((option) => option.value === (post.visibility ?? "friends"));
  const time = formatRelativeTime(post.createdAt, now);
  const hasScore = post.score > 0;
  // The place's own photo, once the backend sends one with the post.
  const placePhotoUrl = (target as { imageUrl?: string }).imageUrl;

  // The backend's label ends with the score ("#1 of their bars · 9.5"); the score is already the
  // big number on the picture, so that ending is not repeated. Any other label is shown as it came.
  const scoreEnding = ` · ${formatScore(post.score)}`;
  const standing =
    post.label === target.name ? null : post.label.endsWith(scoreEnding) ? post.label.slice(0, -scoreEnding.length) : post.label;

  const openVenue = () => router.push(venuePath(target.kind, target.id));
  const openAuthor = () => router.push(userPath(author.userId));
  // Sending my current emoji again is how the backend removes a reaction; with none, it adds the default heart.
  const onLike = () => void react(post.myReaction ? { postId: post.postId, emoji: post.myReaction } : { postId: post.postId });

  return (
    <View style={styles.post}>
      <View style={styles.top}>
        {/* The avatar opens the profile too; the name beside it is the button screen readers and tests find. */}
        <Pressable
          accessible={false}
          aria-hidden
          tabIndex={-1}
          onPress={openAuthor}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Avatar name={author.displayName} uri={author.avatarUrl} size={40} />
        </Pressable>
        <View style={styles.who}>
          <View style={styles.line}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${author.displayName}'s profile`}
              hitSlop={10}
              onPress={openAuthor}
              style={({ pressed }) => [styles.shrink, pressed && styles.pressed]}
            >
              <Text numberOfLines={1} style={styles.author}>
                {author.displayName}
              </Text>
            </Pressable>
            {onOpenPost ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open post"
                hitSlop={12}
                onPress={onOpenPost}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text muted style={styles.meta}>
                  {time}
                </Text>
              </Pressable>
            ) : (
              <Text muted style={styles.meta}>
                {time}
              </Text>
            )}
          </View>
          {standing || (mine && visibility) ? (
            <View style={styles.line}>
              {standing ? (
                <Text muted numberOfLines={1} style={[styles.meta, styles.shrink]}>
                  {standing}
                </Text>
              ) : null}
              {mine && visibility ? (
                <View accessibilityLabel={`Who sees it: ${visibility.label}`} style={styles.visibility}>
                  <Icon name={visibility.icon} size={12} color={colors.muted} />
                  <Text muted style={styles.meta}>
                    {visibility.label}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        {mine && onMenu ? (
          <IconButton icon="more" accessibilityLabel="Post options" size={44} plain color={colors.muted} onPress={onMenu} style={styles.menu} />
        ) : null}
      </View>

      <PostMedia
        photoUrls={post.photoUrls}
        placePhotoUrl={placePhotoUrl}
        name={target.name}
        detail={categoryLabel(target.category)}
        score={hasScore ? post.score : undefined}
        hue={categoryHue(target.category)}
        onPress={openVenue}
      />

      {post.caption || answers.length > 0 || post.tags.length > 0 ? (
        <View style={styles.said}>
          {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
          {answers.length > 0 || post.tags.length > 0 ? (
            <View style={styles.facts}>
              {answers.map((answer, index) => (
                <View key={`${answer}-${index}`} accessibilityLabel={answer} style={styles.answer}>
                  <Text style={styles.answerText}>{answer}</Text>
                </View>
              ))}
              {post.tags.length > 0 ? (
                <Text muted numberOfLines={1} style={[styles.meta, styles.shrink]}>
                  {post.tags.join(" · ")}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Action
          icon={liked ? "heartFilled" : "heart"}
          accessibilityLabel="Like"
          color={liked ? colors.accent : colors.fg}
          selected={liked}
          disabled={reacting}
          count={reactionCount}
          onPress={onLike}
        />
        <Action icon="comment" accessibilityLabel="Comments" color={colors.fg} count={commentCount} onPress={onComments} />
        <View style={styles.flex} />
        {post.myScoreForIt !== undefined ? (
          <Text muted style={styles.meta}>
            You gave it{" "}
            <Text style={[styles.mine, { color: ratingColor(post.myScoreForIt) }]}>{formatScore(post.myScoreForIt)}</Text>
          </Text>
        ) : !mine ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rank it too"
            hitSlop={8}
            onPress={() => router.push(ratePath(target.kind, target.id))}
            style={({ pressed }) => [styles.rankToo, pressed && styles.pressed]}
          >
            <Text style={styles.rankTooText}>Rank it too</Text>
            <Icon name="chevron" size={14} color={colors.fg} />
          </Pressable>
        ) : null}
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
      <Icon name={icon} size={23} color={color} />
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
          <Skeleton width="45%" height={14} />
          <Skeleton width="30%" height={11} />
        </View>
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

/** The space between two posts in a list. No line: the pictures separate them. */
export const POST_GAP = 36;

const styles = StyleSheet.create({
  post: { gap: spacing.md },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  who: { flex: 1, gap: 1 },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  author: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.semibold },
  meta: { fontSize: 13, lineHeight: 18 },
  visibility: { flexDirection: "row", alignItems: "center", gap: 3 },
  // The dots line up with the picture's right edge.
  menu: { marginRight: -12 },
  said: { gap: 6 },
  caption: { fontSize: 16, lineHeight: 23 },
  facts: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.sm, rowGap: 6 },
  answer: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.surface },
  answerText: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.medium },
  // The row hugs the text above it.
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.xl, marginTop: -6, minHeight: 44 },
  action: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 32, minHeight: 44 },
  count: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.medium, fontVariant: ["tabular-nums"] },
  mine: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.bold },
  rankToo: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44 },
  rankTooText: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.semibold },
  pressed: { opacity: 0.6 },
  lines: { gap: spacing.sm },
  skeletons: { gap: POST_GAP },
});
