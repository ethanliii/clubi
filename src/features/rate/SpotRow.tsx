import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Skeleton, Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { categoryLabel, formatDistance, formatEventTime } from "../../lib/format";
import { colors, radius, spacing } from "../../theme";
import { PlacePhoto, type } from "./ui";

const PHOTO = 60;

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
      <PlacePhoto uri={item.imageUrl} category={item.category} height={PHOTO} width={PHOTO} round={radius.lg} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={type.strong}>
          {item.name}
        </Text>
        <Text numberOfLines={1} style={type.meta}>
          {metaLine(item)}
        </Text>
      </View>
      <Icon name="chevron" size={16} color={colors.low} />
    </Pressable>
  );
}

/** The list while it loads, in the shape of the rows. */
export function SpotRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading">
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton width={PHOTO} height={PHOTO} round={radius.lg} />
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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md + 2, minHeight: PHOTO + spacing.md * 2 - 4 },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: 3 },
  lines: { gap: spacing.sm },
});
