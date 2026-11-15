import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Icon, Text, type IconName } from "../../components";
import { colors, fontWeight } from "../../theme";

/**
 * The ways out of Home: "Plan my night" is the main one (solid, light), Trips and Saved sit beside it.
 * One row, thumb height, no explanations.
 */
export function Shortcuts({ onPlan, onTrips, onSaved }: { onPlan: () => void; onTrips: () => void; onSaved: () => void }) {
  // On the narrowest phones the three labels only fit without the two small icons.
  const roomy = useWindowDimensions().width >= 360;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Plan my night"
        onPress={onPlan}
        style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
      >
        <Text numberOfLines={1} style={[styles.label, styles.primaryLabel]}>
          Plan my night
        </Text>
      </Pressable>
      <Quiet label="Trips" icon={roomy ? "users" : null} onPress={onTrips} />
      <Quiet label="Saved" icon={roomy ? "bookmark" : null} onPress={onSaved} />
    </View>
  );
}

function Quiet({ label, icon, onPress }: { label: string; icon: IconName | null; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles.quiet, pressed && styles.pressed]}
    >
      {icon ? <Icon name={icon} size={18} color={colors.fg} /> : null}
      <Text numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 16,
  },
  primary: { flex: 1, paddingHorizontal: 12, backgroundColor: colors.fg },
  quiet: { backgroundColor: colors.surface },
  pressed: { opacity: 0.75 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.semibold, color: colors.fg },
  primaryLabel: { color: colors.bg },
});
