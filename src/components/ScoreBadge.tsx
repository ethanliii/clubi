import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fontWeight, matchTier, radius, ratingColor } from "../theme";
import { Text } from "./Text";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { fontSize: number; paddingVertical: number; paddingHorizontal: number }> = {
  sm: { fontSize: 11, paddingVertical: 2, paddingHorizontal: 6 },
  md: { fontSize: 15, paddingVertical: 3, paddingHorizontal: 8 },
  lg: { fontSize: 22, paddingVertical: 6, paddingHorizontal: 12 },
};

export type ScoreBadgeProps = {
  score: number;
  size?: Size;
  /** `solid` (default) filled rating colour · `plain` just the number in its colour (main's screens). */
  variant?: "solid" | "plain";
  style?: StyleProp<ViewStyle>;
};

/** Bryan's badge look; `variant` and `style` added for main's screens. */
export function ScoreBadge({ score, size = "md", variant = "solid", style }: ScoreBadgeProps) {
  const { fontSize, ...padding } = SIZES[size];
  const text = score.toFixed(1);
  if (variant === "plain") {
    return (
      <Text accessibilityLabel={`Score ${text}`} style={[styles.text, { fontSize: fontSize + 1, lineHeight: (fontSize + 1) * 1.25, color: ratingColor(score) }]}>
        {text}
      </Text>
    );
  }
  return (
    <View accessibilityLabel={`Score ${text}`} style={[styles.badge, padding, { backgroundColor: ratingColor(score) }, style]}>
      <Text style={[styles.text, { fontSize, lineHeight: fontSize * 1.25, color: "#111" }]}>{text}</Text>
    </View>
  );
}

const TIER_STYLES = {
  hi: { backgroundColor: colors.accent, color: colors.white },
  mid: { backgroundColor: colors.mid, color: "#1a1205" },
  lo: { backgroundColor: colors.low, color: colors.white },
} as const;

export function MatchBadge({ match, size = "md" }: { match: number; size?: Size }) {
  const { fontSize, ...padding } = SIZES[size];
  const tier = TIER_STYLES[matchTier(match)];
  return (
    <View
      accessibilityLabel={`${match}% match for you`}
      style={[styles.badge, padding, { backgroundColor: tier.backgroundColor }, matchTier(match) === "hi" && styles.glow]}
    >
      <Text style={[styles.text, { fontSize, lineHeight: fontSize * 1.25, color: tier.color }]}>{match}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.md, alignSelf: "flex-start" },
  text: { fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
  glow: { shadowColor: colors.accent, shadowOpacity: 0.55, shadowRadius: 9, shadowOffset: { width: 0, height: 0 } },
});
