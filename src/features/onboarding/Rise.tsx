import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from "react-native";

/** The browser has no native animation driver; everything here is opacity and transform, which phones run natively. */
export const NATIVE_DRIVER = Platform.OS !== "web";

/**
 * Fades its children in while they slide into place, once, when it mounts. `delay` staggers a
 * list; `axis="x"` with a negative `from` slides in from the left (going back a quiz card).
 */
export function Rise({
  delay = 0,
  from = 14,
  axis = "y",
  duration = 380,
  style,
  children,
}: {
  delay?: number;
  from?: number;
  axis?: "x" | "y";
  duration?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, delay, duration]);

  const shift = progress.interpolate({ inputRange: [0, 1], outputRange: [from, 0] });
  return (
    <Animated.View
      style={[style, { opacity: progress, transform: [axis === "x" ? { translateX: shift } : { translateY: shift }] }]}
    >
      {children}
    </Animated.View>
  );
}
