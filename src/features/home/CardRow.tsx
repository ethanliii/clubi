import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Icon, Skeleton, Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { colors, fontWeight, palette } from "../../theme";
import { CARD_ROUND, CARD_SIZES, PhotoCard, type CardShape } from "./PhotoCard";

/**
 * One titled row of photo cards that scrolls sideways, in the order the backend sent, with a small
 * arrow beside the title that opens the fuller view (`onMore`, read out as `moreLabel`).
 * `undefined` = still loading (card-shaped placeholders). An empty list draws nothing at all.
 * `gutter` is the screen's side padding: the row runs to both edges and the first card lines up with the title.
 */
export function CardRow({
  title,
  items,
  shape = "medium",
  gutter,
  now,
  moreLabel,
  onMore,
}: {
  title: string;
  items: NearbyItem[] | undefined;
  shape?: CardShape;
  gutter: number;
  now: number;
  moreLabel: string;
  onMore: () => void;
}) {
  if (items !== undefined && items.length === 0) return null;
  const size = CARD_SIZES[shape];
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={moreLabel}
        onPress={onMore}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <View style={styles.arrow}>
          <Icon name="chevron" size={16} color={colors.fg} />
        </View>
      </Pressable>
      <ScrollView
        horizontal
        scrollEnabled={items !== undefined}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={size.width + GAP}
        snapToAlignment="start"
        style={[styles.bleed, { marginHorizontal: -gutter }]}
        contentContainerStyle={[styles.row, { paddingHorizontal: gutter }]}
      >
        {items === undefined
          ? [0, 1, 2].map((index) => (
              <View key={index} style={[styles.placeholder, { width: size.width }]}>
                <Skeleton height={size.height} round={CARD_ROUND} />
                <Skeleton width="68%" height={15} round={6} />
                <Skeleton width="44%" height={12} round={6} />
              </View>
            ))
          : items.map((item) => <PhotoCard key={`${item.kind}:${item.id}`} item={item} shape={shape} now={now} />)}
      </ScrollView>
    </View>
  );
}

const GAP = 12;

const styles = StyleSheet.create({
  section: { gap: 4 },
  head: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  pressed: { opacity: 0.6 },
  title: { flex: 1, fontSize: 20, lineHeight: 26, fontWeight: fontWeight.bold, letterSpacing: -0.4, color: colors.fg },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.field,
  },
  bleed: { flexGrow: 0 },
  row: { gap: GAP },
  placeholder: { gap: 9 },
});
