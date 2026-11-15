/**
 * The list panel on the bottom of the map. Unlike the shared `Sheet` (a modal over the screen) this
 * one is always there: drag it, or tap its handle, to rest it at a peek, at half the screen or at
 * full height. It slides away while a pin's card is showing.
 *
 * The panel is always as tall as its full height and is slid down by a transform, so dragging it
 * never lays the list out again. The screen pads the bottom of the list by what hangs off screen.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Animated, PanResponder, Platform, Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../../theme";

export type SheetSnap = "peek" | "mid" | "full";
export type SheetHeights = Record<SheetSnap, number>;

const ORDER: SheetSnap[] = ["peek", "mid", "full"];
const TAP_NEXT: Record<SheetSnap, SheetSnap> = { peek: "mid", mid: "full", full: "mid" };
const TAP_LABEL: Record<SheetSnap, string> = { peek: "Expand list", mid: "Expand list", full: "Shrink list" };

// A transform can run on the native thread; the browser has no such thread.
const NATIVE = Platform.OS !== "web";
const SPRING = { useNativeDriver: NATIVE, bounciness: 3, speed: 14 } as const;

function nearestSnap(height: number, heights: SheetHeights): SheetSnap {
  let best: SheetSnap = "mid";
  for (const snap of ORDER) {
    if (Math.abs(heights[snap] - height) < Math.abs(heights[best] - height)) best = snap;
  }
  return best;
}

export function MapSheet({
  snap,
  onSnap,
  heights,
  hidden = false,
  above,
  aboveHeight,
  listOffset,
  header,
  children,
}: {
  snap: SheetSnap;
  onSnap: (snap: SheetSnap) => void;
  heights: SheetHeights;
  /** Slide the whole panel off the bottom (a pin's card has its place). */
  hidden?: boolean;
  /** What floats on the map just above the panel and rides with it (the credit, "Recenter"). */
  above?: ReactNode;
  aboveHeight: number;
  /** How far the list inside is scrolled, kept up to date by the screen. */
  listOffset?: { current: number };
  /** The title row under the handle. */
  header: ReactNode;
  children: ReactNode;
}) {
  const { peek, mid, full } = heights;
  /** How far the panel is slid down from full height. */
  const rest = hidden ? full + aboveHeight : full - heights[snap];
  const [offset] = useState(() => new Animated.Value(rest));

  // Follow the snap (a tap on the handle, the end of a drag, a rotation that changes the heights).
  useEffect(() => {
    const animation = Animated.spring(offset, { toValue: rest, ...SPRING });
    animation.start();
    return () => animation.stop();
  }, [offset, rest]);

  const responders = useMemo(() => {
    const snaps: SheetHeights = { peek, mid, full };
    // Where the panel stood when the finger came down.
    let from = full - mid;
    const settle = (landed: number) => {
      const next = nearestSnap(full - landed, snaps);
      Animated.spring(offset, { toValue: full - snaps[next], ...SPRING }).start();
      return next;
    };
    const vertical = (dx: number, dy: number) => Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx) * 1.2;
    const drag = {
      onPanResponderGrant: () => {
        offset.stopAnimation((value) => {
          from = value;
        });
      },
      onPanResponderMove: (_event: unknown, gesture: { dy: number }) => {
        offset.setValue(Math.min(full - peek, Math.max(0, from + gesture.dy)));
      },
      // A flick carries the panel a little further than where the finger let go.
      onPanResponderRelease: (_event: unknown, gesture: { dy: number; vy: number }) =>
        onSnap(settle(from + gesture.dy + gesture.vy * 140)),
      onPanResponderTerminate: (_event: unknown, gesture: { dy: number }) => onSnap(settle(from + gesture.dy)),
    };
    return {
      // The handle and title: a tap belongs to the handle button; a vertical drag moves the panel.
      grab: PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => vertical(gesture.dx, gesture.dy),
        ...drag,
      }),
      // The list: below full height a vertical drag on it moves the panel too. At full height the
      // list scrolls, and only a pull down from its very top brings the panel down.
      body: PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          vertical(gesture.dx, gesture.dy) && (snap !== "full" || (gesture.dy > 0 && (listOffset?.current ?? 0) <= 0)),
        ...drag,
      }),
    };
  }, [offset, peek, mid, full, onSnap, snap, listOffset]);

  // The floating row fades out as the panel covers the last of the map.
  const aboveOpacity = offset.interpolate({ inputRange: [0, 48], outputRange: [0, 1], extrapolate: "clamp" });

  return (
    <Animated.View
      style={[styles.root, { height: full + aboveHeight, transform: [{ translateY: offset }] }]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[styles.above, { height: aboveHeight, opacity: aboveOpacity }]}
        pointerEvents={snap === "full" || hidden ? "none" : "box-none"}
      >
        {above}
      </Animated.View>
      <View style={styles.sheet}>
        <View {...responders.grab.panHandlers} style={styles.grab}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={TAP_LABEL[snap]}
            hitSlop={{ top: 10, bottom: 10, left: 40, right: 40 }}
            onPress={() => onSnap(TAP_NEXT[snap])}
            style={styles.handleButton}
          >
            <View style={styles.handle} />
          </Pressable>
          {header}
        </View>
        <View {...responders.body.panHandlers} style={styles.body}>
          {children}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", left: 0, right: 0, bottom: 0 },
  above: { justifyContent: "flex-end" },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xxl + 4,
    borderTopRightRadius: radius.xxl + 4,
    overflow: "hidden",
    shadowColor: colors.black,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  grab: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    ...Platform.select({ web: { cursor: "grab", userSelect: "none" } as object, default: {} }),
  },
  handleButton: { alignSelf: "center", width: 80, height: 20, alignItems: "center", justifyContent: "center" },
  handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: colors.line },
  body: { flex: 1 },
});
