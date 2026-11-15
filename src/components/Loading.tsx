import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing } from "../theme";
import { Text } from "./Text";

/** A centered spinner that fills the space it is given. For whole screens and "loading more" rows. */
export function Loading({ label, compact = false }: { label?: string; compact?: boolean }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? "Loading"}
      style={[styles.loading, compact && styles.compact]}
    >
      <ActivityIndicator color={colors.muted} />
      {label ? (
        <Text variant="caption" muted>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/** One grey pulsing block. Build a screen's loading state out of these in the shape of the real thing. */
export function Skeleton({
  width = "100%",
  height = 16,
  round = radius.md,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulse, { toValue: 0.5, duration: 800, useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[styles.block, { width, height, borderRadius: round, opacity: pulse }, style]} />;
}

/** Placeholder list rows (a circle and two lines each) for any list that is still loading. */
export function SkeletonRows({
  count = 5,
  avatar = true,
  shape = "circle",
}: {
  count?: number;
  avatar?: boolean;
  /** `circle` for people (default), `square` for places: the shape of an `ItemCard` row's photo. */
  shape?: "circle" | "square";
}) {
  const square = shape === "square";
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.rows}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.row, { opacity: 1 - index * 0.12 }]}>
          {avatar ? <Skeleton width={square ? 64 : 44} height={square ? 64 : 44} round={square ? radius.lg : 22} /> : null}
          <View style={styles.lines}>
            <Skeleton width={index % 2 === 0 ? "58%" : "44%"} height={14} round={7} />
            <Skeleton width={index % 2 === 0 ? "36%" : "52%"} height={11} round={6} />
          </View>
          <Skeleton width={42} height={28} round={9} />
        </View>
      ))}
    </View>
  );
}

/** Placeholder cards (a picture and two lines each), side by side or stacked. */
export function SkeletonCards({ count = 3, horizontal = true }: { count?: number; horizontal?: boolean }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={horizontal ? styles.cardsRow : styles.rows}
    >
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.card, horizontal ? styles.cardFixed : styles.cardWide]}>
          <Skeleton height={horizontal ? 200 : 220} round={radius.xl - 2} />
          <Skeleton width="70%" height={14} round={7} />
          <Skeleton width="45%" height={11} round={6} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, minHeight: 160, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  compact: { flex: 0, minHeight: 56 },
  block: { backgroundColor: "rgba(255,255,255,0.07)" },
  rows: { gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 64 },
  lines: { flex: 1, gap: spacing.sm },
  cardsRow: { flexDirection: "row", gap: spacing.md, overflow: "hidden" },
  card: { gap: spacing.sm },
  cardFixed: { width: 220 },
  cardWide: { width: "100%" },
});
