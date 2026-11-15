import { StyleSheet, View } from "react-native";
import { Text } from "../../components";
import { colors, radius, spacing } from "../../theme";

/** The taste meters the backend returns (`tasteSummary`). Draws nothing for an empty list. */
export function TasteMeters({ summary, title }: { summary: { label: string; pct: number }[]; title?: string }) {
  if (summary.length === 0) return null;
  return (
    <View style={styles.card}>
      {title ? <Text variant="label">{title}</Text> : null}
      {summary.map((meter) => {
        const shown = `${Math.round(meter.pct)}%`;
        return (
          <View key={meter.label} accessibilityLabel={`${meter.label} ${shown}`} style={styles.row}>
            <Text variant="caption" numberOfLines={1} style={styles.label}>
              {meter.label}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, meter.pct))}%` }]} />
            </View>
            <Text variant="caption" style={styles.value}>
              {shown}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { width: 96 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.raised, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.accent },
  value: { width: 36, textAlign: "right", fontVariant: ["tabular-nums"] },
});
