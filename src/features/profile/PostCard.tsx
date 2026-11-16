import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { IconButton, ScoreBadge, Text } from "../../components";
import type { FeedItem } from "../../lib/api";
import { formatRelativeTime, pluralize } from "../../lib/format";
import { postPath, venuePath } from "../../lib/links";
import { colors, fontWeight, ratingColor, spacing } from "../../theme";
import { PlacePhoto } from "./PlacePhoto";

/**
 * A person's recent post on their profile. With a photo (theirs, else the place's `imageUrl`) the
 * photo leads and carries the name; without one it is a quiet row. The backend's label
 * ("#1 of their bars · 9.4"), caption and tags are shown as sent. Tapping opens the venue; the
 * comment button opens the post.
 */
export function PostCard({ post, now, imageUrl }: { post: FeedItem; now: number; imageUrl?: string }) {
  const photo = post.photoUrls[0] ?? imageUrl;
  const tags = [...post.tags, ...(post.insightChips ?? [])];
  const likes = post.reactionCount ?? 0;
  const comments = post.commentCount ?? 0;
  const counts = [likes > 0 ? pluralize(likes, "like") : "", comments > 0 ? pluralize(comments, "comment") : ""]
    .filter((part) => part !== "")
    .join(" · ");
  const meta = [formatRelativeTime(post.createdAt, now), ...tags].join(" · ");

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={post.target.name}
        onPress={() => router.push(venuePath(post.target.kind, post.target.id))}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        {photo ? (
          <PlacePhoto uri={photo} category={post.target.category} height={220} round={18} scrim>
            <View style={styles.onPhoto}>
              <View style={styles.titles}>
                <Text numberOfLines={2} style={styles.photoName}>
                  {post.target.name}
                </Text>
                <Text numberOfLines={1} style={styles.photoLabel}>
                  {post.label}
                </Text>
              </View>
              <View>
                <ScoreBadge score={post.score} size="lg" />
              </View>
            </View>
          </PlacePhoto>
        ) : (
          <View style={styles.row}>
            <PlacePhoto category={post.target.category} width={56} height={56} round={12} />
            <View style={styles.titles}>
              <Text numberOfLines={1} style={styles.name}>
                {post.target.name}
              </Text>
              <Text variant="caption" muted numberOfLines={1}>
                {post.label}
              </Text>
            </View>
            <View>
              <ScoreBadge score={post.score} size="md" />
            </View>
          </View>
        )}
        {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
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
        <Text variant="caption" muted numberOfLines={1} style={styles.meta}>
          {meta}
        </Text>
        <IconButton
          icon="comment"
          accessibilityLabel="Comments"
          plain
          size={36}
          color={colors.muted}
          label={counts === "" ? undefined : counts}
          onPress={() => router.push(postPath(post.postId))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xxs },
  body: { gap: spacing.sm + 2 },
  pressed: { opacity: 0.7 },
  onPhoto: {
    position: "absolute",
    left: spacing.md + 2,
    right: spacing.md + 2,
    bottom: spacing.md + 2,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
  },
  titles: { flex: 1, gap: spacing.xxs },
  photoName: { fontSize: 20, lineHeight: 25, fontWeight: fontWeight.bold, color: colors.white, letterSpacing: -0.2 },
  photoLabel: { fontSize: 13, lineHeight: 17, color: "rgba(255,255,255,0.78)" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.semibold },
  caption: { fontSize: 15, lineHeight: 21 },
  mine: { fontWeight: fontWeight.bold },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 36 },
  meta: { flex: 1 },
});
