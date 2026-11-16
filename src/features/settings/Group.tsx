import { Children, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text } from "../../components";
import { colors, palette, radius, spacing } from "../../theme";

/** The inset every row shares, so labels, dividers and the group's title line up. */
export const ROW_INSET = spacing.lg - 2;

/**
 * One group of a settings screen, the way a phone's own settings does it: a quiet name, one soft
 * panel holding the rows with a hairline between them, and at most one line of explanation under it.
 */
export function SettingsGroup({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.group}>
      {title ? (
        <Text variant="label" accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      ) : null}
      <View style={styles.panel}>
        {rows.map((row, index) => (
          <View key={index}>
            {index > 0 ? <View style={styles.hairline} /> : null}
            {row}
          </View>
        ))}
      </View>
      {footer ? (
        <Text variant="caption" muted style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A row that says something (`value`) or goes somewhere (`onPress`, with a chevron).
 * `tone="danger"` is for the one row that deletes.
 */
export function SettingsRow({
  label,
  value,
  onPress,
  tone = "normal",
  chevron = true,
  disabled,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  tone?: "normal" | "danger";
  /** Show the chevron on a tappable row. Off for actions that happen right here, like signing out. */
  chevron?: boolean;
  disabled?: boolean;
}) {
  const content = (
    <>
      <Text variant="bodyLg" numberOfLines={1} style={[styles.label, tone === "danger" && styles.danger]}>
        {label}
      </Text>
      {value ? (
        <Text variant="bodyLg" muted numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      ) : null}
      {onPress && chevron ? <Icon name="chevron" size={16} color={colors.low} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.dimmed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  title: { paddingHorizontal: ROW_INSET },
  panel: { borderRadius: radius.xl, backgroundColor: palette.field, overflow: "hidden" },
  hairline: { height: 1, marginLeft: ROW_INSET, backgroundColor: palette.hairline },
  footer: { paddingHorizontal: ROW_INSET },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: ROW_INSET,
    paddingVertical: spacing.sm,
  },
  pressed: { backgroundColor: palette.fieldPressed },
  dimmed: { opacity: 0.4 },
  label: { flex: 1 },
  danger: { color: palette.danger },
  value: { flexShrink: 1, maxWidth: "62%", textAlign: "right" },
});
