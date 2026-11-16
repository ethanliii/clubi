import { Pressable, StyleSheet } from "react-native";
import { Text } from "../../components";
import { colors, fontWeight, palette } from "../../theme";

export type RowButtonKind = "solid" | "outline" | "soft" | "quiet";

/**
 * The small button at the end of a list row.
 *   solid   the one thing to do on the row ("Accept")
 *   outline an offer that is not urgent ("Add", "Friends")
 *   soft    something already done that can be undone ("Requested", "Cancel")
 *   quiet   just the word, for saying no ("Decline")
 * It is 32 tall with squared-off corners, like the buttons in Instagram's people lists; `hitSlop`
 * makes what the thumb can hit 46.
 */
export function RowButton({
  title,
  kind = "outline",
  disabled,
  onPress,
}: {
  /** The label, and what tests and screen readers find the button by. */
  title: string;
  kind?: RowButtonKind;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={SLOP}
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles[kind], pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text numberOfLines={1} style={[styles.label, { color: INK[kind] }]}>
        {title}
      </Text>
    </Pressable>
  );
}

const SLOP = { top: 7, bottom: 7, left: 2, right: 2 };

/** Darker than a divider, so the outline reads as a button and not as a box. */
const OUTLINE = "#cfcfd6";

const INK: Record<RowButtonKind, string> = {
  solid: colors.white,
  outline: colors.fg,
  soft: palette.soft,
  quiet: colors.muted,
};

const styles = StyleSheet.create({
  base: {
    minHeight: 32,
    minWidth: 68,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  solid: { backgroundColor: colors.accent, borderColor: colors.accent },
  outline: { backgroundColor: colors.bg, borderColor: OUTLINE },
  soft: { backgroundColor: palette.field },
  quiet: { backgroundColor: "transparent", minWidth: 0, paddingHorizontal: 8 },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: fontWeight.bold, letterSpacing: -0.1 },
});

