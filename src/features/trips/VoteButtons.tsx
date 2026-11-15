import { StyleSheet, View } from "react-native";
import { IconButton } from "../../components";
import { colors, spacing } from "../../theme";

export type Vote = 1 | -1;

/**
 * 👍 "Vote up" and 👎 "Vote down". The one I already picked is drawn in the accent color;
 * the screen decides what a tap means (tapping the active one clears it).
 * Pass `up` / `down` to show the counts next to the thumbs, as the shortlist does.
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
      <IconButton
        icon="thumbUp"
        accessibilityLabel="Vote up"
        size={36}
        selected={myVote === 1}
        color={myVote === 1 ? colors.accent : colors.fg}
        label={up === undefined ? undefined : String(up)}
        onPress={() => onVote(1)}
      />
      <IconButton
        icon="thumbDown"
        accessibilityLabel="Vote down"
        size={36}
        selected={myVote === -1}
        color={myVote === -1 ? colors.accent : colors.fg}
        label={down === undefined ? undefined : String(down)}
        onPress={() => onVote(-1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
});
