/**
 * One pick in the group map's list: photo, name, what and how far, how much the group agrees, the
 * GROUP score in the shared ring, and under it each member's own score as a small labelled chip.
 * Everything shown is the `GroupItem` as the backend returned it.
 */
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ScoreBadge, Text } from "../../components";
import { MapPhoto } from "../map/MapPhoto";
import { metaLine } from "../map/MapRow";
import type { GroupItem } from "../../lib/api";
import { formatDistance, formatEventTime, formatScore } from "../../lib/format";
import { colors, fontSize, fontWeight, palette, radius, spacing } from "../../theme";
import { agreementHint, firstName, type Agreement } from "./group";

const PHOTO = 68;
/** Roughly how tall a row with one line of chips is: the list's peek height is sized from it. */
export const GROUP_ROW_HEIGHT = PHOTO + spacing.md * 2 + 34;

const TONE: Record<Agreement["tone"], string> = { together: colors.ok, mixed: colors.low, split: colors.mid };

/** "Everyone's into it" / "Split", with a dot in its colour. Draws nothing for a group of one. */
export function AgreementHint({ item }: { item: GroupItem }) {
  const hint = agreementHint(item.agreement, item.memberScores.length);
  if (hint === null) return null;
  return (
    <View style={styles.hint}>
      <View style={[styles.dot, { backgroundColor: TONE[hint.tone] }]} />
      <Text numberOfLines={1} style={[styles.hintText, hint.tone === "together" && styles.hintTogether]}>
        {hint.label}
      </Text>
    </View>
  );
}

/** "You 8.4", "Maya 7.1": each member's own predicted score for this pick. */
export function MemberChips({
  item,
  meId,
  style,
}: {
  item: GroupItem;
  /** The signed-in user, so their chip reads "You". */
  meId?: string;
  style?: StyleProp<ViewStyle>;
}) {
  if (item.memberScores.length === 0) return null;
  return (
    <View style={[styles.chips, style]}>
      {item.memberScores.map((member) => {
        const name = member.userId === meId ? "You" : firstName(member.displayName);
        return (
          <View
            key={member.userId}
            accessible
            accessibilityLabel={`${name}: ${formatScore(member.score)}`}
            style={styles.chip}
          >
            <Text numberOfLines={1} style={styles.chipName}>
              {name}
            </Text>
            <ScoreBadge score={member.score} size="sm" variant="plain" />
          </View>
        );
      })}
    </View>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${formatScore(item.score)} for the group. ${item.why}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <MapPhoto item={item} width={PHOTO} height={PHOTO} round={radius.lg - 2} />
      <View style={[styles.body, !last && styles.divider]}>
        <View style={styles.top}>
          <View style={styles.text}>
            <Text numberOfLines={1} style={styles.name}>
              {`${item.rank}. ${item.name}`}
            </Text>
            <Text numberOfLines={1} style={styles.meta}>
              {when ? <Text style={styles.when}>{when}</Text> : null}
              {when ? ` · ${formatDistance(item.distanceMeters)}` : metaLine(item)}
            </Text>
            <AgreementHint item={item} />
          </View>
          <View style={styles.score}>
            <ScoreBadge score={item.score} style={styles.badge} />
            <Text style={styles.scoreLabel}>Group</Text>
          </View>
        </View>
        <MemberChips item={item} meId={meId} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingLeft: spacing.lg, paddingTop: spacing.md },
  pressed: { backgroundColor: palette.field },
  // The hairline starts at the text, not under the photo.
  body: { flex: 1, minWidth: 0, gap: spacing.sm, paddingRight: spacing.lg, paddingBottom: spacing.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.hairline },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: PHOTO },
  text: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: fontSize.bodyLg, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: colors.fg },
  meta: { fontSize: 13, lineHeight: 17, color: colors.muted },
  when: { fontSize: 13, lineHeight: 17, color: colors.accent, fontWeight: fontWeight.semibold },
  score: { alignItems: "center", gap: 2 },
  badge: { alignSelf: "center" },
  scoreLabel: { fontSize: 10.5, lineHeight: 13, fontWeight: fontWeight.semibold, color: colors.muted },

  hint: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 17 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  hintText: { flexShrink: 1, fontSize: 13, lineHeight: 17, fontWeight: fontWeight.medium, color: palette.soft },
  hintTogether: { color: colors.fg, fontWeight: fontWeight.semibold },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 26,
    maxWidth: 132,
    paddingHorizontal: 9,
    borderRadius: 13,
    backgroundColor: palette.field,
  },
  chipName: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: fontWeight.medium, color: palette.soft },
});
