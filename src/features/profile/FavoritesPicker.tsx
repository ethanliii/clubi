import { usePaginatedQuery } from "convex/react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Icon, Loading, Sheet, Text } from "../../components";
import { api, type FeedItem, type Id } from "../../lib/api";
import { MAX_FAVORITES, toggleFavorite } from "../../lib/favorites";
import { categoryLabel } from "../../lib/format";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, fontWeight, palette, spacing } from "../../theme";
import { PlacePhoto } from "./PlacePhoto";

const PAGE = 30;

/**
 * The sheet where I mark my favorites: every place I ranked (one post each, newest first) with a
 * tick, up to nine. The list scrolls; "Save" stays under it and stores the ticked ones in the order
 * they were ticked (`onboarding.setPins`). Keep it mounted; it is open while `visible` is true.
 */
export function FavoritesPicker({
  userId,
  visible,
  picked,
  onPick,
  onClose,
}: {
  userId: Id<"users">;
  visible: boolean;
  /** The ticked posts, in order. The screen that opens the sheet starts it from the saved favorites. */
  picked: Id<"posts">[];
  onPick: (picked: Id<"posts">[]) => void;
  onClose: () => void;
}) {
  const mine = usePaginatedQuery(api.posts.byUser, visible ? { userId } : "skip", { initialNumItems: PAGE });
  const { run: save, pending } = useMutationToast(api.onboarding.setPins, { success: "Favorites saved" });
  const full = picked.length >= MAX_FAVORITES;

  const done = async () => {
    const saved = await save({ postIds: picked });
    if (saved !== undefined) onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Favorites" scroll={false}>
      <Text muted style={styles.hint}>
        {`Tick the places you love most, up to ${MAX_FAVORITES}. They show at the top of your profile. ${picked.length} of ${MAX_FAVORITES} picked.`}
      </Text>
      {mine.status === "LoadingFirstPage" ? (
        <Loading compact label="Loading your places" />
      ) : mine.results.length === 0 ? (
        <Text muted center style={styles.empty}>
          Rank a place first, then mark it as a favorite here.
        </Text>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {mine.results.map((post, index) => (
            <PickRow
              key={post.postId}
              post={post}
              first={index === 0}
              on={picked.includes(post.postId)}
              disabled={full && !picked.includes(post.postId)}
              onPress={() => onPick(toggleFavorite(picked, post.postId).ids)}
            />
          ))}
          {mine.status === "CanLoadMore" ? (
            <Button title="Show more" accessibilityLabel="Show more places" variant="link" onPress={() => mine.loadMore(PAGE)} style={styles.more} />
          ) : mine.status === "LoadingMore" ? (
            <Loading compact label="Loading more" />
          ) : null}
        </ScrollView>
      )}
      <Button title="Save" accessibilityLabel="Save favorites" loading={pending} disabled={pending} onPress={() => void done()} />
    </Sheet>
  );
}

/** One ranked place: its photo, name, kind and score, and a tick at the right when it is a favorite. */
function PickRow({ post, first, on, disabled, onPress }: { post: FeedItem; first: boolean; on: boolean; disabled: boolean; onPress: () => void }) {
  const { target } = post;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={target.name}
      accessibilityState={{ checked: on, disabled }}
      aria-checked={on}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.line, pressed && styles.pressed, disabled && styles.dimmed]}
    >
      <PlacePhoto uri={target.imageUrl} category={target.category} width={48} height={48} round={8} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={styles.name}>
          {target.name}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {`${categoryLabel(target.category)} · ${post.score.toFixed(1)}`}
        </Text>
      </View>
      <View style={[styles.tick, on && styles.tickOn]}>{on ? <Icon name="check" size={15} color={colors.bg} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 14, lineHeight: 19 },
  list: { flexShrink: 1 },
  empty: { paddingVertical: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 64, paddingVertical: spacing.sm },
  line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.hairline },
  pressed: { opacity: 0.55 },
  dimmed: { opacity: 0.4 },
  text: { flex: 1, gap: 1 },
  name: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: colors.fg },
  meta: { fontSize: 13, lineHeight: 18, color: colors.muted, fontVariant: ["tabular-nums"] },
  tick: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  tickOn: { backgroundColor: colors.fg, borderColor: colors.fg },
  more: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 18 },
});
