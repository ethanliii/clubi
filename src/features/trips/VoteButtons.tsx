import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text } from "../../components";
import { colors, fontWeight, palette, radius } from "../../theme";

export type Vote = 1 | -1;

/**
 * "Vote up" and "Vote down" as two quiet line icons. They sit in one grey pill; the one I already picked is tinted (dark red for
 * up, near-black for down); the screen decides what a tap means (tapping the active
 * one clears it). Pass `up` / `down` to show the counts beside the thumbs, as the shortlist does.
 */
export function VoteButtons({
  myVote,
  up,
  down,
  onVote,
}: {
  myVote: Vote | undefined;
  up?: number;
  down?: number;
  onVote: (tapped: Vote) => void;
}) {
  return (
    <View style={styles.row}>
      <View pointerEvents="none" style={styles.pill} />
      <Thumb icon="thumbUp" label="Vote up" on={myVote === 1} count={up} tone="up" onPress={() => onVote(1)} />
      <View pointerEvents="none" style={styles.split} />
      <Thumb icon="thumbDown" label="Vote down" on={myVote === -1} count={down} tone="down" onPress={() => onVote(-1)} />
    </View>
  );
}

function Thumb({
  icon,
  label,
  on,
  count,
  tone,
  onPress,
}: {
  icon: "thumbUp" | "thumbDown";
  label: string;
  on: boolean;
  count?: number;
  tone: "up" | "down";
  onPress: () => void;
}) {
  const ink = on ? (tone === "up" ? colors.accent : colors.fg) : palette.soft;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.thumb,
        count !== undefined && styles.counted,
        on && (tone === "up" ? styles.upOn : styles.downOn),
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={18} color={ink} />
      {count === undefined ? null : <Text style={[styles.count, { color: ink }]}>{count}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // One grey pill behind both thumbs (36 tall to the eye, each thumb still a 44pt target).
  row: { flexDirection: "row", alignItems: "center", height: 44 },
  pill: { position: "absolute", left: 0, right: 0, top: 4, bottom: 4, borderRadius: radius.pill, backgroundColor: palette.field },
  split: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: colors.line },
  thumb: {
    minWidth: 46,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  counted: { paddingHorizontal: 12 },
  upOn: {},
  downOn: {},
  pressed: { opacity: 0.55 },
  count: { fontSize: 14, lineHeight: 18, fontWeight: fontWeight.semibold, fontVariant: ["tabular-nums"] },
});
