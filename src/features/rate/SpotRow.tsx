import { Pressable, StyleSheet, View } from "react-native";
import { Skeleton, Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { categoryLabel, formatDistance, formatEventTime } from "../../lib/format";
import { spacing } from "../../theme";
import { displayName } from "../home/itemText";
import { PlacePhoto, type } from "./ui";

const PHOTO = 48;
const ROUND = 10;

/** "Cafe · 200 m", or for an event "Sat Dec 5 · 9:30 PM · 200 m". */
function metaLine(item: NearbyItem): string {
  return [
    item.startsAt !== undefined ? formatEventTime(item.startsAt) : categoryLabel(item.category, item.subcategory),
    formatDistance(item.distanceMeters),
  ]
    .filter((part) => part !== "")
    .join(" · ");
}

/** One place or event to rank: its photo, its name, what and how far it is. */
export function SpotRow({ item, onPress }: { item: NearbyItem; onPress: () => void }) {
  return (
    <Pressable
      testID="rate-row"
      accessibilityRole="button"
      accessibilityLabel={`Rank ${item.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {/* Without a picture the tile is a circle, so it reads as a category icon, not a missing image. */}
      <PlacePhoto uri={item.imageUrl} category={item.category} height={PHOTO} width={PHOTO} round={item.imageUrl ? ROUND : PHOTO / 2} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={type.strong}>
          {displayName(item.name)}
        </Text>
        <Text numberOfLines={1} style={type.meta}>
          {metaLine(item)}
        </Text>
      </View>
    </Pressable>
  );
}

/** The list while it loads, in the shape of the rows. */
export function SpotRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading">
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton width={PHOTO} height={PHOTO} round={ROUND} />
          <View style={[styles.text, styles.lines]}>
            <Skeleton width="58%" height={15} />
            <Skeleton width="34%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: PHOTO + spacing.md * 2 - 4 },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: 1 },
  lines: { gap: spacing.sm },
});
