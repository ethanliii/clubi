import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { Category } from "../../convex/lib/contract";
import { radius } from "../theme";
import { Photo } from "./Photo";
import { categoryForHue, placeholderPhoto } from "../constants/placeholderPhotos";

/**
 * A real photo when there is one (`uri`, from main's Google Places photos), otherwise Bryan's
 * glowing gradient placeholder. Extra props are main's and optional.
 */
export function VenuePhoto({ hue, height, style, uri, category, scrim, children, seed, glowOnly }: {
  hue: number; height: number; style?: StyleProp<ViewStyle>;
  uri?: string | null; category?: Category; scrim?: boolean | "bottom" | "hero" | "top"; children?: ReactNode;
  /** Picks which stand-in photo (e.g. the place id). */
  seed?: string | number;
  /** Only the glow (no stand-in photo), e.g. under a real photo or for album covers. */
  glowOnly?: boolean;
}) {
  if (!uri && !glowOnly) {
    const stand = placeholderPhoto(category ?? categoryForHue(hue), seed ?? height);
    if (stand) {
      return (
        <View style={[styles.photo, { height }, style]}>
          <VenuePhoto hue={hue} height={height} glowOnly style={StyleSheet.absoluteFill} />
          <Image source={{ uri: stand }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {children}
        </View>
      );
    }
  }
  if (uri) {
    return (
      <Photo uri={uri} category={category} hue={hue} height={height} round={radius.xl} scrim={scrim} style={style}>
        {children}
      </Photo>
    );
  }
  const glows = [0, 1, 2].map((k) => ({
    left: `${15 + k * 28}%` as const,
    top: `${10 + ((k * 37) % 40)}%` as const,
    size: height * (0.35 - k * 0.05),
    color: `hsla(${(hue + k * 30) % 360}, 90%, ${60 + k * 5}%, 0.55)`,
  }));
  return (
    <View style={[styles.photo, { height }, style]}>
      <LinearGradient
        colors={[`hsl(${hue}, 45%, 17%)`, `hsl(${(hue + 30) % 360}, 35%, 9%)`, "#07060a"]}
        locations={[0, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      {glows.map((glow) => (
        <View
          key={glow.left}
          style={[
            styles.glow,
            {
              left: glow.left,
              top: glow.top,
              width: glow.size,
              height: glow.size,
              borderRadius: glow.size / 2,
              backgroundColor: glow.color,
              shadowColor: glow.color,
            },
          ]}
        />
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { borderRadius: radius.xl, overflow: "hidden", width: "100%" },
  glow: { position: "absolute", opacity: 0.8, shadowOpacity: 1, shadowRadius: 24 },
});
