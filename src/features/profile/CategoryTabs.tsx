import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../components";
import type { Category } from "../../lib/api";
import { colors, fontWeight, spacing } from "../../theme";

export type CategoryTab = { category: Category; label: string; count?: number };

/**
 * Text tabs for the rankings screen: the picked one is bright with the accent line under it,
 * the rest are muted. `count` (how many I ranked there) is drawn small beside the label.
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
    <View style={styles.wrap}>
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
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <View style={styles.labelRow}>
                <Text style={[styles.label, on && styles.labelOn]}>{tab.label}</Text>
                {tab.count ? <Text style={styles.count}>{tab.count}</Text> : null}
              </View>
              <View style={[styles.line, on && styles.lineOn]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Bleeds to the screen edges so the row scrolls under them; the hairline spans the full width.
  wrap: {
    marginHorizontal: -spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  scroller: { flexGrow: 0 },
  row: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  tab: { minHeight: 44, justifyContent: "flex-end", gap: spacing.sm + 2 },
  pressed: { opacity: 0.6 },
  labelRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  label: { fontSize: 16, lineHeight: 22, fontWeight: fontWeight.semibold, color: colors.muted },
  labelOn: { color: colors.fg },
  count: { fontSize: 12, lineHeight: 16, color: colors.muted, fontVariant: ["tabular-nums"] },
  line: { height: 2, borderRadius: 1, backgroundColor: "transparent" },
  lineOn: { backgroundColor: colors.accent },
});
