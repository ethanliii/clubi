import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, spacing } from "../theme";
import { Text } from "./Text";

export type SectionHeaderProps = {
  title: string;
  /** Shown after the title, quieter: "Requests 2". Read out as "Requests (2)". */
  count?: number;
  /** The link on the right, e.g. "See all". Shown only together with `onAction`. */
  actionLabel?: string;
  onAction?: () => void;
  /** For tests and screen readers when several sections share a label: "See all bars". */
  actionAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** The title above a section of a screen, with an optional "See all" on the right. */
export function SectionHeader({
  title,
  count,
  actionLabel,
  onAction,
  actionAccessibilityLabel,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <Text
        accessibilityRole="header"
        accessibilityLabel={count === undefined ? title : `${title} (${count})`}
        style={styles.title}
        numberOfLines={1}
      >
        {title}
        {count === undefined ? null : <Text style={[styles.title, styles.count]}>{`  ${count}`}</Text>}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          hitSlop={12}
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 28 },
  // Small, bold, uppercase and letter-spaced: the label names the section without competing with it.
  title: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", color: colors.fg },
  count: { flex: 0, color: colors.low, fontWeight: "700" },
  action: { flexDirection: "row", alignItems: "center", minHeight: 28, paddingLeft: spacing.md },
  actionText: { fontSize: 14, lineHeight: 18, color: colors.fg, fontWeight: "700", letterSpacing: 0.2 },
  pressed: { opacity: 0.5 },
});
