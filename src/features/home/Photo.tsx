import { useState } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Icon, VenuePhoto, type IconName } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { categoryHue } from "../../lib/format";
import { colors } from "../../theme";

/**
 * The picture for a place or event at a known size: the backend's `imageUrl`, or the shared
 * category look when there is none or it fails to load. Children are drawn on top of it.
 */
export function Photo({
  item,
  width,
  height,
  round,
  dark = false,
  style,
  children,
}: {
  item: Pick<NearbyItem, "imageUrl" | "category">;
  width: number;
  height: number;
  round: number;
  /** White text sits on this picture: with no picture, draw a deep tint of the category's colour, never a pale tile. */
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = item.imageUrl && failedUrl !== item.imageUrl ? item.imageUrl : null;
  return (
    <View style={[styles.frame, { width, height, borderRadius: round }, style]}>
      {url ? (
        <Image
          source={{ uri: url }}
          resizeMode="cover"
          onError={() => setFailedUrl(url)}
          style={{ width, height }}
        />
      ) : dark ? (
        <View style={[styles.deep, { width, height, backgroundColor: `hsl(${DEEP_HUE[item.category] ?? categoryHue(item.category)}, 30%, 28%)` }]}>
          <Icon name={GLYPH[item.category] ?? "spark"} size={30} color="rgba(255,255,255,0.55)" />
        </View>
      ) : (
        <VenuePhoto hue={categoryHue(item.category)} height={height} style={styles.fallback} />
      )}
      {children}
    </View>
  );
}

/** The tints the shared photo fallback draws, so the warm categories read as rose and clay, not olive. */
const DEEP_HUE: Partial<Record<NearbyItem["category"], number>> = { nightlife: 318, food: 12, culture: 262, outdoors: 158, live: 212, popup: 348 };

/** The line glyph for a category, the same ones the shared photo fallback uses. */
const GLYPH: Partial<Record<NearbyItem["category"], IconName>> = {
  nightlife: "cocktail",
  food: "utensils",
  culture: "landmark",
  outdoors: "tree",
  live: "music",
  popup: "spark",
};

const styles = StyleSheet.create({
  // The glyph sits in the upper part, clear of the title along the bottom.
  deep: { alignItems: "center", paddingTop: 34 },
  frame: { overflow: "hidden", backgroundColor: colors.surface },
  fallback: { borderRadius: 0 },
});
