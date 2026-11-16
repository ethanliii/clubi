import { Platform, Pressable, StyleSheet, TextInput, View, type TextStyle } from "react-native";
import { Icon } from "../../components";
import { colors, palette, radius, spacing } from "../../theme";

// The browser's own focus ring would double up with the field.
const noOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as TextStyle) : null;

/** The grey rounded search field at the top of a list: a magnifier, the words, a clear button. */
export function ArtistSearch({ value, onChangeText }: { value: string; onChangeText: (text: string) => void }) {
  return (
    <View style={styles.field}>
      <Icon name="search" size={18} color={colors.muted} />
      <TextInput
        accessibilityLabel="Search artists"
        placeholder="Search artists"
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={[styles.input, noOutline]}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={12}
          onPress={() => onChangeText("")}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
        >
          <Icon name="close" size={12} color={colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: palette.field,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md + 2,
  },
  input: { flex: 1, height: 46, fontSize: 16, color: colors.fg, paddingVertical: 0 },
  clear: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.low, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
});
