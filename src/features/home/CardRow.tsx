import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Skeleton, Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { colors, fontWeight } from "../../theme";
import { CARD_HEIGHT, CARD_ROUND, CARD_WIDTH, PhotoCard } from "./PhotoCard";

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
 */
export function CardRow({
  title,
  items,
  gutter,
  now,
  moreLabel,
  onMore,
}: {
  title: string;
  items: NearbyItem[] | undefined;
  gutter: number;
  now: number;
  moreLabel: string;
  onMore: () => void;
}) {
  if (items !== undefined && items.length === 0) return null;
  return (
    <View>
      <SectionLabel title={title} moreLabel={moreLabel} onMore={onMore} />
      <ScrollView
        horizontal
        scrollEnabled={items !== undefined}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + GAP}
        snapToAlignment="start"
        style={[styles.bleed, { marginHorizontal: -gutter }]}
        contentContainerStyle={[styles.row, { paddingHorizontal: gutter }]}
      >
        {items === undefined
          ? [0, 1, 2].map((index) => <Skeleton key={index} width={CARD_WIDTH} height={CARD_HEIGHT} round={CARD_ROUND} />)
          : items.map((item) => <PhotoCard key={`${item.kind}:${item.id}`} item={item} now={now} />)}
      </ScrollView>
    </View>
  );
}

const GAP = 10;

const styles = StyleSheet.create({
  head: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  pressed: { opacity: 0.6 },
  title: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: fontWeight.bold, letterSpacing: 0.9, textTransform: "uppercase", color: colors.fg },
  more: { minHeight: 44, justifyContent: "center" },
  moreText: { fontSize: 14, lineHeight: 19, fontWeight: fontWeight.bold, letterSpacing: 0.3, color: colors.fg },
  bleed: { flexGrow: 0 },
  row: { gap: GAP },
});
