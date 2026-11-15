import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fontWeight, radius, spacing } from "../theme";
import { Text } from "./Text";

export type ChipProps = {
  label: string;
  /** Filled light (the page's text colour) with dark text when true. */
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
  style,
}: ChipProps) {
  const content = (
    <>
      {leading}
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
      style={({ pressed }) => [...box, (pressed || disabled) && styles.dimmed]}
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
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    minHeight: 31,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipSm: { minHeight: 24, paddingVertical: 3, paddingHorizontal: spacing.sm + 2 },
  selected: { backgroundColor: colors.fg, borderColor: colors.fg },
  dimmed: { opacity: 0.6 },
  label: { fontSize: 13, lineHeight: 17 },
  labelSm: { fontSize: 12, lineHeight: 16 },
  labelSelected: { color: colors.bg, fontWeight: fontWeight.semibold },
  scroller: { flexGrow: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  wrap: { flexWrap: "wrap" },
});
