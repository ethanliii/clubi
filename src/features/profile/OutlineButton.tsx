import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Icon, Text, type IconName } from "../../components";
import { colors, fontWeight, radius, spacing } from "../../theme";

/** A small outline button, the quiet action under a profile header ("Edit profile", "Compare tastes"). */
export function OutlineButton({
  title,
  icon,
  onPress,
  style,
}: {
  title: string;
  icon?: IconName;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
    >
      {icon ? <Icon name={icon} size={16} color={colors.fg} /> : null}
      <Text numberOfLines={1} style={styles.label}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  pressed: { backgroundColor: colors.surface },
  label: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.semibold, color: colors.fg },
});
