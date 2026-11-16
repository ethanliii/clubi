import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Icon, Text, type IconName } from "../../components";
import { colors, fontWeight, palette } from "../../theme";

export type HomePill = { key: string; label: string; icon: IconName; onPress: () => void };

/**
 * One row of light-grey pills under the search field, each a small line icon and a bold label.
 * `gutter` is the screen's side padding: the row runs to both edges and scrolls sideways.
 */
export function Pills({ pills, gutter }: { pills: HomePill[]; gutter: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.bleed, { marginHorizontal: -gutter }]}
      contentContainerStyle={[styles.row, { paddingHorizontal: gutter }]}
    >
      {pills.map((pill) => (
        // The pill looks 34 tall; the pressable around it is 44.
        <Pressable key={pill.key} accessibilityRole="button" accessibilityLabel={pill.label} onPress={pill.onPress} style={styles.hit}>
          {({ pressed }) => (
            <View style={[styles.pill, pressed && styles.pressed]}>
              <Icon name={pill.icon} size={15} color={colors.fg} />
              <Text numberOfLines={1} style={styles.label}>
                {pill.label}
              </Text>
            </View>
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { flexGrow: 0 },
  row: { gap: 8 },
  hit: { height: 44, justifyContent: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 13,
    backgroundColor: palette.field,
  },
  pressed: { backgroundColor: palette.fieldPressed },
  label: { fontSize: 14, lineHeight: 19, fontWeight: fontWeight.bold, color: colors.fg },
});
