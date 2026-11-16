/**
 * What floats on top of the group map: the back button, a white pill with the group's faces and
 * its name (tap it to change the group), and under it "Open plan" when the group is a saved plan.
 */
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { AvatarStack, BackButton, Icon, Skeleton, Text, type IconName } from "../../components";
import type { PlanMember } from "../../lib/api";
import { pluralize } from "../../lib/format";
import { colors, fontWeight, palette, spacing } from "../../theme";

export const BAR_HEIGHT = 48;
export const BAR_GAP = spacing.sm;
export const CHIP_HEIGHT = 36;
const GUTTER = spacing.lg - 2;

function FloatChip({
  label,
  icon,
  accent = false,
  onPress,
}: {
  label: string;
  icon: IconName;
  accent?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, styles.shadow, pressed && styles.pressed]}
    >
      <Icon name={icon} size={16} color={accent ? colors.accent : colors.fg} />
      <Text numberOfLines={1} style={[styles.chipText, accent && styles.chipAccent]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function GroupBar({
  top,
  name,
  members,
  loading = false,
  onChangeGroup,
  onOpenPlan,
}: {
  /** Distance from the top of the screen (the status bar and a little air). */
  top: number;
  /** The plan's name, or the picked friends' names. null when no group is chosen yet. */
  name: string | null;
  members: PlanMember[];
  loading?: boolean;
  onChangeGroup: () => void;
  /** Shown as a second chip when the group is a saved plan. */
  onOpenPlan?: () => void;
}) {
  const people = pluralize(members.length, "person", "people");
  return (
    <View style={[styles.wrap, { top }]} pointerEvents="box-none">
      <View style={styles.row} pointerEvents="box-none">
        <BackButton onPhoto style={[styles.back, styles.shadow]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={name === null ? "Choose a group" : `${name}, ${people}. Change group`}
          onPress={onChangeGroup}
          style={({ pressed }) => [styles.pill, styles.shadow, pressed && styles.pressed]}
        >
          {loading ? (
            <Skeleton width={150} height={14} round={7} />
          ) : name === null ? (
            <>
              <View style={styles.glyph}>
                <Icon name="users" size={16} color={colors.muted} />
              </View>
              <Text numberOfLines={1} style={styles.placeholder}>
                Choose a group
              </Text>
            </>
          ) : (
            <>
              <AvatarStack people={members} max={3} size={28} />
              <Text numberOfLines={1} style={styles.name}>
                {name}
              </Text>
            </>
          )}
          {loading ? null : <Icon name="chevronDown" size={16} color={colors.muted} />}
        </Pressable>
      </View>
      {onOpenPlan ? (
        <View style={styles.chips} pointerEvents="box-none">
          <FloatChip label="Open plan" icon="calendar" onPress={onOpenPlan} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: GUTTER, right: GUTTER, gap: BAR_GAP, zIndex: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  shadow: {
    shadowColor: colors.black,
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  back: { width: BAR_HEIGHT, height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, backgroundColor: colors.bg },
  pill: {
    flex: 1,
    minWidth: 0,
    height: BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    paddingLeft: spacing.sm + 2,
    paddingRight: spacing.md + 2,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: colors.bg,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  pressed: { backgroundColor: palette.field },
  glyph: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.field,
  },
  placeholder: { flex: 1, fontSize: 15, lineHeight: 20, color: colors.muted },
  name: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: colors.fg },

  chips: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  chip: {
    height: CHIP_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md + 2,
    borderRadius: CHIP_HEIGHT / 2,
    backgroundColor: colors.bg,
  },
  chipText: { fontSize: 14, lineHeight: 18, fontWeight: fontWeight.semibold, color: colors.fg },
  chipAccent: { color: colors.accent },
});
