import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, type ReactNode } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text, VenuePhoto } from "../../components";
import type { Bucket, Category } from "../../lib/api";
import { categoryHue, formatScore } from "../../lib/format";
import { colors, fontWeight, palette, radius, ratingColor, ratingColors, scrim as scrims } from "../../theme";

/** The browser has no native animation thread. */
const NATIVE = Platform.OS !== "web";

/** A text box draws no focus ring of its own in a browser: the caret is enough. */
export const noFocusRing = Platform.select({ web: { outlineStyle: "none" } as object, default: {} });

/** Text sizes the rank flow uses on top of the shared variants. */
export const type = StyleSheet.create({
  /** The question each step asks: "How was it?", "Which do you prefer?". */
  question: { fontSize: 26, lineHeight: 32, fontWeight: "800", letterSpacing: -0.5, color: colors.fg },
  /** A name sitting on a photo. */
  onPhoto: { fontSize: 22, lineHeight: 27, fontWeight: fontWeight.bold, letterSpacing: -0.3, color: palette.onPhoto },
  onPhotoNote: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.medium, color: palette.onPhotoMuted },
  /** A place's name under its photo or at the head of a row. */
  strong: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: colors.fg },
  meta: { fontSize: 14, lineHeight: 19, color: colors.muted },
});

/**
 * A place's photo, cropped to fill. Without a photo (or when it fails to load) it is the shared
 * `VenuePhoto` in the category's colour. `scrim` darkens the bottom so text can sit on it;
 * children are drawn on top.
 */
export function PlacePhoto({
  uri,
  category,
  height,
  width = "100%",
  round = radius.xxl,
  scrim = false,
  children,
  style,
}: {
  uri?: string | null;
  category: Category;
  height: number;
  width?: DimensionValue;
  round?: number;
  scrim?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  // The address that failed, so a new address gets its own try.
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = !!uri && failed !== uri;
  return (
    <View style={[styles.photo, { height, width, borderRadius: round }, style]}>
      {showImage ? (
        <Image
          key={uri}
          source={{ uri }}
          resizeMode="cover"
          onError={() => setFailed(uri)}
          style={styles.fillImage}
        />
      ) : (
        <VenuePhoto hue={categoryHue(category)} height={height} style={styles.square} />
      )}
      {scrim ? (
        <LinearGradient
          colors={[...scrims.bottom.colors]}
          locations={[...scrims.bottom.locations]}
          style={styles.scrim}
        />
      ) : null}
      {children}
    </View>
  );
}

/**
 * A `Pressable` that sinks a little under the thumb. `style` lays it out; `pressedStyle` is added
 * to the inside while it is held.
 */
export function PressScale({
  children,
  style,
  contentStyle,
  pressedStyle,
  to = 0.97,
  ...props
}: Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  /** How small it gets while held. */
  to?: number;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const [held, setHeld] = useState(false);
  const move = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: NATIVE, speed: 36, bounciness: 7 }).start();
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      onPressIn={(event) => {
        setHeld(true);
        move(to);
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setHeld(false);
        move(1);
        props.onPressOut?.(event);
      }}
      style={style}
    >
      <Animated.View style={[contentStyle, held && pressedStyle, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Children fade and rise into place once, when this mounts. Give it a `key` to replay. */
export function Rise({
  children,
  delay = 0,
  from = 10,
  style,
}: {
  children: ReactNode;
  delay?: number;
  from?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: 260, delay, useNativeDriver: NATIVE });
    animation.start();
    return () => animation.stop();
  }, [progress, delay]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Children pop in with a small overshoot. For the score on the result step. */
export function Pop({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [scale] = useState(() => new Animated.Value(0.6));
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: NATIVE, speed: 9, bounciness: 14 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: NATIVE }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [scale, opacity]);
  return <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>{children}</Animated.View>;
}

/** "2 of 4" as one thin line that fills from the left. */
export function Steps({ current, total }: { current: number; total: number }) {
  const filled = Math.min(1, Math.max(0, total > 0 ? current / total : 0));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`${current} of ${total}`} style={styles.steps}>
      <View style={[styles.stepFill, { width: `${Math.round(filled * 100)}%` }]} />
    </View>
  );
}

/**
 * The three answers to "How was it?" and the colour each one is drawn in, the same green, amber
 * and red the score rings use.
 */
export const BUCKET_LOOK: Record<Bucket, { label: string; short: string; color: string }> = {
  loved: { label: "I liked it!", short: "Liked it", color: ratingColors.good },
  fine: { label: "It was fine", short: "It was fine", color: ratingColors.okay },
  didnt: { label: "I didn't like it", short: "Didn't like it", color: ratingColors.bad },
};

/**
 * The result's score: the shared `ScoreBadge` ring (a white disc, a line in the rating colour, the
 * number in the same colour) at the size of a headline, with "out of 10" under it.
 */
export function BigScore({ score, size = 148 }: { score: number; size?: number }) {
  const tint = ratingColor(score);
  const text = formatScore(score);
  return (
    <View accessible accessibilityLabel={`Score ${text} out of 10`} style={styles.bigScore}>
      <View style={[styles.bigRing, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.bigNumber, { fontSize: Math.round(size * 0.4), lineHeight: Math.round(size * 0.48), color: tint }]}>
          {text}
        </Text>
      </View>
      <Text style={styles.outOf}>out of 10</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { overflow: "hidden", backgroundColor: colors.surface },
  fillImage: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  square: { borderRadius: 0 },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none" },
  steps: { height: 4, borderRadius: 2, backgroundColor: colors.raised, overflow: "hidden" },
  stepFill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  bigScore: { alignItems: "center", gap: 10 },
  // The same thin grey ring as every score in the app, at headline size.
  bigRing: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#d6d6dc", backgroundColor: colors.bg },
  bigNumber: { fontWeight: "800", letterSpacing: -1.5, textAlign: "center", fontVariant: ["tabular-nums"] },
  outOf: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.semibold, color: colors.muted },
});
