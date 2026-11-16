import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../components";
import { venuePath } from "../../lib/links";
import { fontWeight, palette, spacing } from "../../theme";
import { PlacePhoto } from "./PlacePhoto";
import type { RankedRowItem } from "./RankedRow";
import { SectionLabel } from "./SectionLabel";

const COLUMNS = 3;
const GAP = 3;
const MAX_FAVORITES = 9;

/**
 * A profile's favorites as a photo grid: the highest-scored places and events across every list,
 * three to a row, each with its name and score on the photo. A tile opens the venue. Nothing is
 * drawn for someone who has ranked nothing.
 */
export function FavoritesGallery({ lists }: { lists: { items: RankedRowItem[] }[] }) {
  const [width, setWidth] = useState(0);
  const seen = new Set<string>();
  const favorites = lists
    .flatMap((list) => list.items)
    .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
    // Best first; among equals, the ones with a real photo lead.
    .sort((a, b) => b.score - a.score || Number(!!b.imageUrl) - Number(!!a.imageUrl))
    .slice(0, MAX_FAVORITES);
  if (favorites.length === 0) return null;
  const tile = width > 0 ? Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS) : 0;
  return (
    <View style={styles.section}>
      <SectionLabel title="Favorites" />
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.grid}>
        {tile > 0
          ? favorites.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.score.toFixed(1)}`}
                onPress={() => router.push(venuePath(item.kind, item.id))}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <PlacePhoto uri={item.imageUrl} category={item.category} width={tile} height={Math.round(tile * 1.25)} round={6} scrim>
                  <View style={styles.text}>
                    <Text numberOfLines={2} style={styles.name}>
                      {item.name}
                    </Text>
                    <Text style={styles.score}>{item.score.toFixed(1)}</Text>
                  </View>
                </PlacePhoto>
              </Pressable>
            ))
          : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, paddingTop: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  pressed: { opacity: 0.7 },
  text: { position: "absolute", left: 8, right: 8, bottom: 7, gap: 1 },
  name: { fontSize: 12.5, lineHeight: 16, fontWeight: fontWeight.bold, color: palette.onPhoto },
  score: { fontSize: 12, lineHeight: 15, fontWeight: fontWeight.bold, color: palette.onPhotoMuted, fontVariant: ["tabular-nums"] },
});
