import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, matchTier, ratingColor } from "../theme";
import { Text } from "./Text";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { fontSize: number; height: number; minWidth: number; paddingHorizontal: number; radius: number }> = {
  sm: { fontSize: 12, height: 22, minWidth: 32, paddingHorizontal: 6, radius: 7 },
  md: { fontSize: 15, height: 28, minWidth: 42, paddingHorizontal: 8, radius: 9 },
  lg: { fontSize: 24, height: 42, minWidth: 62, paddingHorizontal: 12, radius: 13 },
};

/** The ring: a white disc inside a thin grey line, the number in its rating colour. */
const RINGS: Record<Size, { diameter: number; fontSize: number; border: number }> = {
  sm: { diameter: 34, fontSize: 13, border: 1 },
  md: { diameter: 44, fontSize: 16, border: 1.5 },
  lg: { diameter: 58, fontSize: 21, border: 1.5 },
};
const RING_LINE = "#d6d6dc";

export type ScoreBadgeProps = {
  score: number;
  size?: Size;
  /**
   * `ring` (default): the score in its rating colour inside a thin grey ring, on white.
   * This is the one way a score looks across the app, in lists, on cards and on photos.
   * `solid`: the rating colour filled with a white number, for a tight spot on a busy photo.
   * `plain`: just the number in its rating colour, for secondary scores (a friend's, a list total).
   */
  variant?: "ring" | "solid" | "plain";
  style?: StyleProp<ViewStyle>;
};

/** A score out of ten, one decimal, in its rating colour. Same size for every score, so a column of them lines up. */
export function ScoreBadge({ score, size = "md", variant = "ring", style }: ScoreBadgeProps) {
  const spec = SIZES[size];
  const tint = ratingColor(score);
  const text = score.toFixed(1);
  if (variant === "plain") {
    return (
      <Text
        accessibilityLabel={`Score ${text} out of 10`}
        style={[styles.text, { fontSize: spec.fontSize + 1, lineHeight: spec.height, color: tint }]}
      >
        {text}
      </Text>
    );
  }
  if (variant === "ring") {
    const ring = RINGS[size];
    return (
      <View
        accessibilityLabel={`Score ${text} out of 10`}
        style={[
          styles.badge,
          styles.ring,
          { width: ring.diameter, height: ring.diameter, borderRadius: ring.diameter / 2, borderWidth: ring.border, borderColor: RING_LINE },
          style,
        ]}
      >
        <Text style={[styles.text, styles.ringText, { fontSize: ring.fontSize, lineHeight: Math.round(ring.fontSize * 1.25), color: tint }]}>{text}</Text>
      </View>
    );
  }
  return (
    <View
      accessibilityLabel={`Score ${text} out of 10`}
      style={[
        styles.badge,
        { height: spec.height, minWidth: spec.minWidth, paddingHorizontal: spec.paddingHorizontal, borderRadius: spec.radius, backgroundColor: tint },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: spec.fontSize, lineHeight: spec.height, color: colors.white }]}>{text}</Text>
    </View>
  );
}

const TIER_STYLES = {
  hi: { backgroundColor: colors.accentSoft, color: colors.accent },
  mid: { backgroundColor: colors.surface, color: colors.fg },
  lo: { backgroundColor: colors.surface, color: colors.muted },
} as const;

/** How well a place fits you, as a quiet pill: red when it is a strong match, grey otherwise. */
export function MatchBadge({ match, size = "md" }: { match: number; size?: Size }) {
  const spec = SIZES[size];
  const tier = TIER_STYLES[matchTier(match)];
  return (
    <View
      accessibilityLabel={`${match}% match for you`}
      style={[
        styles.badge,
        { height: spec.height, minWidth: spec.minWidth, paddingHorizontal: spec.paddingHorizontal + 2, borderRadius: spec.height / 2, backgroundColor: tier.backgroundColor },
      ]}
    >
      <Text style={[styles.text, styles.matchText, { fontSize: spec.fontSize - 1, lineHeight: spec.height, color: tier.color }]}>{match}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", alignItems: "center", justifyContent: "center" },
  ring: { backgroundColor: colors.white },
  text: { fontWeight: "800", fontVariant: ["tabular-nums"], letterSpacing: -0.3, textAlign: "center" },
  ringText: { fontWeight: "700", letterSpacing: -0.2 },
  matchText: { fontWeight: "700" },
});
