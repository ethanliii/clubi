import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { colors } from "../../theme";

/** One thin bar across the top of the quiz that fills as the questions go by. */
export function QuizProgress({ step, total }: { step: number; total: number }) {
  const done = (step + 1) / total;
  const [fill] = useState(() => new Animated.Value(done));

  useEffect(() => {
    const animation = Animated.timing(fill, {
      toValue: done,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      // Width is a layout property, which the native driver cannot animate.
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [fill, done]);

  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Question ${step + 1} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step + 1 }}
      style={styles.track}
    >
      <Animated.View style={[styles.fill, { width }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 4, borderRadius: 2, backgroundColor: colors.raised, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2, backgroundColor: colors.accent },
});
