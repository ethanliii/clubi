import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text, type IconName } from "../../components";
import { colors, fontWeight, palette, spacing } from "../../theme";

/** One entry of a profile's list: an icon, a label, a count when the backend gave one, and an arrow. */
export function LinkRow({
  icon,
  label,
  count,
  onPress,
  divider = true,
}: {
  icon: IconName;
  label: string;
  count?: number;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}
    >
      <Icon name={icon} size={20} color={colors.fg} />
      <Text numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      {count === undefined ? null : <Text style={styles.count}>{count.toLocaleString()}</Text>}
      <View style={styles.arrow}>
        <Icon name="chevron" size={14} color={colors.low} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 52 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.hairline },
  pressed: { opacity: 0.55 },
  label: { flex: 1, fontSize: 16, lineHeight: 21, fontWeight: fontWeight.semibold },
  count: { fontSize: 15, lineHeight: 20, color: colors.muted, fontVariant: ["tabular-nums"] },
  arrow: { width: 16, alignItems: "flex-end" },
});
