import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, matchTier, ratingColor } from "../theme";
import { Text } from "./Text";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { fontSize: number; height: number; minWidth: number; paddingHorizontal: number; radius: number }> = {
  sm: { fontSize: 12, height: 22, minWidth: 32, paddingHorizontal: 6, radius: 7 },
  md: { fontSize: 15, height: 28, minWidth: 42, paddingHorizontal: 8, radius: 9 },
  lg: { fontSize: 24, height: 42, minWidth: 62, paddingHorizontal: 12, radius: 13 },
};

export type ScoreBadgeProps = {
  score: number;
  size?: Size;
  /**
   * `solid` (default): the rating colour filled, for the score that leads a row or sits on a photo.
   * `plain`: just the number in its rating colour, for secondary scores (a friend's, a list total).
   */
  variant?: "solid" | "plain";
  style?: StyleProp<ViewStyle>;
};

/** A score out of ten in its rating colour. Same width for every score, so a column of them lines up. */
export function ScoreBadge({ score, size = "md", variant = "solid", style }: ScoreBadgeProps) {
  const spec = SIZES[size];
  const tint = ratingColor(score);
  const text = score.toFixed(1);
  if (variant === "plain") {
    return (
      <Text
        accessibilityLabel={`Score ${text}`}
        style={[styles.text, { fontSize: spec.fontSize + 1, lineHeight: spec.height, color: tint }]}
      >
        {text}
      </Text>
    );
  }
  return (
    <View
      accessibilityLabel={`Score ${text}`}
      style={[
        styles.badge,
        { height: spec.height, minWidth: spec.minWidth, paddingHorizontal: spec.paddingHorizontal, borderRadius: spec.radius, backgroundColor: tint },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: spec.fontSize, lineHeight: spec.height, color: "#0d0b10" }]}>{text}</Text>
    </View>
  );
}

const TIER_STYLES = {
  hi: { backgroundColor: colors.accent, color: colors.white },
  mid: { backgroundColor: colors.mid, color: "#1a1205" },
  lo: { backgroundColor: colors.low, color: colors.white },
} as const;

export function MatchBadge({ match, size = "md" }: { match: number; size?: Size }) {
  const spec = SIZES[size];
  const tier = TIER_STYLES[matchTier(match)];
  return (
    <View
      accessibilityLabel={`${match}% match for you`}
      style={[
        styles.badge,
        { height: spec.height, minWidth: spec.minWidth, paddingHorizontal: spec.paddingHorizontal, borderRadius: spec.radius, backgroundColor: tier.backgroundColor },
      ]}
    >
      <Text style={[styles.text, { fontSize: spec.fontSize, lineHeight: spec.height, color: tier.color }]}>{match}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", alignItems: "center", justifyContent: "center" },
  text: { fontWeight: "800", fontVariant: ["tabular-nums"], letterSpacing: -0.3, textAlign: "center" },
});
