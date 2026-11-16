import { StyleSheet, View } from "react-native";
import { Text } from "../../components";
import { colors, fontWeight, spacing } from "../../theme";

const DOT = 14;
const clamp = (value: number) => Math.min(100, Math.max(0, value));

function Key({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.key}>
      <View style={[styles.keyDot, { backgroundColor: color }]} />
      <Text variant="caption" muted numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Two taste profiles on the same lines: one track per dimension with my dot (pink) and theirs
 * (white). Dots close together are where we agree; a long bar between them is where we don't.
 * Every position is the 0–100 value the backend returned.
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
      <View style={styles.legend}>
        <Key color={colors.accent} label="You" />
        <Key color={colors.fg} label={theirName} />
      </View>
      {dims.map((dim) => {
        const me = clamp(dim.me);
        const them = clamp(dim.them);
        return (
          <View
            key={dim.label}
            accessibilityLabel={`${dim.label}: you ${Math.round(dim.me)}%, ${theirName} ${Math.round(dim.them)}%`}
            style={styles.dim}
          >
            <View style={styles.labels}>
              <Text numberOfLines={1} style={styles.label}>
                {dim.label}
              </Text>
              <Text style={styles.values}>
                <Text style={[styles.values, styles.mine]}>{`${Math.round(dim.me)}%`}</Text>
                <Text style={[styles.values, styles.sep]}>{"  ·  "}</Text>
                {`${Math.round(dim.them)}%`}
              </Text>
            </View>
            <View style={styles.plot}>
              <View style={styles.track} />
              <View style={styles.inner}>
                <View
                  style={[styles.gap, { left: `${Math.min(me, them)}%`, width: `${Math.abs(me - them)}%` }]}
                />
                <View style={[styles.dot, styles.theirDot, { left: `${them}%` }]} />
                <View style={[styles.dot, styles.myDot, { left: `${me}%` }]} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  legend: { flexDirection: "row", gap: spacing.lg },
  key: { flexDirection: "row", alignItems: "center", gap: 6 },
  keyDot: { width: 8, height: 8, borderRadius: 4 },
  dim: { gap: spacing.sm },
  labels: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.md },
  label: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: fontWeight.semibold },
  values: { fontSize: 13, lineHeight: 18, fontVariant: ["tabular-nums"], color: colors.fg },
  mine: { color: colors.accent, fontWeight: fontWeight.bold },
  sep: { color: colors.muted },
  plot: { height: DOT, justifyContent: "center" },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.raised },
  // Inset by half a dot so 0% and 100% keep the whole dot on the track.
  inner: { position: "absolute", left: DOT / 2, right: DOT / 2, top: 0, bottom: 0 },
  gap: { position: "absolute", top: (DOT - 4) / 2, height: 4, backgroundColor: colors.low },
  dot: {
    position: "absolute",
    top: 0,
    width: DOT,
    height: DOT,
    marginLeft: -DOT / 2,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  myDot: { backgroundColor: colors.accent },
  theirDot: { backgroundColor: colors.fg },
});
