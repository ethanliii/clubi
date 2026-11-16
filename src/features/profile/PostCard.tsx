import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { IconButton, ScoreBadge, Text } from "../../components";
import { api, type FeedItem } from "../../lib/api";
import { formatRelativeTime } from "../../lib/format";
import { postPath, venuePath } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, fontWeight, ratingColor, spacing } from "../../theme";
import { PlacePhoto } from "./PlacePhoto";

/**
 * The backend's label is "#1 of their bars · 9.4". The ring beside it already says the score and
 * the page already says whose list it is, so the line keeps only the standing: "#1 in Bars".
 */
function standingOf(label: string) {
  const bare = label.replace(/\s·\s\d+(\.\d+)?$/, "");
  const match = /^#(\d+) of (?:their|your|my) (.+)$/.exec(bare);
  if (!match) return bare;
  const noun = match[2] ?? "";
  return `#${match[1]} in ${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;
}

const sentence = (words: string[]) => {
  const line = words.join(", ");
  return line.charAt(0).toUpperCase() + line.slice(1);
};

/**
 * A person's recent post on their profile: the place and its standing with the score ring, the
 * photo (theirs, else the place's `imageUrl`; a small category tile when there is neither), the
 * note, then like and comment with their counts and the time on its own line. Tapping the body
 * opens the venue; the comment button opens the post.
 */
export function PostCard({ post, now, imageUrl }: { post: FeedItem; now: number; imageUrl?: string }) {
  const { run: react, pending: reacting } = useMutationToast(api.posts.react);
  const photo = post.photoUrls[0] ?? imageUrl;
  const tags = [...post.tags, ...(post.insightChips ?? [])];
  const likes = post.reactionCount ?? 0;
  const comments = post.commentCount ?? 0;
  const liked = post.myReaction !== undefined;
  const onLike = () => {
    if (reacting) return;
    void react(post.myReaction ? { postId: post.postId, emoji: post.myReaction } : { postId: post.postId });
  };

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={post.target.name}
        onPress={() => router.push(venuePath(post.target.kind, post.target.id))}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        <View style={styles.row}>
          {photo ? null : <PlacePhoto category={post.target.category} width={56} height={56} round={10} />}
          <View style={styles.titles}>
            <Text numberOfLines={2} style={styles.name}>
              {post.target.name}
            </Text>
            <Text numberOfLines={1} style={styles.standing}>
              {standingOf(post.label)}
            </Text>
          </View>
          <View>
            <ScoreBadge score={post.score} size="md" />
          </View>
        </View>
        {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
        {tags.length > 0 ? (
          <Text numberOfLines={1} style={styles.tags}>
            {sentence(tags)}
          </Text>
        ) : null}
        {photo ? <PlacePhoto uri={photo} category={post.target.category} height={200} round={12} style={styles.photo} /> : null}
        {post.myScoreForIt !== undefined ? (
          <Text variant="caption" muted>
            {"You gave it "}
            <Text variant="caption" style={[styles.mine, { color: ratingColor(post.myScoreForIt) }]}>
              {post.myScoreForIt.toFixed(1)}
            </Text>
          </Text>
        ) : null}
      </Pressable>
      <View style={styles.footer}>
        <IconButton
          icon={liked ? "heartFilled" : "heart"}
          accessibilityLabel={liked ? "Unlike" : "Like"}
          plain
          size={44}
          selected={liked}
          color={liked ? colors.accent : colors.fg}
          label={likes > 0 ? String(likes) : undefined}
          onPress={onLike}
        />
        <IconButton
          icon="comment"
          accessibilityLabel="Comments"
          plain
          size={44}
          color={colors.fg}
          label={comments > 0 ? String(comments) : undefined}
          onPress={() => router.push(postPath(post.postId))}
        />
      </View>
      <Text style={styles.time}>{formatRelativeTime(post.createdAt, now)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {},
  body: { gap: spacing.xs },
  pressed: { opacity: 0.7 },
  titles: { flex: 1, gap: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingBottom: spacing.xs },
  name: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  standing: { fontSize: 13, lineHeight: 18, color: colors.muted },
  caption: { fontSize: 15, lineHeight: 21 },
  tags: { fontSize: 13, lineHeight: 18, color: colors.muted },
  photo: { marginTop: spacing.xs + 2 },
  mine: { fontWeight: fontWeight.bold },
  // The first glyph lines up with the text above it: a 44 box around a 22 icon.
  footer: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginLeft: -11, minHeight: 44 },
  time: { fontSize: 12, lineHeight: 16, color: colors.low },
});
