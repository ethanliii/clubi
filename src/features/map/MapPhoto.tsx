/**
 * The picture of a place or event on the map screen: the backend's photo when there is one,
 * otherwise the shared category look. Never a grey box.
 */
import { useState } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { VenuePhoto } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { categoryHue } from "../../lib/format";
import { colors } from "../../theme";

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
  return (
    <View style={[styles.frame, { width: width ?? "100%", height, borderRadius: round }, style]}>
      {uri && failed !== uri ? (
        <Image source={{ uri }} resizeMode="cover" onError={() => setFailed(uri)} style={StyleSheet.absoluteFill} />
      ) : (
        <VenuePhoto hue={categoryHue(item.category)} height={height} style={styles.fallback} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: colors.surface },
  fallback: { borderRadius: 0 },
});
