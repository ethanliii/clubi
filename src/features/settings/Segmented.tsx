import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../components";
import { colors, fontWeight, radius } from "../../theme";

/** Pick one of a few: a track with the chosen option lifted. Each option is found by its label. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.track}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: on, checked: on }}
            aria-checked={on}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && !on && styles.pressed]}
          >
            <Text numberOfLines={1} style={[styles.label, on && styles.labelOn]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: 3, borderRadius: radius.md + 2, backgroundColor: colors.page },
  option: { flex: 1, minHeight: 36, borderRadius: radius.md - 1, alignItems: "center", justifyContent: "center" },
  optionOn: { backgroundColor: colors.raised },
  pressed: { opacity: 0.6 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: fontWeight.medium, color: colors.muted },
  labelOn: { color: colors.fg, fontWeight: fontWeight.semibold },
});
