import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { colors } from "../../theme";

/** One short bar per question; the bars up to the current question fill in. */
export function QuizProgress({ step, total }: { step: number; total: number }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Question ${step + 1} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step + 1 }}
      style={styles.row}
    >
      {Array.from({ length: total }, (_, index) => (
        <Segment key={index} filled={index <= step} />
      ))}
    </View>
  );
}

function Segment({ filled }: { filled: boolean }) {
  const [fill] = useState(() => new Animated.Value(filled ? 1 : 0));

  useEffect(() => {
    const animation = Animated.timing(fill, {
      toValue: filled ? 1 : 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      // Width is a layout property, which the native driver cannot animate.
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [fill, filled]);

  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.raised, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2, backgroundColor: colors.fg },
});
