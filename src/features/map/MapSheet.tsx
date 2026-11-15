/**
 * The list panel that sits on the bottom of the map. Unlike the shared `Sheet` (a modal over the
 * screen) this one is always there: drag its handle, or tap it, to make it small, medium or tall.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Animated, PanResponder, Platform, Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../../theme";

export type SheetSnap = "peek" | "mid" | "full";
export type SheetHeights = Record<SheetSnap, number>;

const ORDER: SheetSnap[] = ["peek", "mid", "full"];
const TAP_NEXT: Record<SheetSnap, SheetSnap> = { peek: "mid", mid: "full", full: "mid" };
const TAP_LABEL: Record<SheetSnap, string> = { peek: "Expand list", mid: "Expand list", full: "Shrink list" };

const SPRING = { useNativeDriver: false, bounciness: 2, speed: 16 } as const;

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
  header,
  children,
}: {
  snap: SheetSnap;
  onSnap: (snap: SheetSnap) => void;
  heights: SheetHeights;
  /** The title row under the handle. It can be dragged too. */
  header: ReactNode;
  children: ReactNode;
}) {
  const [height] = useState(() => new Animated.Value(heights[snap]));

  // Follow the snap (a tap on the handle, the end of a drag, a rotation that changes the heights).
  const target = heights[snap];
  useEffect(() => {
    const animation = Animated.spring(height, { toValue: target, ...SPRING });
    animation.start();
    return () => animation.stop();
  }, [height, target]);

  const { peek, mid, full } = heights;
  const responder = useMemo(() => {
    const snaps: SheetHeights = { peek, mid, full };
    // Where the sheet stood when the finger came down.
    let from = mid;
    const settle = (landed: number) => {
      const next = nearestSnap(landed, snaps);
      Animated.spring(height, { toValue: snaps[next], ...SPRING }).start();
      return next;
    };
    return PanResponder.create({
      // A tap belongs to the handle button; only a vertical drag is taken over.
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        height.stopAnimation((value) => {
          from = value;
        });
      },
      onPanResponderMove: (_event, gesture) => {
        height.setValue(Math.min(full, Math.max(peek, from - gesture.dy)));
      },
      // A flick carries the sheet a little further than where the finger let go.
      onPanResponderRelease: (_event, gesture) => onSnap(settle(from - gesture.dy - gesture.vy * 120)),
      onPanResponderTerminate: (_event, gesture) => onSnap(settle(from - gesture.dy)),
    });
  }, [height, peek, mid, full, onSnap]);

  return (
    <Animated.View style={[styles.sheet, { height }]}>
      <View {...responder.panHandlers} style={styles.grab}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={TAP_LABEL[snap]}
          hitSlop={8}
          onPress={() => onSnap(TAP_NEXT[snap])}
          style={styles.handleButton}
        >
          <View style={styles.handle} />
        </Pressable>
        {header}
      </View>
      <View style={styles.body}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: "100%",
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.line,
    overflow: "hidden",
    shadowColor: colors.black,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  grab: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    ...Platform.select({ web: { cursor: "grab", userSelect: "none" } as object, default: {} }),
  },
  handleButton: { alignSelf: "center", width: 72, height: 22, alignItems: "center", justifyContent: "center" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line },
  body: { flex: 1 },
});
