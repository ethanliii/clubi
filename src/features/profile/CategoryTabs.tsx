import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Text } from "../../components";
import type { Category } from "../../lib/api";
import { colors, fontWeight, palette, radius, spacing } from "../../theme";

export type CategoryTab = { category: Category; label: string; count?: number };

/**
 * The category pills on the rankings screen, in one row that scrolls sideways: light grey pills,
 * the picked one filled black. `count` (how many I ranked there) follows the label.
 */
export function CategoryTabs({
  tabs,
  selected,
  onSelect,
}: {
  tabs: CategoryTab[];
  selected?: Category;
  onSelect: (category: Category) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.row}
    >
      {tabs.map((tab) => {
        const on = tab.category === selected;
        return (
          <Pressable
            key={tab.category}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(tab.category)}
            style={({ pressed }) => [styles.pill, on && styles.pillOn, pressed && styles.pressed]}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{tab.label}</Text>
            {tab.count ? <Text style={[styles.count, on && styles.countOn]}>{tab.count}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Bleeds to the screen edges so the pills scroll under them.
  scroller: { flexGrow: 0, marginHorizontal: -spacing.lg },
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  // 36 tall to the eye, 44 to the thumb.
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    marginVertical: 4,
    paddingHorizontal: 15,
    borderRadius: radius.pill,
    backgroundColor: palette.field,
  },
  pillOn: { backgroundColor: colors.fg },
  pressed: { opacity: 0.6 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: fontWeight.semibold, color: palette.soft },
  labelOn: { color: colors.bg },
  count: { fontSize: 13, lineHeight: 18, color: colors.muted, fontVariant: ["tabular-nums"] },
  countOn: { color: "rgba(255,255,255,0.7)" },
});
