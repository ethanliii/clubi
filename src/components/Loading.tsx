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
        Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[styles.block, { width, height, borderRadius: round, opacity: pulse }, style]} />;
}

/** Placeholder list rows (a circle and two lines each) for any list that is still loading. */
export function SkeletonRows({ count = 5, avatar = true }: { count?: number; avatar?: boolean }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.rows}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.row}>
          {avatar ? <Skeleton width={44} height={44} round={22} /> : null}
          <View style={styles.lines}>
            <Skeleton width="62%" height={14} />
            <Skeleton width="38%" height={11} />
          </View>
          <Skeleton width={38} height={24} />
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
          <Skeleton height={horizontal ? 96 : 200} round={radius.xl} />
          <Skeleton width="70%" height={14} />
          <Skeleton width="45%" height={11} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, minHeight: 160, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  compact: { flex: 0, minHeight: 56 },
  block: { backgroundColor: colors.surface },
  rows: { gap: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 56 },
  lines: { flex: 1, gap: spacing.sm },
  cardsRow: { flexDirection: "row", gap: spacing.md, overflow: "hidden" },
  card: { gap: spacing.sm },
  cardFixed: { width: 170 },
  cardWide: { width: "100%" },
});
