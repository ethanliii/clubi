import { useState } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { VenuePhoto } from "../../components";
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
  style,
  children,
}: {
  item: Pick<NearbyItem, "imageUrl" | "category">;
  width: number;
  height: number;
  round: number;
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
      ) : (
        <VenuePhoto hue={categoryHue(item.category)} height={height} style={styles.fallback} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: colors.surface },
  fallback: { borderRadius: 0 },
});
