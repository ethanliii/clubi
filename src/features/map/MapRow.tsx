/**
 * One place or event in the map's list and in its search results: photo, name, the backend's
 * reason, what and how far, and the score. Everything shown is the `NearbyItem` as returned.
 */
import { Pressable, StyleSheet, View } from "react-native";
import { ScoreBadge, Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { categoryLabel, formatDistance, formatEventTime, formatPrice, formatScore } from "../../lib/format";
import { colors, fontSize, fontWeight, palette, radius, spacing } from "../../theme";
import { MapPhoto } from "./MapPhoto";

export const ROW_PHOTO = 68;
/** Every row is this tall, so the list can be sized to show whole rows. */
export const ROW_HEIGHT = ROW_PHOTO + spacing.md * 2;

/** "Cocktail bar · $$ · 350 m" from what the backend sent. */
export function metaLine(item: NearbyItem): string {
  return [categoryLabel(item.category, item.subcategory), formatPrice(item.priceLevel), formatDistance(item.distanceMeters)]
    .filter((part) => part !== "")
    .join(" · ");
}

export function MapRow({
  item,
  onPress,
  showRank = false,
  last = false,
}: {
  item: NearbyItem;
  onPress: () => void;
  /** Number the row with the backend's `rank`: "1. Name". */
  showRank?: boolean;
  last?: boolean;
}) {
  const when = item.startsAt !== undefined ? formatEventTime(item.startsAt) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${formatScore(item.score)} for you. ${item.why}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <MapPhoto item={item} width={ROW_PHOTO} height={ROW_PHOTO} round={radius.lg - 2} />
      <View style={[styles.body, !last && styles.divider]}>
        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.name}>
            {showRank ? `${item.rank}. ${item.name}` : item.name}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {when ? <Text style={styles.when}>{when}</Text> : null}
            {when ? ` · ${formatDistance(item.distanceMeters)}` : metaLine(item)}
          </Text>
          <Text numberOfLines={1} style={styles.why}>
            {item.why}
          </Text>
        </View>
        {/* The badge aligns itself to the top of whatever holds it; this holds it in the middle of the row. */}
        <View>
          <ScoreBadge score={item.score} />
        </View>
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
  name: { fontSize: fontSize.bodyLg, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: colors.fg },
  why: { fontSize: 13, lineHeight: 17, color: colors.muted },
  meta: { fontSize: 13, lineHeight: 17, color: colors.muted },
  when: { fontSize: 13, lineHeight: 17, color: colors.accent, fontWeight: fontWeight.semibold },
});
