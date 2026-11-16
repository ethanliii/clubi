import { Pressable, StyleSheet } from "react-native";
import { Icon, Text } from "../../components";
import { colors, palette } from "../../theme";

/** The grey search field at the top of Home. It is a way in, not an input: tapping it opens the search on the map. */
export function SearchField({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="search"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.field, pressed && styles.pressed]}
    >
      <Icon name="search" size={19} color={colors.fg} />
      <Text numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 16,
    backgroundColor: palette.field,
  },
  pressed: { backgroundColor: palette.fieldPressed },
  label: { flex: 1, fontSize: 16, lineHeight: 21, color: colors.muted },
});
