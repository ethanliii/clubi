import { Pressable, StyleSheet } from "react-native";
import { Icon, Text, type IconName } from "../../components";
import { colors, fontWeight, radius, spacing } from "../../theme";

/** A half-width button with an icon: the ways out of Home to Trips and Saved. */
export function QuickLink({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Icon name={icon} size={18} color={colors.fg} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.7 },
  label: { fontWeight: fontWeight.semibold },
});
