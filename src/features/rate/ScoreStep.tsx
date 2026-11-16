import { useState } from "react";
import { Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";
import { Icon, Text } from "../../components";
import type { VenueDetail } from "../../lib/api";
import { colors, fontWeight, palette, ratingColor } from "../../theme";
import { BusyButton, FlowScreen } from "./FlowScreen";
import { type } from "./ui";

/** A user's first rankings in a category are scored directly; from this many on they are compared (convex/lib/social.ts). */
export const DIRECT_SCORE_RANKINGS = 5;
const MIN = 1;
const MAX = 10;
const KNOB = 30;
const round1 = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number) => Math.min(MAX, Math.max(MIN, round1(value)));
/** The same cut-offs the backend uses to file a score under Loved it, It was fine or Didn't like it. */
const wordFor = (score: number) => (score >= 6.7 ? "Loved it" : score >= 3.4 ? "It was fine" : "Didn't like it");

/**
 * "How was it?" while there is too little to compare against: one score from 1.0 to 10.0, to one
 * decimal. Drag the bar (or tap it) for the rough number, and the minus and plus move it by 0.1.
 */
export function ScoreStep({
  venue,
  initial,
  left,
  onDone,
  onBack,
}: {
  venue: VenueDetail;
  initial: number | null;
  /** How many more rankings until the app starts asking "which was better?" instead. */
  left: number;
  onDone: (score: number) => void;
  onBack: () => void;
}) {
  const [score, setScore] = useState(initial ?? 7.5);
  const [width, setWidth] = useState(0);
  // The bar answers a tap and a drag alike. `locationX` is measured inside the bar because nothing in it takes touches.
  const fromTouch = (event: GestureResponderEvent) => {
    if (width > 0) setScore(clamp(MIN + (event.nativeEvent.locationX / width) * (MAX - MIN)));
  };
  const tint = ratingColor(score);
  const share = (score - MIN) / (MAX - MIN);
  return (
    <FlowScreen
      title="Rank it"
      heading="How was it?"
      sub={venue.name}
      center
      onBack={onBack}
      footer={<BusyButton busy={false} title="Continue" accessibilityLabel="Continue" onPress={() => onDone(score)} />}
    >
      <View style={styles.body}>
        <View accessible accessibilityLabel={`Score ${score.toFixed(1)} out of 10`} style={styles.readout}>
          <Text style={[styles.number, { color: tint }]}>{score.toFixed(1)}</Text>
          <Text style={[styles.word, { color: tint }]}>{wordFor(score)}</Text>
        </View>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel="Lower by 0.1" hitSlop={8} onPress={() => setScore((now) => clamp(now - 0.1))} style={styles.step}>
            <Icon name="minus" size={20} color={colors.fg} />
          </Pressable>
          <View
            accessibilityRole="adjustable"
            accessibilityLabel="Score"
            accessibilityValue={{ min: MIN, max: MAX, now: score }}
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={fromTouch}
            onResponderMove={fromTouch}
            onResponderTerminationRequest={() => false}
            style={styles.bar}
          >
            <View pointerEvents="none" style={styles.track}>
              <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: tint }]} />
            </View>
            <View pointerEvents="none" style={[styles.knob, { left: `${share * 100}%`, borderColor: tint }]} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Raise by 0.1" hitSlop={8} onPress={() => setScore((now) => clamp(now + 0.1))} style={styles.step}>
            <Icon name="plus" size={20} color={colors.fg} />
          </Pressable>
        </View>
        <View style={styles.ends}>
          <Text style={type.meta}>1</Text>
          <Text style={type.meta}>10</Text>
        </View>
        <Text style={[type.meta, styles.note]}>
          {left > 1
            ? `After ${left} more, new places are ranked by comparing them with the ones you have scored.`
            : "After this one, new places are ranked by comparing them with the ones you have scored."}
        </Text>
      </View>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 18, paddingTop: 12 },
  readout: { alignItems: "center", gap: 2 },
  number: { fontSize: 84, lineHeight: 92, fontWeight: "800", letterSpacing: -3, fontVariant: ["tabular-nums"] },
  word: { fontSize: 17, lineHeight: 22, fontWeight: fontWeight.bold },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  step: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: palette.field },
  bar: { flex: 1, height: 44, justifyContent: "center" },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.raised, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  knob: {
    position: "absolute", width: KNOB, height: KNOB, borderRadius: KNOB / 2, marginLeft: -KNOB / 2,
    backgroundColor: colors.bg, borderWidth: 3,
  },
  ends: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 58 },
  note: { textAlign: "center", marginTop: 6 },
});
