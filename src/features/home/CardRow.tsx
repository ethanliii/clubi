import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Skeleton, Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { colors, fontWeight } from "../../theme";
import { CARD_HEIGHT, CARD_ROUND, CARD_WIDTH, COMPACT_CARD_HEIGHT, COMPACT_CARD_WIDTH, LARGE_CARD_HEIGHT, LARGE_CARD_WIDTH, PhotoCard } from "./PhotoCard";

/** A small bold uppercase section label, with an optional bold "See all" at the right. */
export function SectionLabel({ title, moreLabel, onMore }: { title: string; moreLabel?: string; onMore?: () => void }) {
  return (
    <View style={styles.head}>
      <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {onMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={moreLabel ?? "See all"}
          hitSlop={8}
          onPress={onMore}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          <Text style={styles.moreText}>See all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * One labelled carousel of overlay photo cards, in the order the backend sent.
 * `undefined` = still loading (card-shaped placeholders). An empty list draws nothing at all.
 * `gutter` is the screen's side padding: the row runs to both edges and the first card lines up with the label.
 * `compact` draws the slim row that sits above the feed; `large` the wide paged row that leads For you.
 */
export function CardRow({
  title,
  items,
  gutter,
  now,
  moreLabel,
  onMore,
  compact = false,
  large = false,
}: {
  title: string;
  items: NearbyItem[] | undefined;
  gutter: number;
  now: number;
  moreLabel: string;
  onMore: () => void;
  compact?: boolean;
  large?: boolean;
}) {
  if (items !== undefined && items.length === 0) return null;
  const width = large ? LARGE_CARD_WIDTH : compact ? COMPACT_CARD_WIDTH : CARD_WIDTH;
  const height = large ? LARGE_CARD_HEIGHT : compact ? COMPACT_CARD_HEIGHT : CARD_HEIGHT;
  return (
    <View>
      <SectionLabel title={title} moreLabel={moreLabel} onMore={onMore} />
      <ScrollView
        horizontal
        scrollEnabled={items !== undefined}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={width + GAP}
        snapToAlignment="start"
        style={[styles.bleed, { marginHorizontal: -gutter }]}
        contentContainerStyle={[styles.row, { paddingHorizontal: gutter }]}
      >
        {items === undefined
          ? [0, 1, 2].map((index) => <Skeleton key={index} width={width} height={height} round={CARD_ROUND} />)
          : items.map((item) => <PhotoCard key={`${item.kind}:${item.id}`} item={item} now={now} compact={compact} large={large} />)}
      </ScrollView>
    </View>
  );
}

const GAP = 10;

const styles = StyleSheet.create({
  head: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  pressed: { opacity: 0.6 },
  title: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: fontWeight.bold, letterSpacing: 0.9, textTransform: "uppercase", color: colors.fg },
  more: { minHeight: 36, justifyContent: "center" },
  moreText: { fontSize: 14, lineHeight: 19, fontWeight: fontWeight.bold, letterSpacing: 0.3, color: colors.fg },
  bleed: { flexGrow: 0 },
  row: { gap: GAP },
});
