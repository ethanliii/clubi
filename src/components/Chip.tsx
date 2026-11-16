import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fontWeight, palette, radius, spacing } from "../theme";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export type ChipProps = {
  label: string;
  /** Filled with the accent and white text when true. */
  selected?: boolean;
  /** Leave out for a chip that only shows a fact ("Packed", "Mostly 20s"). */
  onPress?: () => void;
  /** What tests and screen readers find. Defaults to `label`. Filters use the long form: "Filter: Bars". */
  accessibilityLabel?: string;
  disabled?: boolean;
  /** `sm` for facts on cards, `md` (default, 40 tall) for anything tappable. */
  size?: "sm" | "md";
  /** Something in front of the label, e.g. an `Avatar`. */
  leading?: ReactNode;
  /** A small line icon in front of the label ("Trending", "Friend recs"). */
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

/** A pill. Tappable and selectable when it has `onPress`, a plain tag when it does not. */
export function Chip({
  label,
  selected = false,
  onPress,
  accessibilityLabel,
  disabled,
  size = "md",
  leading,
  icon,
  style,
}: ChipProps) {
  const content = (
    <>
      {leading}
      {icon ? <Icon name={icon} size={size === "sm" ? 13 : 16} color={selected ? colors.white : colors.fg} /> : null}
      <Text
        numberOfLines={1}
        style={[styles.label, size === "sm" && styles.labelSm, selected && styles.labelSelected]}
      >
        {label}
      </Text>
    </>
  );
  const box = [styles.chip, size === "sm" && styles.chipSm, selected && styles.selected, style];

  if (!onPress) {
    return (
      <View accessibilityLabel={accessibilityLabel ?? label} style={box}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [...box, pressed && styles.pressed, disabled && styles.dimmed]}
    >
      {content}
    </Pressable>
  );
}

/** Chips that wrap onto more lines (tags, quiz options) or scroll sideways in one line (filters). */
export function ChipRow({
  children,
  scroll = false,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.scroller}
        contentContainerStyle={[styles.row, style]}
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.row, styles.wrap, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  // No outline: an unselected chip is a light grey pill, the selected one is the only black thing in the row.
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    minHeight: 36,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: palette.field,
  },
  chipSm: { minHeight: 24, paddingVertical: 3, paddingHorizontal: spacing.sm + 2, backgroundColor: palette.field },
  selected: { backgroundColor: colors.accent },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  dimmed: { opacity: 0.4 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: fontWeight.bold, color: colors.fg },
  labelSm: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.semibold, color: palette.soft },
  labelSelected: { color: colors.white, fontWeight: fontWeight.bold },
  scroller: { flexGrow: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  wrap: { flexWrap: "wrap" },
});
