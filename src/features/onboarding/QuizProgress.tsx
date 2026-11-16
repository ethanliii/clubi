import { StyleSheet, View } from "react-native";
import { colors } from "../../theme";

/** One short rounded segment per question across the top of the quiz; the ones reached so far are filled. */
export function QuizProgress({ step, total }: { step: number; total: number }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Question ${step + 1} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step + 1 }}
      style={styles.track}
    >
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.segment, index <= step && styles.done]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", gap: 5, height: 4 },
  segment: { flex: 1, borderRadius: 2, backgroundColor: colors.raised },
  done: { backgroundColor: colors.accent },
});
