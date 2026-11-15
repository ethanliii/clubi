import { StyleSheet, View } from "react-native";
import { colors, spacing } from "../theme";
import { Text } from "./Text";

export type MeterProps = {
  label: string;
  /** How full the bar is, from 0 to `max`. */
  value: number;
  /** 100 for percentages (default), 10 for a venue's breakdown. */
  max?: number;
  /** The text on the right. Defaults to "70%" when max is 100, else the value with one decimal. */
  valueLabel?: string;
  color?: string;
};

/** A labelled bar: taste meters ("Chill 70%"), a venue's breakdown, compare rows. Draws the number it is given. */
export function Meter({ label, value, max = 100, valueLabel, color = colors.accent }: MeterProps) {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const shown = valueLabel ?? (max === 100 ? `${Math.round(value)}%` : value.toFixed(1));
  return (
    <View accessibilityLabel={`${label} ${shown}`} style={styles.wrap}>
      <View style={styles.labels}>
        <Text variant="caption">{label}</Text>
        <Text variant="caption" muted>
          {shown}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  labels: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  track: { height: 8, borderRadius: 8, backgroundColor: colors.raised, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 8 },
});
