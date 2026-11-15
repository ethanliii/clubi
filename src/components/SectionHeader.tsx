import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, spacing } from "../theme";
import { Icon } from "./Icon";
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
        variant="headline"
        accessibilityRole="header"
        accessibilityLabel={count === undefined ? title : `${title} (${count})`}
        style={styles.title}
        numberOfLines={1}
      >
        {title}
        {count === undefined ? null : <Text variant="headline" style={styles.count}>{`  ${count}`}</Text>}
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
          <Icon name="chevron" size={13} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md, minHeight: 32 },
  title: { flex: 1 },
  count: { color: colors.low, fontWeight: "600" },
  action: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 32 },
  actionText: { color: colors.muted, fontWeight: "500" },
  pressed: { opacity: 0.5 },
});
