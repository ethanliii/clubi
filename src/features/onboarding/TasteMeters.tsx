import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Text } from "../../components";
import { colors, fontWeight } from "../../theme";

type Meter = { label: string; pct: number };

/**
 * The taste card's meters. Each bar fills to the percent the backend sent while its number counts
 * up, one after the other: slim accent bars on a grey track. `highlight` is the label of the strongest
 * meter, whose number is drawn in the accent too.
 * Nothing is computed here.
 */
export function TasteMeters({
  meters,
  highlight,
  startDelay = 0,
}: {
  meters: readonly Meter[];
  highlight?: string | null;
  /** Wait this long before the first bar moves, so the headline lands first. */
  startDelay?: number;
}) {
  return (
    <View style={styles.list}>
      {meters.map((meter, index) => (
        <TasteMeter
          key={meter.label}
          label={meter.label}
          pct={meter.pct}
          strong={meter.label === highlight}
          delay={startDelay + index * 160}
        />
      ))}
    </View>
  );
}

function TasteMeter({ label, pct, strong, delay }: Meter & { strong: boolean; delay: number }) {
  const [fill] = useState(() => new Animated.Value(0));
  const [appear] = useState(() => new Animated.Value(0));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const counter = fill.addListener(({ value }) => setShown(Math.round(value)));
    const animation = Animated.parallel([
      // Opacity could run natively, but it shares a view tree with the width, which cannot.
      Animated.timing(appear, { toValue: 1, duration: 300, delay, useNativeDriver: false }),
      Animated.timing(fill, {
        toValue: pct,
        duration: 900,
        delay: delay + 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);
    animation.start();
    return () => {
      animation.stop();
      fill.removeListener(counter);
    };
  }, [fill, appear, pct, delay]);

  const width = fill.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"], extrapolate: "clamp" });

  return (
    <Animated.View accessible accessibilityLabel={`${label} ${pct}%`} style={[styles.meter, { opacity: appear }]}>
      <View style={styles.labels}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, strong && styles.valueStrong]}>{shown}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 18 },
  meter: { gap: 8 },
  labels: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
  label: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.semibold, letterSpacing: -0.2, color: colors.fg },
  value: { fontSize: 15, lineHeight: 21, fontWeight: fontWeight.semibold, color: colors.muted, fontVariant: ["tabular-nums"] },
  valueStrong: { color: colors.accent },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.raised, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3, backgroundColor: colors.accent },
});
