import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { formatEventTime, formatScore } from "../../lib/format";
import { venuePath } from "../../lib/links";
import { fontWeight } from "../../theme";
import { cardLabel } from "./itemText";
import { Photo } from "./Photo";

/** Every card in a Home carousel is this size: tall, the photo filling it. */
export const CARD_WIDTH = 158;
export const CARD_HEIGHT = 180;
export const CARD_ROUND = 10;
/** The slim card of the one carousel above the feed. */
export const COMPACT_CARD_WIDTH = 136;
export const COMPACT_CARD_HEIGHT = 124;

const FADE = ["rgba(0,0,0,0)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.9)"] as const;
const FADE_STOPS = [0, 0.45, 1] as const;

/**
 * One place or event in a carousel: the photo fills the card, a dark fade at the bottom, the name
 * in bold white over it (two lines) and one small white line: the score for you and the reason
 * (an event leads with when it starts).
 */
export function PhotoCard({ item, now, compact = false }: { item: NearbyItem; now: number; compact?: boolean }) {
  const lead = item.startsAt !== undefined ? formatEventTime(item.startsAt, now) : "";
  const sub = [formatScore(item.score), lead, item.why].filter((part) => part !== "").join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cardLabel(item)}
      onPress={() => router.push(venuePath(item.kind, item.id))}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Photo
        item={item}
        width={compact ? COMPACT_CARD_WIDTH : CARD_WIDTH}
        height={compact ? COMPACT_CARD_HEIGHT : CARD_HEIGHT}
        round={CARD_ROUND}
        dark
      >
        <LinearGradient colors={FADE} locations={FADE_STOPS} style={styles.fade} pointerEvents="none" />
        <View style={styles.copy} pointerEvents="none">
          <Text numberOfLines={compact ? 1 : 2} style={styles.name}>
            {item.name}
          </Text>
          <Text numberOfLines={1} style={styles.sub}>
            {sub}
          </Text>
        </View>
      </Photo>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "72%" },
  copy: { position: "absolute", left: 10, right: 10, bottom: 10, gap: 3 },
  name: { fontSize: 16, lineHeight: 19, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: "#ffffff" },
  sub: { fontSize: 12, lineHeight: 15, color: "rgba(255,255,255,0.92)" },
});
