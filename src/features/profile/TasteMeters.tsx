import { StyleSheet, View } from "react-native";
import { Text } from "../../components";
import { colors, fontWeight, spacing } from "../../theme";

/**
 * The taste meters the backend returns (`tasteSummary`), two to a line. Draws nothing for an empty list.
 * Pink is always me, so my own profile draws them in the accent and everyone else's in the text colour.
 */
export function TasteMeters({ summary, mine = false }: { summary: { label: string; pct: number }[]; mine?: boolean }) {
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
                  { width: `${Math.min(100, Math.max(0, meter.pct))}%`, backgroundColor: mine ? colors.accent : colors.fg },
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
  label: { flex: 1, fontWeight: fontWeight.semibold },
  value: { fontSize: 13, fontVariant: ["tabular-nums"] },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.raised, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
});
