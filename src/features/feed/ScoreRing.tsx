import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "../../components";
import { colors, ratingColor } from "../../theme";

/**
 * A score out of ten, one decimal, in its rating colour inside a thin grey ring, as in the reference feed:
 * green for liked, amber for fine, red for didn't like. The same on every post.
 */
export function ScoreRing({ score, size = 44, style }: { score: number; size?: number; style?: StyleProp<ViewStyle> }) {
  const tint = ratingColor(score);
  const text = score.toFixed(1);
  return (
    <View
      accessibilityLabel={`Score ${text} out of 10`}
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }, style]}
    >
      <Text style={[styles.text, { fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.46), color: tint }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.bg },
  text: { fontWeight: "700", fontVariant: ["tabular-nums"], letterSpacing: -0.3, textAlign: "center" },
});
