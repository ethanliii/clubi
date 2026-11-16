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
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
    >
      {icon ? <Icon name={icon} size={15} color={colors.fg} /> : null}
      <Text numberOfLines={1} style={styles.label}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  pressed: { backgroundColor: colors.surface },
  label: { fontSize: 14, lineHeight: 18, fontWeight: fontWeight.bold, color: colors.fg },
});
