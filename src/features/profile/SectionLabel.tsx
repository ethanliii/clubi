import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "../../components";
import { colors, fontWeight, spacing } from "../../theme";

/**
 * The label above a section of a profile: small, bold, uppercase and letter-spaced, with an
 * optional bold link at the right ("See all").
 */
export function SectionLabel({
  title,
  actionLabel,
  onAction,
  actionAccessibilityLabel,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.row, style]}>
      <Text accessibilityRole="header" accessibilityLabel={title} numberOfLines={1} style={styles.title}>
        {title.toUpperCase()}
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
  title: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: fontWeight.bold, letterSpacing: 0.9, color: colors.fg },
  action: { minHeight: 28, justifyContent: "center" },
  actionText: { fontSize: 14, lineHeight: 18, fontWeight: fontWeight.bold, letterSpacing: 0.2, color: colors.fg },
  pressed: { opacity: 0.5 },
});
