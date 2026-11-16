/**
 * One pick in the group map's list: photo, name, one grey line (what, how far, how much the group
 * agrees), each member's own score as a line of text, and the GROUP score in the thin ring.
 * Everything shown is the `GroupItem` as the backend returned it.
 */
import { Pressable, StyleSheet, View, type StyleProp, type TextStyle } from "react-native";
import { Text } from "../../components";
import { MapPhoto } from "../map/MapPhoto";
import { ScoreRing, metaLine } from "../map/MapRow";
import { displayName } from "../map/names";
import type { GroupItem } from "../../lib/api";
import { formatDistance, formatEventTime, formatScore } from "../../lib/format";
import { colors, fontSize, fontWeight, palette, ratingColor, spacing } from "../../theme";
import { agreementHint, firstName, type Agreement } from "./group";

const PHOTO = 60;
/** Every row is this tall: the list's peek height is sized from it. */
export const GROUP_ROW_HEIGHT = PHOTO + spacing.md * 2;

/** Short enough to end the grey line. */
const SHORT: Record<Agreement["tone"], string> = { together: "Everyone's in", mixed: "Mostly agree", split: "Split" };

/** "Everyone's into it" / "Mostly agree" / "Split". null for a group of one. */
export function agreementWords(item: GroupItem, short = false): string | null {
  const hint = agreementHint(item.agreement, item.memberScores.length);
  if (hint === null) return null;
  return short ? SHORT[hint.tone] : hint.label;
}

/** "You 8.4 · Maya 7.1": each member's own predicted score, the number in its rating colour. */
export function MemberLine({
  item,
  meId,
  style,
}: {
  item: GroupItem;
  /** The signed-in user, so their score reads "You". */
  meId?: string;
  style?: StyleProp<TextStyle>;
}) {
  if (item.memberScores.length === 0) return null;
  const names = item.memberScores.map((member) => (member.userId === meId ? "You" : firstName(member.displayName)));
  return (
    <Text
      numberOfLines={1}
      accessibilityLabel={item.memberScores.map((member, index) => `${names[index]}: ${formatScore(member.score)}`).join(", ")}
      style={[styles.members, style]}
    >
      {item.memberScores.map((member, index) => (
        <Text key={member.userId} style={styles.members}>
          {index > 0 ? "  ·  " : ""}
          {names[index]}{" "}
          <Text style={[styles.memberScore, { color: ratingColor(member.score) }]}>{formatScore(member.score)}</Text>
        </Text>
      ))}
    </Text>
  );
}

export function GroupRow({
  item,
  meId,
  onPress,
  last = false,
}: {
  item: GroupItem;
  meId?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const when = item.startsAt !== undefined ? formatEventTime(item.startsAt) : null;
  const agree = agreementWords(item, true);
  const rest = [when ? formatDistance(item.distanceMeters) : metaLine(item), agree ?? ""].filter((part) => part !== "").join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${displayName(item.name)}, ${formatScore(item.score)} for the group. ${item.why}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <MapPhoto item={item} width={PHOTO} height={PHOTO} round={10} />
      <View style={[styles.body, !last && styles.divider]}>
        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.name}>
            {displayName(item.name, true)}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {when ? <Text style={styles.when}>{when}</Text> : null}
            {when ? ` · ${rest}` : rest}
          </Text>
          <MemberLine item={item} meId={meId} />
        </View>
        <ScoreRing score={item.score} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, height: GROUP_ROW_HEIGHT, paddingLeft: spacing.lg },
  pressed: { backgroundColor: palette.field },
  // The hairline starts at the text, not under the photo.
  body: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.hairline },
  text: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: fontSize.bodyLg, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: colors.fg },
  meta: { fontSize: 13, lineHeight: 17, color: colors.muted },
  when: { fontSize: 13, lineHeight: 17, color: colors.accent, fontWeight: fontWeight.semibold },
  members: { fontSize: 13, lineHeight: 17, color: colors.muted },
  memberScore: { fontSize: 13, lineHeight: 17, fontWeight: fontWeight.bold },
});
