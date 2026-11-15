import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Chip, ChipRow, IconButton, Text } from "../../components";
import type { FeedItem } from "../../lib/api";
import { formatRelativeTime, pluralize } from "../../lib/format";
import { postPath, venuePath } from "../../lib/links";
import { colors, fontWeight, radius, ratingColor, spacing } from "../../theme";

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
            <Text numberOfLines={1} style={styles.name}>
              {post.target.name}
            </Text>
            <Text variant="caption" muted numberOfLines={1}>
              {post.label}
            </Text>
          </View>
          <View accessibilityLabel={`Score ${post.score.toFixed(1)}`} style={[styles.ring, { borderColor: ratingColor(post.score) }]}>
            <Text style={[styles.ringText, { color: ratingColor(post.score) }]}>{post.score.toFixed(1)}</Text>
          </View>
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
          <Text variant="caption" muted>
            {"You gave it "}
            <Text variant="caption" style={[styles.mine, { color: ratingColor(post.myScoreForIt) }]}>
              {post.myScoreForIt.toFixed(1)}
            </Text>
          </Text>
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
  // Same shape as a post on Home: no box, a line underneath.
  card: { gap: 10, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  body: { gap: 10 },
  pressed: { opacity: 0.7 },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  titles: { flex: 1 },
  name: { fontWeight: fontWeight.bold },
  ring: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  ringText: { fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
  mine: { fontWeight: fontWeight.bold },
  photo: { width: "100%", height: 190, borderRadius: radius.lg, backgroundColor: colors.raised },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
});
