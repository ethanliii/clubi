import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { ScoreBadge, Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { venuePath } from "../../lib/links";
import { fontWeight } from "../../theme";
import { cardFacts, cardLabel, displayName } from "./itemText";
import { Photo } from "./Photo";

/** Every card in a Home carousel is this size: tall, the photo filling it. */
export const CARD_WIDTH = 158;
export const CARD_HEIGHT = 180;
export const CARD_ROUND = 12;
/** The wide card of the paged row that leads the For you tab. */
export const LARGE_CARD_WIDTH = 300;
export const LARGE_CARD_HEIGHT = 200;
/** The slim card of the one carousel above the feed. */
export const COMPACT_CARD_WIDTH = 136;
export const COMPACT_CARD_HEIGHT = 124;

// Dark enough that white text stays readable over a flyer's own lettering.
const FADE = ["rgba(0,0,0,0)", "rgba(0,0,0,0.72)", "rgba(0,0,0,0.94)"] as const;
const FADE_STOPS = [0, 0.4, 1] as const;

/**
 * One place or event in a carousel: the photo fills the card, the score for you in a white ring at the
 * top right, a dark fade at the bottom with the name in bold white (two lines) and one small white
 * line of two facts (an event: when it starts; a place: what it is and how far).
 */
export function PhotoCard({ item, now, compact = false, large = false }: { item: NearbyItem; now: number; compact?: boolean; large?: boolean }) {
  const width = large ? LARGE_CARD_WIDTH : compact ? COMPACT_CARD_WIDTH : CARD_WIDTH;
  const height = large ? LARGE_CARD_HEIGHT : compact ? COMPACT_CARD_HEIGHT : CARD_HEIGHT;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cardLabel(item)}
      onPress={() => router.push(venuePath(item.kind, item.id))}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Photo item={item} width={width} height={height} round={CARD_ROUND} dark>
        <LinearGradient colors={FADE} locations={FADE_STOPS} style={[styles.fade, large && styles.fadeLarge]} pointerEvents="none" />
        <ScoreBadge score={item.score} size="sm" style={styles.score} />
        <View style={[styles.copy, large && styles.copyLarge]} pointerEvents="none">
          <Text numberOfLines={2} style={[styles.name, compact && styles.nameCompact, large && styles.nameLarge]}>
            {displayName(item.name)}
          </Text>
          <Text numberOfLines={1} style={[styles.sub, large && styles.subLarge]}>
            {large ? [cardFacts(item, now), item.why].filter((part) => part !== "").join(" · ") : cardFacts(item, now)}
          </Text>
        </View>
      </Photo>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "80%" },
  fadeLarge: { height: "64%" },
  score: { position: "absolute", top: 8, right: 8, backgroundColor: "#ffffff" },
  copy: { position: "absolute", left: 10, right: 10, bottom: 10, gap: 3 },
  copyLarge: { left: 14, right: 14, bottom: 13, gap: 4 },
  name: { fontSize: 16, lineHeight: 19, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: "#ffffff" },
  nameCompact: { fontSize: 14, lineHeight: 17 },
  nameLarge: { fontSize: 20, lineHeight: 24, letterSpacing: -0.3 },
  sub: { fontSize: 12, lineHeight: 15, color: "rgba(255,255,255,0.92)" },
  subLarge: { fontSize: 13, lineHeight: 17 },
});
