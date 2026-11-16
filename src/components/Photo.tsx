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
  food: { hue: 28, tint: 18, icon: "utensils" },
  culture: { hue: 265, tint: 262, icon: "landmark" },
  outdoors: { hue: 150, tint: 158, icon: "tree" },
  live: { hue: 200, tint: 212, icon: "music" },
  popup: { hue: 48, tint: 42, icon: "spark" },
};

function lookFor(category: Category | undefined, hue: number | undefined): { hue: number; icon: IconName | null } {
  if (category && CATEGORY_LOOK[category]) return { hue: CATEGORY_LOOK[category].tint, icon: CATEGORY_LOOK[category].icon };
  if (hue !== undefined) {
    // Callers that only know the hue (it comes from `categoryHue`) still get that category's look.
    const match = Object.values(CATEGORY_LOOK).find((look) => look.hue === hue);
    return match ? { hue: match.tint, icon: match.icon } : { hue, icon: null };
  }
  return { hue: 280, icon: null };
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
  /** Corner radius. Default 14; pass 0 for edge-to-edge. */
  round?: number;
  /** A dark gradient so text on the photo stays readable: along the bottom, a full hero, or the top edge. */
  scrim?: boolean | "bottom" | "hero" | "top";
  /** Drawn over the photo and the scrim: a title, a score, buttons. Fills the photo. */
  children?: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A photo of a place, an event or a post. It fades in when it has loaded, and until then (or when
 * there is none) shows a pale tinted tile with the category's glyph, never a dark block.
 */
export function Photo({
  uri,
  category,
  hue,
  height,
  width = "100%",
  aspectRatio,
  round = radius.lg,
  scrim = false,
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
  const glyph = Math.round(Math.min(36, Math.max(20, size * 0.3)));

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      onLayout={height === undefined ? (event) => setMeasured(event.nativeEvent.layout.height) : undefined}
      style={[styles.photo, { width, borderRadius: round }, height !== undefined && { height }, aspectRatio ? { aspectRatio } : null, style]}
    >
      <LinearGradient
        // A pale wash of the category's colour: it sits on a white page the way a photo placeholder does.
        colors={[`hsl(${look.hue}, 60%, 96%)`, `hsl(${look.hue}, 56%, 93%)`, `hsl(${look.hue}, 52%, 89%)`]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {!imageUri && look.icon ? (
        <View style={styles.glyph}>
          <Icon name={look.icon} size={glyph} color={`hsla(${look.hue}, 45%, 56%, 0.75)`} />
        </View>
      ) : null}
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

const styles = StyleSheet.create({
  photo: { overflow: "hidden", backgroundColor: colors.surface },
  image: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  glyph: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
});
