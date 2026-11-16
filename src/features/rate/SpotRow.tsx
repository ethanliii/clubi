import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Skeleton, Text } from "../../components";
import { api, type NearbyItem } from "../../lib/api";
import { useMutationToast } from "../../lib/useMutationToast";
import { categoryLabel, formatDistance, formatEventTime } from "../../lib/format";
import { colors, palette, spacing } from "../../theme";
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

/**
 * One place or event to rank: its photo, its name, what and how far it is. Tap the row to rank it;
 * the bookmark on the right saves it to Want to go instead (`saves.toggle` "want").
 */
export function SpotRow({ item, onPress }: { item: NearbyItem; onPress: () => void }) {
  const { run: toggleSave, pending } = useMutationToast(api.saves.toggle);
  const [saved, setSaved] = useState(item.saved ?? false);
  const save = async () => {
    const result = await toggleSave({ kind: item.kind, id: item.id, type: "want" });
    if (result !== undefined) setSaved(result.saved);
  };
  return (
    <View style={styles.wrap}>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? `Saved ${item.name} to Want to go` : `Save ${item.name} to Want to go`}
      accessibilityState={{ selected: saved, disabled: pending }}
      disabled={pending}
      hitSlop={8}
      onPress={() => void save()}
      style={({ pressed }) => [styles.save, saved && styles.saveOn, pressed && styles.pressed]}
    >
      <Icon name={saved ? "bookmarkFilled" : "bookmark"} size={18} color={saved ? colors.bg : colors.fg} />
    </Pressable>
    </View>
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
  wrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  row: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: PHOTO + spacing.md * 2 - 4 },
  save: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: palette.field },
  saveOn: { backgroundColor: colors.fg },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: 1 },
  lines: { gap: spacing.sm },
});
