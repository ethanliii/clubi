import { Platform, StyleSheet, TextInput, View } from "react-native";
import { Icon, IconButton } from "../../components";
import { colors, fontSize, palette, radius, spacing } from "../../theme";

/** react-native-web draws a focus ring around inputs; the bar is its own focus cue. Native ignores it. */
const WEB_NO_RING = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null;

/** The search box: a soft bar with a magnifier, and a clear button once something is typed. */
export function SearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  /** Also what tests and screen readers find the box by. */
  placeholder: string;
}) {
  return (
    <View style={styles.bar}>
      <Icon name="search" size={18} color={colors.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, WEB_NO_RING]}
      />
      {value !== "" ? (
        <IconButton
          icon="close"
          accessibilityLabel="Clear search"
          plain
          size={28}
          color={colors.muted}
          onPress={() => onChangeText("")}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 46,
    paddingLeft: 14,
    paddingRight: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: palette.field,
  },
  // 16 keeps iOS Safari from zooming the page when the box is focused.
  input: { flex: 1, height: 46, color: colors.fg, fontSize: fontSize.bodyLg, paddingVertical: 0 },
});
