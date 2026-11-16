import { StyleSheet, View } from "react-native";
import { Text } from "../../components";
import { colors, fontWeight, spacing } from "../../theme";

/**
 * The taste meters the backend returns (`tasteSummary`), two to a line. Draws nothing for an empty list.
 * Black on every profile; the accent is kept for the "You" marker on Compare.
 */
export function TasteMeters({ summary }: { summary: { label: string; pct: number }[] }) {
  if (summary.length === 0) return null;
  return (
    <View style={styles.grid}>
      {summary.map((meter) => {
        const shown = `${Math.round(meter.pct)}%`;
        return (
          <View key={meter.label} accessibilityLabel={`${meter.label} ${shown}`} style={styles.cell}>
            <View style={styles.labels}>
              <Text numberOfLines={1} style={styles.label}>
                {meter.label}
              </Text>
              <Text muted style={styles.value}>
                {shown}
              </Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.min(100, Math.max(0, meter.pct))}%`, backgroundColor: colors.fg },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.xl, rowGap: spacing.lg },
  // Two columns: half the row minus half the gap.
  cell: { flexBasis: "40%", flexGrow: 1, gap: spacing.sm },
  labels: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
  label: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: fontWeight.semibold },
  value: { fontSize: 13, fontVariant: ["tabular-nums"] },
  track: { height: 4, borderRadius: 2, backgroundColor: "#ececf0", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
});
