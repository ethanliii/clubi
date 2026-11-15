import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fontWeight } from "../theme";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export type IconButtonProps = {
  icon: IconName;
  /** Required: an icon has no text, so this is what tests and screen readers find ("Notifications", "Like"). */
  accessibilityLabel: string;
  onPress?: () => void;
  /** Icon color. Default is the normal text color. */
  color?: string;
  /** The round button's width and height. Default 36. */
  size?: number;
  /** A small count on the corner ("3", "99+"). Hidden when empty. */
  badge?: string | null;
  /** No grey circle behind the icon. */
  plain?: boolean;
  /** Text to the right of the icon, e.g. a like count. */
  label?: string;
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A round button that is just an icon: the bell, the gear, the heart. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  color = colors.fg,
  size = 36,
  badge,
  plain = false,
  label,
  selected,
  disabled,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, (pressed || disabled) && styles.dimmed, style]}
    >
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2 },
          !plain && styles.filled,
        ]}
      >
        <Icon name={icon} size={Math.round(size * 0.5)} color={color} />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {label ? <Text variant="caption">{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  circle: { alignItems: "center", justifyContent: "center" },
  filled: { backgroundColor: colors.surface },
  dimmed: { opacity: 0.6 },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 5,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.white, fontSize: 10, lineHeight: 14, fontWeight: fontWeight.semibold },
});
