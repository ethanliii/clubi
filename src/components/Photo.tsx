import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, type ReactNode } from "react";
import { Animated, Platform, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import type { Category } from "../../convex/lib/contract";
import { colors, motion, radius, scrim as scrims } from "../theme";
import { Icon, type IconName } from "./Icon";

/** What a place looks like before (or without) its photo: a hue and a quiet glyph per category. */
// `hue` is what `categoryHue` returns for the category; `tint` is what is drawn. They differ for the
// warm categories, so a pale yellow or orange reads as peach or butter and not as tan.
const CATEGORY_LOOK: Record<Category, { hue: number; tint: number; icon: IconName }> = {
  nightlife: { hue: 320, tint: 318, icon: "cocktail" },
  food: { hue: 28, tint: 12, icon: "utensils" },
  culture: { hue: 265, tint: 262, icon: "landmark" },
  outdoors: { hue: 150, tint: 158, icon: "tree" },
  live: { hue: 200, tint: 212, icon: "music" },
  popup: { hue: 48, tint: 348, icon: "spark" },
};

function lookFor(category: Category | undefined, hue: number | undefined): { hue: number; icon: IconName } {
  if (category && CATEGORY_LOOK[category]) return { hue: CATEGORY_LOOK[category].tint, icon: CATEGORY_LOOK[category].icon };
  if (hue !== undefined) {
    // Callers that only know the hue (it comes from `categoryHue`) still get that category's look.
    const match = Object.values(CATEGORY_LOOK).find((look) => look.hue === hue);
    return match ? { hue: match.tint, icon: match.icon } : { hue, icon: "camera" };
  }
  return { hue: 280, icon: "camera" };
}

export type PhotoProps = {
  /** The picture. Missing, null or broken: the category look is drawn instead. */
  uri?: string | null;
  /** Picks the fallback's tint and glyph. */
  category?: Category;
  /** A tint for the fallback when there is no category (a trip, a list). */
  hue?: number;
  /** Fixed height. Leave out and pass `aspectRatio`, or size it with `style`. */
  height?: number;
  width?: DimensionValue;
  /** Width divided by height, e.g. 4 / 5 for a tall card, 16 / 9 for a banner. */
  aspectRatio?: number;
  /** Corner radius. Default 10; pass 0 for edge-to-edge. */
  round?: number;
  /** A dark gradient so text on the photo stays readable: along the bottom, a full hero, or the top edge. */
  scrim?: boolean | "bottom" | "hero" | "top";
  /** White text sits on this photo: with no picture, draw a deep tint of the category colour, not the pale tile. Default: on when `scrim` is. */
  deep?: boolean;
  /** Drawn over the photo and the scrim: a title, a score, buttons. Fills the photo. */
  children?: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A photo of a place, an event or a post. It fades in when it has loaded, and until then (or when
 * there is none) shows a soft light-grey tile with a small line glyph, never a dark block. The image
 * always covers the frame (cropped, never stretched).
 */
export function Photo({
  uri,
  category,
  hue,
  height,
  width = "100%",
  aspectRatio,
  round = radius.md,
  scrim = false,
  deep,
  children,
  accessibilityLabel,
  style,
}: PhotoProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const imageUri = uri && failedUri !== uri ? uri : null;
  const look = lookFor(category, hue);
  const [measured, setMeasured] = useState<number | null>(null);
  const size = height ?? measured ?? 120;

  useEffect(() => {
    opacity.setValue(0);
  }, [imageUri, opacity]);

  const reveal = () => {
    Animated.timing(opacity, { toValue: 1, duration: motion.base, useNativeDriver: Platform.OS !== "web" }).start();
  };

  const kind = scrim === true ? "bottom" : scrim;
  const glyph = Math.round(Math.min(26, Math.max(16, size * 0.22)));
  // With no picture under white text, the tile goes deep so the words still read.
  const dark = (deep ?? !!kind) && !imageUri;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      onLayout={height === undefined ? (event) => setMeasured(event.nativeEvent.layout.height) : undefined}
      style={[styles.photo, { width, borderRadius: round }, height !== undefined && { height }, aspectRatio ? { aspectRatio } : null, style]}
    >
      {/* The fallback: a soft light tile with a small line glyph. The photo fades in over it. */}
      <View style={[styles.glyph, dark && { backgroundColor: `hsl(${look.hue}, 30%, 28%)`, justifyContent: "flex-start", paddingTop: Math.round(size * 0.2) }]}>
        <Icon name={look.icon} size={dark ? glyph + 4 : glyph} color={dark ? "rgba(255,255,255,0.55)" : FALLBACK_GLYPH} />
      </View>
      {imageUri ? (
        <Animated.Image
          source={{ uri: imageUri }}
          resizeMode="cover"
          onLoad={reveal}
          onError={() => setFailedUri(imageUri)}
          style={[styles.image, { opacity }]}
        />
      ) : null}
      {kind ? (
        <LinearGradient
          colors={[...scrims[kind].colors] as [string, string, ...string[]]}
          locations={[...scrims[kind].locations] as [number, number, ...number[]]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children ? <View style={StyleSheet.absoluteFill}>{children}</View> : null}
    </View>
  );
}

const FALLBACK_GLYPH = "#b4b4be";

const styles = StyleSheet.create({
  photo: { overflow: "hidden", backgroundColor: colors.surface },
  image: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  glyph: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
});
