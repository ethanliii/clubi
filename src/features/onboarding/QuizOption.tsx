import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { Icon, Text } from "../../components";
import { colors, fontWeight, palette, radius } from "../../theme";
import { NATIVE_DRIVER } from "./Rise";

/**
 * One answer on a quiz card. A "pick many" card draws its answers as wrapping chips; a "pick one"
 * card draws rows, with a check on the picked row only. Both are light grey and turn black when
 * picked. The screen owns which options are picked.
 */
export function QuizOption({
  label,
  selected,
  many,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  many: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const [press] = useState(() => new Animated.Value(1));
  const [tick] = useState(() => new Animated.Value(selected ? 1 : 0));

  useEffect(() => {
    const animation = Animated.spring(tick, {
      toValue: selected ? 1 : 0,
      speed: 28,
      bounciness: selected ? 14 : 0,
      useNativeDriver: NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [tick, selected]);

  const dip = (toValue: number) =>
    Animated.spring(press, { toValue, speed: 40, bounciness: 6, useNativeDriver: NATIVE_DRIVER }).start();

  return (
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <Pressable
        accessibilityRole={many ? "checkbox" : "radio"}
        accessibilityLabel={label}
        accessibilityState={{ checked: selected, disabled: !!disabled }}
        // react-native-web reads the aria prop, not accessibilityState, for the checked state.
        aria-checked={selected}
        disabled={disabled}
        onPressIn={() => dip(0.97)}
        onPressOut={() => dip(1)}
        onPress={onPress}
        style={[many ? styles.chip : styles.row, selected && styles.on]}
      >
        <Text style={[styles.label, !many && styles.rowLabel, selected && styles.labelOn]} numberOfLines={1}>
          {label}
        </Text>
        {many ? null : (
          <Animated.View style={{ opacity: tick, transform: [{ scale: tick }] }}>
            <Icon name="check" size={18} color={colors.white} />
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: palette.field,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 56,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: palette.field,
  },
  on: { backgroundColor: colors.fg },
  label: { fontSize: 16, lineHeight: 22, fontWeight: fontWeight.semibold, letterSpacing: -0.2, color: colors.fg },
  rowLabel: { flex: 1 },
  labelOn: { color: colors.white },
});
