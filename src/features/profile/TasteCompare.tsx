import { StyleSheet, View } from "react-native";
import { Text } from "../../components";
import { colors, fontWeight, spacing } from "../../theme";

const clamp = (value: number) => Math.min(100, Math.max(0, value));
const DOT = 12;

function Key({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.key}>
      <View style={[styles.keyDot, { backgroundColor: color }]} />
      <Text numberOfLines={1} style={styles.keyText}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Two taste profiles on one line per dimension: a thin grey track with two dots on it, mine in
 * the accent and theirs in black, each placed at the 0–100 value the backend returned. The key
 * ("You", their name) is said once, above the rows.
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
    <View>
      <View style={styles.keys}>
        <Key color={colors.accent} label="You" />
        <Key color={colors.fg} label={theirName} />
      </View>
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
          <View style={styles.lane}>
            <View style={styles.track} />
            <View style={[styles.dot, { left: `${clamp(dim.them)}%`, backgroundColor: colors.fg }]} />
            <View style={[styles.dot, { left: `${clamp(dim.me)}%`, backgroundColor: colors.accent }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  keys: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md, paddingBottom: spacing.xs },
  key: { flexDirection: "row", alignItems: "center", gap: 6 },
  keyDot: { width: 8, height: 8, borderRadius: 4 },
  keyText: { fontSize: 13, lineHeight: 17, color: colors.muted },
  dim: { flexDirection: "row", alignItems: "center", gap: spacing.md, height: 44 },
  label: { width: 132, fontSize: 15, lineHeight: 20, fontWeight: fontWeight.semibold, color: colors.fg },
  // The dots are centred on their value, so the lane is inset by half a dot at each end.
  lane: { flex: 1, height: DOT, justifyContent: "center", marginHorizontal: DOT / 2 },
  track: { height: 6, borderRadius: 3, backgroundColor: "#ececf0", marginHorizontal: -DOT / 2 },
  dot: {
    position: "absolute",
    top: 0,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    marginLeft: -DOT / 2,
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
