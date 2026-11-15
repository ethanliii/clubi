import { ScrollView, StyleSheet, View } from "react-native";
import { ItemCard, SectionHeader, SkeletonCards } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { spacing } from "../../theme";

/**
 * One titled row of cards that scrolls sideways, in the order the backend sent.
 * `undefined` = still loading (skeleton cards). An empty list draws nothing at all.
 */
export function CardRow({ title, items, cardWidth = 250 }: { title: string; items: NearbyItem[] | undefined; cardWidth?: number }) {
  if (items !== undefined && items.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      {items === undefined ? (
        <SkeletonCards />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bleed}
          contentContainerStyle={styles.row}
        >
          {items.map((item) => (
            <ItemCard key={`${item.kind}:${item.id}`} item={item} variant="card" width={cardWidth} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  // The row runs to both edges of the screen; the first card still lines up with the title.
  bleed: { marginHorizontal: -spacing.lg, flexGrow: 0 },
  row: { paddingHorizontal: spacing.lg, gap: spacing.md },
});
