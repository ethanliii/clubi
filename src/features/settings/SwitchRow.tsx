import { Platform, StyleSheet, Switch, View } from "react-native";
import { Text } from "../../components";
import { colors, spacing } from "../../theme";
import { ROW_INSET } from "./Group";

/** react-native-web paints an "on" switch teal unless told otherwise; native ignores these. */
const WEB_SWITCH = Platform.OS === "web" ? { activeThumbColor: colors.white, activeTrackColor: colors.accent } : null;

/** A labelled on/off switch. The switch carries the label, so tests and screen readers find it by name. */
export function SwitchRow({
  label,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text variant="bodyLg" style={styles.label}>
        {label}
      </Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.line, true: colors.accent }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.line}
        {...WEB_SWITCH}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: ROW_INSET,
    paddingVertical: spacing.sm,
  },
  label: { flex: 1 },
});
