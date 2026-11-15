import { StyleSheet, View } from "react-native";
import { Meter, Text } from "../../components";
import { colors, radius, spacing } from "../../theme";

/** The taste meters the backend returns (`tasteSummary`). Draws nothing for an empty list. */
export function TasteMeters({ summary, title = "Taste" }: { summary: { label: string; pct: number }[]; title?: string }) {
  if (summary.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text variant="label">{title}</Text>
      {summary.map((meter) => (
        <Meter key={meter.label} label={meter.label} value={meter.pct} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
