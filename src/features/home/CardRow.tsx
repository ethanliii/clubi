import { ScrollView, StyleSheet, View } from "react-native";
import { Skeleton, Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { fontWeight } from "../../theme";
import { CARD_SIZES, PhotoCard, type CardShape } from "./PhotoCard";

/**
 * One titled row of photo cards that scrolls sideways, in the order the backend sent.
 * `undefined` = still loading (card-shaped placeholders). An empty list draws nothing at all.
 * `gutter` is the screen's side padding: the row runs to both edges and the first card lines up with the title.
 */
export function CardRow({
  title,
  items,
  shape = "tall",
  gutter,
  now,
}: {
  title: string;
  items: NearbyItem[] | undefined;
  shape?: CardShape;
  gutter: number;
  now: number;
}) {
  if (items !== undefined && items.length === 0) return null;
  const size = CARD_SIZES[shape];
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
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
                <Skeleton height={size.height} round={18} />
                <Skeleton width="72%" height={14} />
                <Skeleton width="46%" height={11} />
              </View>
            ))
          : items.map((item) => <PhotoCard key={`${item.kind}:${item.id}`} item={item} shape={shape} now={now} />)}
      </ScrollView>
    </View>
  );
}

const GAP = 14;

const styles = StyleSheet.create({
  section: { gap: 14 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: fontWeight.bold, letterSpacing: -0.4 },
  bleed: { flexGrow: 0 },
  row: { gap: GAP },
  placeholder: { gap: 10 },
});
