import { router } from "expo-router";
import { Pressable, Share, StyleSheet, View } from "react-native";
import { Avatar, Icon, Skeleton, Text, type IconName } from "../../components";
import { api, type FeedItem } from "../../lib/api";
import { categoryLabel, formatRelativeTime, formatScore, pluralize } from "../../lib/format";
import { postPath, ratePath, userPath, venuePath } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, fontWeight, palette, ratingColor } from "../../theme";
import { PostMedia, wentWithLine } from "../feed/PostMedia";

const AVATAR = 56;
const RING = 44;

/**
 * One friend's post on Home, laid out like the reference feed row: a large round avatar,
 * "<Name> ranked <Place>" with a grey line under it and the score in a thin grey ring at the right;
 * the picture when there is one; "Notes: ..." with the label bold; a tiny count line; the heart,
 * comment and send icons with a check-in-circle at the far right (rank it too); the time in grey.
 */
export function HomePost({ post, now, onComments }: { post: FeedItem; now: number; onComments: () => void }) {
  const { run: react, pending: reacting } = useMutationToast(api.posts.react);
  const { author, target } = post;
  const liked = post.myReaction !== undefined;
  const likes = post.reactionCount ?? 0;
  const commentCount = post.commentCount ?? 0;
  const facts = [...(post.insightChips ?? []), ...post.tags];
  const ranked = post.myScoreForIt !== undefined;

  // The backend's label ends with the score ("#1 of their bars · 9.5"); the ring already shows it.
  const scoreEnding = ` · ${formatScore(post.score)}`;
  const standing =
    post.label === target.name ? null : post.label.endsWith(scoreEnding) ? post.label.slice(0, -scoreEnding.length) : post.label;
  const detail = standing ?? categoryLabel(target.category);

  const short = formatRelativeTime(post.createdAt, now);
  const time = /^\d+[mhd]$/.test(short) ? `${short} ago` : short === "now" ? "Just now" : short;
  const counts = [
    likes > 0 ? pluralize(likes, "like") : "",
    commentCount > 0 ? pluralize(commentCount, "comment") : "",
  ].filter((part) => part !== "");

  const openVenue = () => router.push(venuePath(target.kind, target.id));
  const openAuthor = () => router.push(userPath(author.userId));
  const openPost = () => router.push(postPath(post.postId));
  // Sending my current emoji again is how the backend removes a reaction; with none, it adds the default heart.
  const onLike = () => void react(post.myReaction ? { postId: post.postId, emoji: post.myReaction } : { postId: post.postId });
  const onShare = () =>
    void Share.share({
      message: `${author.displayName} ranked ${target.name}${post.score > 0 ? ` ${formatScore(post.score)}` : ""} on Vioma`,
    }).catch(() => undefined);

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
          <Text numberOfLines={3} style={styles.headline}>
            <Text accessibilityLabel={`${author.displayName}'s profile`} onPress={openAuthor} style={styles.strong}>
              {author.displayName}
            </Text>
            <Text style={styles.verb}> ranked </Text>
            <Text accessibilityLabel={`Open ${target.name}`} onPress={openVenue} style={styles.strong}>
              {target.name}
            </Text>
            {wentWithLine(post.with) ? (
              <>
                <Text style={styles.verb}> with </Text>
                <Text style={styles.strong}>{wentWithLine(post.with)}</Text>
              </>
            ) : null}
          </Text>
          <Text numberOfLines={1} style={styles.detail}>
            {detail}
          </Text>
        </View>
        {post.score > 0 ? (
          <View accessibilityLabel={`Score ${formatScore(post.score)} out of 10`} style={styles.ring}>
            <Text style={[styles.score, { color: ratingColor(post.score) }]}>{post.score.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>

      <PostMedia photoUrls={post.photoUrls} placePhotoUrl={target.imageUrl} name={target.name} onPress={openVenue} />

      {post.caption || facts.length > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Open post" onPress={openPost} style={styles.body}>
          {post.caption ? (
            <Text numberOfLines={4} style={styles.note}>
              <Text style={styles.strong}>Notes: </Text>
              {post.caption}
            </Text>
          ) : null}
          {facts.length > 0 ? (
            <Text numberOfLines={2} style={styles.facts}>
              {facts.join(" · ")}
            </Text>
          ) : null}
        </Pressable>
      ) : null}

      {counts.length > 0 ? <Text style={styles.counts}>{counts.join(" · ")}</Text> : null}

      <View style={styles.actions}>
        <Action
          icon={liked ? "heartFilled" : "heart"}
          label="Like"
          color={liked ? colors.accent : colors.fg}
          selected={liked}
          disabled={reacting}
          onPress={onLike}
        />
        <Action icon="comment" label="Comments" color={colors.fg} onPress={onComments} />
        <Action icon="send" label="Share" color={colors.fg} onPress={onShare} />
        <View style={styles.flex} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ranked ? `You gave it ${formatScore(post.myScoreForIt ?? 0)}. Open ${target.name}` : "Rank it too"}
          onPress={ranked ? openVenue : () => router.push(ratePath(target.kind, target.id))}
          style={({ pressed }) => [styles.checkHit, pressed && styles.pressed]}
        >
          <View style={[styles.check, ranked && styles.checkDone]}>
            <Icon name={ranked ? "check" : "plus"} size={13} color={ranked ? colors.bg : colors.muted} />
          </View>
        </Pressable>
      </View>

      <Text style={styles.time}>{time}</Text>
    </View>
  );
}

function Action({
  icon,
  label,
  color,
  selected,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  color: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Icon name={icon} size={24} color={color} />
    </Pressable>
  );
}

/** The shape of a Home post while the feed is loading. */
export function HomePostSkeleton() {
  return (
    <View style={styles.top}>
      <Skeleton width={AVATAR} height={AVATAR} round={AVATAR / 2} />
      <View style={[styles.who, styles.lines]}>
        <Skeleton width="72%" height={15} />
        <Skeleton width="44%" height={12} />
      </View>
      <Skeleton width={RING} height={RING} round={RING / 2} />
    </View>
  );
}

const styles = StyleSheet.create({
  post: { gap: 10 },
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  top: { flexDirection: "row", alignItems: "center", gap: 14 },
  who: { flex: 1, gap: 3 },
  lines: { gap: 8 },
  headline: { fontSize: 16, lineHeight: 21, color: colors.fg },
  strong: { fontWeight: fontWeight.bold, color: colors.fg },
  verb: { fontWeight: fontWeight.regular, color: colors.fg },
  detail: { fontSize: 13, lineHeight: 18, color: colors.muted },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1,
    borderColor: palette.fieldPressed,
    alignItems: "center",
    justifyContent: "center",
  },
  score: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
  body: { gap: 4 },
  note: { fontSize: 15, lineHeight: 21, color: colors.fg },
  facts: { fontSize: 13, lineHeight: 18, color: colors.muted },
  counts: { fontSize: 12, lineHeight: 16, color: colors.fg },
  // The icons sit 44 tall but hug the lines around them, and the first lines up with the text edge.
  actions: { flexDirection: "row", alignItems: "center", marginVertical: -8, marginLeft: -10, marginRight: -10 },
  action: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  checkHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: { borderColor: ratingColor(9), backgroundColor: ratingColor(9) },
  time: { fontSize: 12, lineHeight: 16, color: colors.muted },
});
