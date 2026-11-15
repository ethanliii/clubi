import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text } from "../../components";
import { colors, fontWeight, radius } from "../../theme";

export type Vote = 1 | -1;

/**
 * "Vote up" and "Vote down". The one I already picked is filled (pink for up, light for down);
 * the screen decides what a tap means (tapping the active one clears it).
 * Pass `up` / `down` to show the counts beside the thumbs, as the shortlist does.
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
      <Thumb icon="thumbUp" label="Vote up" on={myVote === 1} count={up} tone="up" onPress={() => onVote(1)} />
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
  const ink = on ? (tone === "up" ? colors.white : colors.bg) : colors.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.thumb,
        count !== undefined && styles.counted,
        on && (tone === "up" ? styles.upOn : styles.downOn),
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={19} color={ink} />
      {count === undefined ? null : <Text style={[styles.count, { color: ink }]}>{count}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  thumb: {
    minWidth: 44,
    height: 44,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.surface,
  },
  counted: { paddingHorizontal: 14 },
  upOn: { backgroundColor: colors.accent },
  downOn: { backgroundColor: colors.fg },
  pressed: { opacity: 0.6, transform: [{ scale: 0.94 }] },
  count: { fontSize: 14, lineHeight: 18, fontWeight: fontWeight.semibold, fontVariant: ["tabular-nums"] },
});
