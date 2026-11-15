import { StyleSheet, View } from "react-native";
import { Text } from "../../components";
import { colors, spacing } from "../../theme";

function Bar({ who, value, color }: { who: string; value: number; color: string }) {
  const share = Math.min(100, Math.max(0, value));
  return (
    <View style={styles.bar}>
      <Text variant="caption" muted numberOfLines={1} style={styles.who}>
        {who}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${share}%`, backgroundColor: color }]} />
      </View>
      <Text variant="caption" style={styles.value}>
        {`${Math.round(value)}%`}
      </Text>
    </View>
  );
}

/** One taste dimension for two people, side by side: the two 0–100 values the backend returned. */
export function DualMeter({
  label,
  me,
  them,
  theirName,
}: {
  label: string;
  me: number;
  them: number;
  theirName: string;
}) {
  return (
    <View accessibilityLabel={`${label}: you ${Math.round(me)}%, ${theirName} ${Math.round(them)}%`} style={styles.wrap}>
      <Text variant="caption">{label}</Text>
      <Bar who="You" value={me} color={colors.accent} />
      <Bar who={theirName} value={them} color={colors.mid} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  who: { width: 54 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.raised, overflow: "hidden" },
  fill: { height: "100%" },
  value: { width: 36, textAlign: "right", fontVariant: ["tabular-nums"] },
});
