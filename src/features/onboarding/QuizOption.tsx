import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Icon, Text } from "../../components";
import { colors, fontWeight } from "../../theme";
import { NATIVE_DRIVER } from "./Rise";

/**
 * One answer on a quiz card: a big row that dips under the thumb and flips to light when picked.
 * `many` cards are checkboxes, the rest are radios; the screen owns which options are picked.
 */
export function QuizOption({
  label,
  selected,
  many,
  compact,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  many: boolean;
  /** Shorter rows for the card with six options. */
  compact?: boolean;
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
        style={[styles.option, compact && styles.compact, selected && styles.optionOn]}
      >
        <Text style={[styles.label, selected && styles.labelOn]} numberOfLines={1}>
          {label}
        </Text>
        <View style={[styles.mark, many && styles.markMany, selected && styles.markOn]}>
          <Animated.View style={{ opacity: tick, transform: [{ scale: tick }] }}>
            <Icon name="check" size={16} color={colors.fg} />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 68,
    paddingLeft: 22,
    paddingRight: 18,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  compact: { height: 58, borderRadius: 18 },
  optionOn: { backgroundColor: colors.fg },
  label: { flex: 1, fontSize: 18, lineHeight: 24, fontWeight: fontWeight.semibold, color: colors.fg },
  labelOn: { color: colors.bg },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  markMany: { borderRadius: 8 },
  markOn: { borderColor: colors.bg, backgroundColor: colors.bg },
});
