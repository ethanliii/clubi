import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Button, Chip, ChipRow, Icon, IconButton, ScoreBadge, Skeleton, Text, type IconName } from "../../components";
import { api, type FeedItem, type Visibility } from "../../lib/api";
import { formatRelativeTime, formatScore } from "../../lib/format";
import { ratePath, userPath, venuePath } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, fontWeight, radius, spacing } from "../../theme";
import { PostPhotos } from "./PostPhotos";

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
 * One post: who ranked what, the backend's label and score, photos, caption, tags, what I gave it,
 * and the like and comment buttons. Everything shown is what `FeedItem` carries; nothing is computed here.
 */
export function PostCard({ post, mine, now, onComments, onMenu, onOpenPost }: PostCardProps) {
  const { run: react, pending: reacting } = useMutationToast(api.posts.react);
  const { author, target } = post;
  const liked = post.myReaction !== undefined;
  const reactionCount = post.reactionCount ?? 0;
  const commentCount = post.commentCount ?? 0;
  const chips = [...post.tags, ...(post.insightChips ?? [])];
  const visibility = VISIBILITY_OPTIONS.find((option) => option.value === (post.visibility ?? "friends"));
  const time = formatRelativeTime(post.createdAt, now);
  const openVenue = () => router.push(venuePath(target.kind, target.id));

  // Sending my current emoji again is how the backend removes a reaction; with none, it adds the default heart.
  const onLike = () => void react(post.myReaction ? { postId: post.postId, emoji: post.myReaction } : { postId: post.postId });

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${author.displayName}'s profile`}
          onPress={() => router.push(userPath(author.userId))}
          style={({ pressed }) => [styles.author, pressed && styles.pressed]}
        >
          <Avatar name={author.displayName} uri={author.avatarUrl} size={40} />
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.name}>
              {author.displayName}
            </Text>
            <Text variant="caption" muted>
              ranked
            </Text>
          </View>
        </Pressable>
        {mine && onMenu ? <IconButton icon="more" accessibilityLabel="Post options" onPress={onMenu} /> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${target.name}`}
        onPress={openVenue}
        style={({ pressed }) => [styles.place, pressed && styles.pressed]}
      >
        <View style={styles.flex}>
          <Text variant="title" numberOfLines={2}>
            {target.name}
          </Text>
          {/* Without a ranking the backend's label is just the place's name again. */}
          {post.label !== target.name ? <Text muted>{post.label}</Text> : null}
        </View>
        {post.score > 0 ? <ScoreBadge score={post.score} size="lg" /> : null}
      </Pressable>

      <PostPhotos urls={post.photoUrls} name={target.name} onPress={openVenue} />

      {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}

      {chips.length > 0 ? (
        <ChipRow>
          {chips.map((chip, index) => (
            <Chip key={`${chip}-${index}`} label={chip} size="sm" />
          ))}
        </ChipRow>
      ) : null}

      {post.myScoreForIt !== undefined ? (
        <Text muted>You gave it {formatScore(post.myScoreForIt)}</Text>
      ) : !mine ? (
        <Button
          title="Rank it too"
          accessibilityLabel="Rank it too"
          variant="ghost"
          onPress={() => router.push(ratePath(target.kind, target.id))}
          style={styles.rankToo}
        />
      ) : null}

      <View style={styles.actions}>
        <IconButton
          icon={liked ? "heartFilled" : "heart"}
          accessibilityLabel="Like"
          color={liked ? colors.accent : colors.fg}
          selected={liked}
          disabled={reacting}
          label={reactionCount > 0 ? String(reactionCount) : undefined}
          onPress={onLike}
          plain
        />
        <IconButton
          icon="comment"
          accessibilityLabel="Comments"
          label={commentCount > 0 ? String(commentCount) : undefined}
          onPress={onComments}
          plain
        />
        <View style={styles.flex} />
        {mine && visibility ? (
          <View accessibilityLabel={`Who sees it: ${visibility.label}`} style={styles.visibility}>
            <Icon name={visibility.icon} size={13} color={colors.muted} />
            <Text variant="caption" muted>
              {visibility.label}
            </Text>
          </View>
        ) : null}
        {onOpenPost ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open post"
            hitSlop={12}
            onPress={onOpenPost}
            style={({ pressed }) => [styles.time, pressed && styles.pressed]}
          >
            <Text variant="caption" muted>
              {time}
            </Text>
            <Icon name="chevron" size={12} color={colors.muted} />
          </Pressable>
        ) : (
          <Text variant="caption" muted>
            {time}
          </Text>
        )}
      </View>
    </View>
  );
}

/** The shape of a post while the feed is loading. */
export function PostSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Skeleton width={40} height={40} round={20} />
        <View style={[styles.flex, styles.lines]}>
          <Skeleton width="45%" height={14} />
          <Skeleton width="20%" height={11} />
        </View>
      </View>
      <Skeleton width="70%" height={18} />
      <Skeleton height={150} round={radius.lg} />
      <Skeleton width="55%" height={12} />
    </View>
  );
}

/** A few `PostSkeleton`s, for the first load. */
export function PostSkeletons({ count = 3 }: { count?: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.skeletons}>
      {Array.from({ length: count }, (_, index) => (
        <PostSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  flex: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  author: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 40 },
  name: { fontSize: 15, fontWeight: fontWeight.semibold },
  place: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 },
  caption: { fontSize: 15, lineHeight: 21 },
  rankToo: { width: "auto", alignSelf: "flex-start", paddingVertical: spacing.sm + 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: -spacing.xs },
  visibility: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  time: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 40 },
  pressed: { opacity: 0.6 },
  lines: { gap: spacing.sm },
  skeletons: { gap: spacing.lg },
});
