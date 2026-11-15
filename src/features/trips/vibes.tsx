import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../components";
import { colors, fontWeight, radius } from "../../theme";

export type Vibe = "chill" | "balanced" | "wild";

/** The three vibes the backend knows, with the labels UI-SPEC names. */
export const VIBES: { value: Vibe; label: string }[] = [
  { value: "chill", label: "Chill" },
  { value: "balanced", label: "Balanced" },
  { value: "wild", label: "Wild" },
];

/** "wild" → "Wild". Anything the backend sends that is not one of the three is shown as it came. */
export function vibeLabel(vibe: string | undefined): string {
  if (!vibe) return "";
  return VIBES.find((option) => option.value === vibe)?.label ?? vibe;
}

/**
 * "Chill" / "Balanced" / "Wild" as one three-way switch.
 * `value` is whatever is selected now (it may come from the backend).
 */
export function VibeChips({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (vibe: Vibe) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.track}>
      {VIBES.map((option) => {
        const on = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.segment, on && styles.segmentOn, pressed && !on && styles.pressed]}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: colors.surface },
  segment: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segmentOn: { backgroundColor: colors.fg },
  pressed: { opacity: 0.6 },
  label: { fontSize: 15, lineHeight: 20, color: colors.muted, fontWeight: fontWeight.medium },
  labelOn: { color: colors.bg, fontWeight: fontWeight.semibold },
});
