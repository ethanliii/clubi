import { useState } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { VenuePhoto } from "../../components";
import type { Category } from "../../lib/api";
import { categoryHue } from "../../lib/format";
import { colors, radius } from "../../theme";

/**
 * A place's or event's own photo (the backend's `imageUrl`), filling its box. With no photo, or
 * one that fails to load, it is the shared category picture instead, never an empty grey box.
 */
export function PlacePhoto({
  uri,
  category,
  hue,
  height,
  width,
  round = radius.lg,
  style,
}: {
  uri?: string | null;
  /** Picks the fallback's colour. */
  category?: Category;
  /** Or name the fallback colour directly (artists have no category). */
  hue?: number;
  height: number;
  /** Default: the full width of whatever holds it. */
  width?: number;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const shown = uri && failedUri !== uri ? uri : null;
  return (
    <View style={[styles.box, { height, width: width ?? "100%", borderRadius: round }, style]}>
      {shown ? (
        <Image
          source={{ uri: shown }}
          resizeMode="cover"
          onError={() => setFailedUri(shown)}
          style={styles.fill}
        />
      ) : (
        <VenuePhoto hue={hue ?? (category ? categoryHue(category) : 300)} height={height} style={styles.fallback} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", backgroundColor: colors.surface },
  fill: { width: "100%", height: "100%" },
  fallback: { borderRadius: 0 },
});
