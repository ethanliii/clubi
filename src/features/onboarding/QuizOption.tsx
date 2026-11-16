import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Icon, Text } from "../../components";
import { colors, fontWeight, radius } from "../../theme";
import { NATIVE_DRIVER } from "./Rise";

/**
 * One answer on a quiz card: a big light-grey row that dips under the thumb and turns black when picked.
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
            <Icon name="check" size={15} color={colors.fg} />
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
    height: 58,
    paddingLeft: 22,
    paddingRight: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  compact: { height: 52 },
  optionOn: { backgroundColor: colors.fg },
  label: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: colors.fg },
  labelOn: { color: colors.white },
  mark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#c4c4cc",
    alignItems: "center",
    justifyContent: "center",
  },
  markMany: { borderRadius: 7 },
  markOn: { borderColor: colors.white, backgroundColor: colors.white },
});
