import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Text } from "../../components";
import { colors, spacing } from "../../theme";

/**
 * The taste card's meters, drawn in white for the pink card (the shared `Meter` is pink on dark).
 * Each bar fills to the percent the backend sent, one after the other. Nothing is computed here.
 */
export function TasteMeters({ meters }: { meters: readonly { label: string; pct: number }[] }) {
  return (
    <View style={styles.list}>
      {meters.map((meter, index) => (
        <TasteMeter key={meter.label} label={meter.label} pct={meter.pct} delay={150 + index * 140} />
      ))}
    </View>
  );
}

function TasteMeter({ label, pct, delay }: { label: string; pct: number; delay: number }) {
  const [fill] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(fill, {
      toValue: pct,
      duration: 650,
      delay,
      easing: Easing.out(Easing.cubic),
      // Width is a layout property, which the native driver cannot animate.
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [fill, pct, delay]);

  const width = fill.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"], extrapolate: "clamp" });

  return (
    <View accessible accessibilityLabel={`${label} ${pct}%`} style={styles.meter}>
      <View style={styles.labels}>
        <Text variant="caption" style={styles.label}>{label}</Text>
        <Text variant="caption" style={styles.value}>{pct}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  meter: { gap: spacing.xs },
  labels: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  label: { color: colors.white },
  value: { color: colors.white, fontVariant: ["tabular-nums"] },
  track: { height: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.white },
});
