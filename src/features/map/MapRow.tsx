/**
 * One place or event in the map's list and in its search results: photo, name, the backend's
 * reason, what and how far, and the score. Everything shown is the `NearbyItem` as returned.
 */
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { categoryLabel, formatDistance, formatEventTime, formatPrice, formatScore } from "../../lib/format";
import { colors, fontWeight, palette, ratingColor, spacing } from "../../theme";
import { MapPhoto } from "./MapPhoto";
import { displayName } from "./names";

export const ROW_PHOTO = 60;
/** One rounding for every photo on the map screen. */
export const PHOTO_ROUND = 10;
const RING = 44;
/** Every row is this tall, so the list can be sized to show whole rows. */
export const ROW_HEIGHT = ROW_PHOTO + spacing.md * 2;

/** "Cocktail bar · $$ · 350 m" from what the backend sent. */
export function metaLine(item: NearbyItem): string {
  return [categoryLabel(item.category, item.subcategory), formatPrice(item.priceLevel), formatDistance(item.distanceMeters)]
    .filter((part) => part !== "")
    .join(" · ");
}

/** The score as on a feed post: the number in its rating colour inside a thin grey ring. */
export function ScoreRing({ score }: { score: number }) {
  const text = formatScore(score);
  return (
    <View accessibilityLabel={`Score ${text} out of 10`} style={styles.ring}>
      <Text style={[styles.ringText, { color: ratingColor(score) }]}>{text}</Text>
    </View>
  );
}

export function MapRow({
  item,
  onPress,
  last = false,
}: {
  item: NearbyItem;
  onPress: () => void;
  last?: boolean;
}) {
  const when = item.startsAt !== undefined ? formatEventTime(item.startsAt) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${displayName(item.name)}, ${formatScore(item.score)} for you. ${item.why}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <MapPhoto item={item} width={ROW_PHOTO} height={ROW_PHOTO} round={PHOTO_ROUND} />
      <View style={[styles.body, !last && styles.divider]}>
        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.name}>
            {displayName(item.name, true)}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {when ? <Text style={styles.when}>{when}</Text> : null}
            {when ? ` · ${formatDistance(item.distanceMeters)}` : metaLine(item)}
          </Text>
          <Text numberOfLines={1} style={styles.why}>
            {item.why}
          </Text>
        </View>
        <ScoreRing score={item.score} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, height: ROW_HEIGHT, paddingLeft: spacing.lg },
  pressed: { backgroundColor: palette.field },
  // The hairline starts at the text, not under the photo.
  body: {
    flex: 1,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.hairline },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: colors.fg },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  ringText: { fontSize: 15, lineHeight: 19, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  why: { fontSize: 13, lineHeight: 17, color: colors.muted },
  meta: { fontSize: 13, lineHeight: 17, color: colors.muted },
  when: { fontSize: 13, lineHeight: 17, color: colors.accent, fontWeight: fontWeight.semibold },
});
