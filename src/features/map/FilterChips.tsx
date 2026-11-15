/**
 * The filters over the map, in one row that scrolls sideways. They sit on the map picture itself,
 * so each one is a solid pill that reads on any background.
 */
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Text } from "../../components";
import type { Filter } from "../../lib/api";
import { colors, fontWeight, spacing } from "../../theme";
import { MAP_FILTERS } from "./filters";

export const FILTER_HEIGHT = 36;

export function FilterChips({ value, onChange }: { value: Filter; onChange: (filter: Filter) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {MAP_FILTERS.map((option) => {
        const selected = option.filter === value;
        return (
          <Pressable
            key={option.filter}
            accessibilityRole="button"
            accessibilityLabel={`Filter: ${option.label}`}
            accessibilityState={{ selected }}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => onChange(option.filter)}
            style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
          >
            <Text style={[styles.label, selected && styles.labelOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  // Room below for the shadows, which a scroll view would otherwise cut off.
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg - 2, paddingBottom: spacing.md },
  chip: {
    height: FILTER_HEIGHT,
    paddingHorizontal: 15,
    borderRadius: FILTER_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  chipOn: { backgroundColor: colors.fg },
  pressed: { opacity: 0.75 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: fontWeight.semibold, color: colors.fg },
  labelOn: { color: colors.page },
});
