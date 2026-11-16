/**
 * The picture of a place or event on the map screen: the backend's photo when there is one.
 * Without one, a small tile is a pale tint of the category's colour with its line icon (it reads
 * as an icon, not as a picture that failed to load); a large one is the shared category look.
 */
import { useState } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Icon, VenuePhoto, type IconName } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { categoryHue } from "../../lib/format";
import { colors } from "../../theme";

/** Below this a tile is an icon tile. */
const SMALL = 80;
const TINT: Record<NearbyItem["category"], { hue: number; icon: IconName }> = {
  nightlife: { hue: 345, icon: "cocktail" },
  food: { hue: 32, icon: "utensils" },
  culture: { hue: 262, icon: "landmark" },
  outdoors: { hue: 150, icon: "tree" },
  live: { hue: 212, icon: "music" },
  popup: { hue: 275, icon: "ticket" },
};

export function MapPhoto({
  item,
  width,
  height,
  round = 0,
  style,
}: {
  item: Pick<NearbyItem, "imageUrl" | "category">;
  /** Leave out to fill the parent's width. */
  width?: number;
  height: number;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  // A photo that fails to load falls back to the category look, per address: a new address gets a new try.
  const [failed, setFailed] = useState<string | null>(null);
  const uri = item.imageUrl;
  const hasPhoto = Boolean(uri) && failed !== uri;
  const tint = TINT[item.category] ?? TINT.nightlife;
  const small = height < SMALL;
  return (
    <View
      style={[
        styles.frame,
        { width: width ?? "100%", height, borderRadius: round },
        !hasPhoto && small && { backgroundColor: `hsl(${tint.hue}, 70%, 95%)` },
        style,
      ]}
    >
      {hasPhoto && uri ? (
        <Image source={{ uri }} resizeMode="cover" onError={() => setFailed(uri)} style={StyleSheet.absoluteFill} />
      ) : small ? (
        <Icon name={tint.icon} size={24} color={`hsl(${tint.hue}, 45%, 46%)`} />
      ) : (
        <VenuePhoto hue={categoryHue(item.category)} height={height} style={styles.fallback} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  fallback: { borderRadius: 0, alignSelf: "stretch" },
});
