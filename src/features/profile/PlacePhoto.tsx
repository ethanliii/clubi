import { LinearGradient } from "expo-linear-gradient";
import { useState, type ReactNode } from "react";
import { Image, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { VenuePhoto } from "../../components";
import type { Category } from "../../lib/api";
import { categoryHue } from "../../lib/format";
import { colors } from "../../theme";

/**
 * A place's photo at a fixed size: the backend's `imageUrl` when there is one, over the shared
 * category look (which also shows while the photo loads, or when it fails).
 * `scrim` darkens the bottom so `children` (a name, a score) stay readable on any photo.
 */
export function PlacePhoto({
  uri,
  category,
  width = "100%",
  height,
  round = 12,
  scrim = false,
  style,
  children,
}: {
  uri?: string | null;
  category: Category;
  width?: DimensionValue;
  height: number;
  round?: number;
  scrim?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const shown = uri && failedUri !== uri ? uri : null;
  return (
    <View style={[styles.frame, { width, height, borderRadius: round }, style]}>
      <VenuePhoto hue={categoryHue(category)} height={height} style={styles.fallback} />
      {shown ? (
        <Image
          source={{ uri: shown }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          onError={() => setFailedUri(shown)}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {scrim ? (
        <LinearGradient
          colors={["rgba(8,6,12,0)", "rgba(8,6,12,0.55)", "rgba(8,6,12,0.94)"]}
          locations={[0.25, 0.58, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: colors.surface },
  fallback: { position: "absolute", top: 0, left: 0, right: 0, borderRadius: 0 },
});
