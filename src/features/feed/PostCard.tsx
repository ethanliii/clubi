import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Button, Chip, ChipRow, Icon, IconButton, Skeleton, Text, type IconName } from "../../components";
import { api, type FeedItem, type Visibility } from "../../lib/api";
import { formatRelativeTime, formatScore } from "../../lib/format";
import { ratePath, userPath, venuePath } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, fontWeight, radius, ratingColor, spacing } from "../../theme";
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

  const openAuthor = () => router.push(userPath(author.userId));

  // Bryan's feed post: who ranked what with the score beside it, photos, notes, tags, actions, time.
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
        <View style={styles.flex}>
          <View style={styles.sentence}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${author.displayName}'s profile`}
              hitSlop={8}
              onPress={openAuthor}
              style={({ pressed }) => [styles.shrink, pressed && styles.pressed]}
            >
              <Text numberOfLines={1} style={styles.bold}>
                {author.displayName}
              </Text>
            </Pressable>
            <Text>ranked</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${target.name}`}
              hitSlop={8}
              onPress={openVenue}
              style={({ pressed }) => [styles.shrink, pressed && styles.pressed]}
            >
              <Text numberOfLines={2} style={styles.bold}>
                {target.name}
              </Text>
            </Pressable>
          </View>
          {/* Without a ranking the backend's label is just the place's name again. */}
          {post.label !== target.name ? (
            <Text variant="caption" muted>
              {post.label}
            </Text>
          ) : null}
        </View>
        {post.score > 0 ? (
          // The score in a rating-coloured ring, as on Bryan's feed and on the profile's posts.
          <View accessibilityLabel={`Score ${post.score.toFixed(1)}`} style={[styles.ring, { borderColor: ratingColor(post.score) }]}>
            <Text style={[styles.bold, { color: ratingColor(post.score) }]}>{post.score.toFixed(1)}</Text>
          </View>
        ) : null}
        {mine && onMenu ? <IconButton icon="more" accessibilityLabel="Post options" size={36} onPress={onMenu} /> : null}
      </View>

      <PostPhotos urls={post.photoUrls} name={target.name} onPress={openVenue} />

      {post.caption ? (
        <Text>
          <Text style={styles.bold}>Notes: </Text>
          {post.caption}
        </Text>
      ) : null}

      {chips.length > 0 ? (
        <ChipRow style={styles.chips}>
          {chips.map((chip, index) => (
            <Chip key={`${chip}-${index}`} label={chip} size="sm" />
          ))}
        </ChipRow>
      ) : null}

      {post.myScoreForIt !== undefined ? (
        <Text variant="caption" muted>
          You gave it{" "}
          <Text variant="caption" style={[styles.bold, { color: ratingColor(post.myScoreForIt) }]}>
            {formatScore(post.myScoreForIt)}
          </Text>
        </Text>
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
          size={40}
          plain
        />
        <IconButton
          icon="comment"
          accessibilityLabel="Comments"
          label={commentCount > 0 ? String(commentCount) : undefined}
          onPress={onComments}
          size={40}
          plain
        />
        <View style={styles.flex} />
        {post.myScoreForIt === undefined && !mine ? (
          <Button
            title="Rank it too"
            accessibilityLabel="Rank it too"
            variant="ghost"
            onPress={() => router.push(ratePath(target.kind, target.id))}
            style={styles.rankToo}
          />
        ) : null}
      </View>

      <View style={styles.foot}>
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
        <View style={styles.flex} />
        {mine && visibility ? (
          <View accessibilityLabel={`Who sees it: ${visibility.label}`} style={styles.visibility}>
            <Icon name={visibility.icon} size={13} color={colors.muted} />
            <Text variant="caption" muted>
              {visibility.label}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The shape of a post while the feed is loading. */
export function PostSkeleton() {
  return (
    <View style={styles.post}>
      <View style={styles.top}>
        <Skeleton width={40} height={40} round={20} />
        <View style={[styles.flex, styles.lines]}>
          <Skeleton width="65%" height={14} />
          <Skeleton width="30%" height={11} />
        </View>
        <Skeleton width={44} height={44} round={22} />
      </View>
      <Skeleton height={190} round={radius.lg} />
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
  // Flat, as on Bryan's feed: no card, a line under each post.
  post: { gap: 10, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  flex: { flex: 1 },
  shrink: { flexShrink: 1, maxWidth: "100%" },
  bold: { fontWeight: fontWeight.bold },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  ring: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  sentence: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: spacing.xs },
  chips: { gap: 6 },
  rankToo: { width: "auto", paddingVertical: spacing.sm, paddingHorizontal: spacing.md + 2, borderRadius: radius.pill },
  actions: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: -spacing.xs },
  foot: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  visibility: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  time: { flexDirection: "row", alignItems: "center", gap: 2 },
  pressed: { opacity: 0.6 },
  lines: { gap: spacing.sm },
  skeletons: { gap: spacing.lg },
});
