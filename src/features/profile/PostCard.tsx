import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Chip, ChipRow, IconButton, ScoreBadge, Text } from "../../components";
import type { FeedItem } from "../../lib/api";
import { formatRelativeTime, pluralize } from "../../lib/format";
import { postPath, venuePath } from "../../lib/links";
import { colors, radius, spacing } from "../../theme";

/**
 * A person's recent post on their profile: the place, the backend's label ("#1 of their bars · 9.4"),
 * the first photo, the caption and the tags. The card opens the venue; the comment button opens the post.
 */
export function PostCard({ post, now }: { post: FeedItem; now: number }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = post.photoUrls[0];
  const chips = [...post.tags, ...(post.insightChips ?? [])];
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={post.target.name}
        onPress={() => router.push(venuePath(post.target.kind, post.target.id))}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        <View style={styles.top}>
          <View style={styles.titles}>
            <Text variant="title" numberOfLines={1}>
              {post.target.name}
            </Text>
            <Text variant="caption" muted numberOfLines={1}>
              {post.label}
            </Text>
          </View>
          <ScoreBadge score={post.score} />
        </View>
        {photo && !photoFailed ? (
          <Image
            source={{ uri: photo }}
            resizeMode="cover"
            onError={() => setPhotoFailed(true)}
            style={styles.photo}
          />
        ) : null}
        {post.caption ? <Text>{`“${post.caption}”`}</Text> : null}
        {post.myScoreForIt !== undefined ? (
          <Text variant="caption" muted>{`You gave it ${post.myScoreForIt.toFixed(1)}`}</Text>
        ) : null}
      </Pressable>
      {chips.length > 0 ? (
        <ChipRow>
          {chips.map((chip, index) => (
            <Chip key={`${chip}-${index}`} label={chip} size="sm" />
          ))}
        </ChipRow>
      ) : null}
      <View style={styles.footer}>
        <IconButton
          icon="comment"
          accessibilityLabel="Comments"
          plain
          size={36}
          color={colors.muted}
          label={`${pluralize(post.reactionCount ?? 0, "like")} · ${pluralize(post.commentCount ?? 0, "comment")}`}
          onPress={() => router.push(postPath(post.postId))}
        />
        <Text variant="caption" muted>
          {formatRelativeTime(post.createdAt, now)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
  },
  body: { gap: spacing.sm },
  pressed: { opacity: 0.7 },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  titles: { flex: 1, gap: 2 },
  photo: { width: "100%", height: 170, borderRadius: radius.lg, backgroundColor: colors.raised },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
});
