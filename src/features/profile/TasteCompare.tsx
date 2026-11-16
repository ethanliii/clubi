import { StyleSheet, View } from "react-native";
import { Text } from "../../components";
import { colors, fontWeight, spacing } from "../../theme";

const clamp = (value: number) => Math.min(100, Math.max(0, value));

function Bar({ who, value, mine }: { who: string; value: number; mine: boolean }) {
  return (
    <View style={styles.line}>
      <Text numberOfLines={1} style={[styles.who, mine && styles.mine]}>
        {who}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamp(value)}%`, backgroundColor: mine ? colors.accent : colors.fg }]} />
      </View>
      <Text style={[styles.value, mine && styles.mine]}>{`${Math.round(value)}%`}</Text>
    </View>
  );
}

/**
 * Two taste profiles side by side: for each dimension a pair of slim bars, mine in the accent
 * and theirs in black, each with its number at the right. Every width is the 0–100 value the
 * backend returned.
 */
export function TasteCompare({
  dims,
  theirName,
}: {
  dims: { label: string; me: number; them: number }[];
  theirName: string;
}) {
  if (dims.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {dims.map((dim) => (
        <View
          key={dim.label}
          accessible
          accessibilityLabel={`${dim.label}: you ${Math.round(dim.me)}%, ${theirName} ${Math.round(dim.them)}%`}
          style={styles.dim}
        >
          <Text numberOfLines={1} style={styles.label}>
            {dim.label}
          </Text>
          <Bar who="You" value={dim.me} mine />
          <Bar who={theirName} value={dim.them} mine={false} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  dim: { gap: 6 },
  label: { fontSize: 14, lineHeight: 19, fontWeight: fontWeight.bold, color: colors.fg },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  who: { width: 64, fontSize: 13, lineHeight: 17, color: colors.muted },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.raised, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
  value: { width: 40, textAlign: "right", fontSize: 13, lineHeight: 17, color: colors.fg, fontVariant: ["tabular-nums"] },
  mine: { color: colors.accent, fontWeight: fontWeight.bold },
});
