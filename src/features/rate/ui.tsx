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
import { VenuePhoto } from "../../components";
import type { Category } from "../../lib/api";
import { categoryHue } from "../../lib/format";
import { colors, fontWeight, radius } from "../../theme";

/** The browser has no native animation thread. */
const NATIVE = Platform.OS !== "web";

/** A text box draws no focus ring of its own in a browser: the caret is enough. */
export const noFocusRing = Platform.select({ web: { outlineStyle: "none" } as object, default: {} });

/** Text sizes the rank flow uses on top of the shared variants. */
export const type = StyleSheet.create({
  /** The question each step asks: "How was it?", "Which was better?". */
  question: { fontSize: 30, lineHeight: 36, fontWeight: fontWeight.bold, letterSpacing: -0.6, color: colors.fg },
  /** A name sitting on a photo. */
  onPhoto: { fontSize: 22, lineHeight: 27, fontWeight: fontWeight.bold, letterSpacing: -0.3, color: colors.white },
  onPhotoNote: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.medium, color: "rgba(255,255,255,0.82)" },
  strong: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.semibold, color: colors.fg },
  meta: { fontSize: 13, lineHeight: 18, color: colors.muted },
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
          colors={["rgba(8,6,12,0)", "rgba(8,6,12,0.38)", "rgba(8,6,12,0.9)"]}
          locations={[0.2, 0.58, 1]}
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

/** "2 of 4" as a row of short bars: the ones up to `current` are lit. */
export function Steps({ current, total }: { current: number; total: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`${current} of ${total}`} style={styles.steps}>
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.step, index < current && styles.stepOn]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { overflow: "hidden", backgroundColor: colors.surface },
  fillImage: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  square: { borderRadius: 0 },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none" },
  steps: { flexDirection: "row", gap: 5 },
  step: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.line },
  stepOn: { backgroundColor: colors.fg },
});
