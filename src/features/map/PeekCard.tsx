/**
 * The card that comes up when a pin is tapped, as on Google Maps: a white card with the photo on
 * top, then the name, one grey line of detail, the backend's reason and the score. Tapping it opens
 * the place or event; the cross puts the list back.
 */
import { useEffect, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { Icon, Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { formatDistance, formatEventTime, formatScore } from "../../lib/format";
import { colors, fontWeight, palette, spacing } from "../../theme";
import { MapPhoto } from "./MapPhoto";
import { ScoreRing, metaLine } from "./MapRow";

const PHOTO = 148;
const ROUND = 16;
const TEXT = 88;
/** The card's height, for the map to keep the picked pin clear of it. */
export const PEEK_CARD_HEIGHT = PHOTO + TEXT;

export function PeekCard({ item, onOpen, onClose }: { item: NearbyItem; onOpen: () => void; onClose: () => void }) {
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.spring(shown, { toValue: 1, useNativeDriver: Platform.OS !== "web", bounciness: 4, speed: 16 });
    animation.start();
    return () => animation.stop();
  }, [shown]);

  const when = item.startsAt !== undefined ? formatEventTime(item.startsAt) : null;
  return (
    <Animated.View
      style={[
        styles.shadow,
        { opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] },
      ]}
    >
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.name}, ${formatScore(item.score)} for you. ${item.why}`}
          onPress={onOpen}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <MapPhoto item={item} height={PHOTO} />
          <View style={styles.text}>
            <View style={styles.titles}>
              <Text numberOfLines={1} style={styles.name}>
                {item.name}
              </Text>
              <Text numberOfLines={1} style={styles.meta}>
                {when ? <Text style={styles.when}>{when}</Text> : null}
                {when ? ` · ${formatDistance(item.distanceMeters)}` : metaLine(item)}
              </Text>
              <Text numberOfLines={1} style={styles.why}>
                {item.why}
              </Text>
            </View>
            <ScoreRing score={item.score} />
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
        >
          <Icon name="close" size={16} color={colors.fg} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // The shadow sits on an outer box: the card itself clips its photo to the rounded corners.
  shadow: {
    height: PEEK_CARD_HEIGHT,
    borderRadius: ROUND,
    backgroundColor: colors.bg,
    shadowColor: colors.black,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  card: { flex: 1, borderRadius: ROUND, overflow: "hidden", backgroundColor: colors.bg },
  pressed: { opacity: 0.88 },
  text: {
    height: TEXT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg - 2,
  },
  titles: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 17, lineHeight: 22, fontWeight: fontWeight.bold, letterSpacing: -0.3, color: colors.fg },
  meta: { fontSize: 13, lineHeight: 17, color: colors.muted },
  when: { fontSize: 13, lineHeight: 17, color: colors.accent, fontWeight: fontWeight.semibold },
  why: { fontSize: 13, lineHeight: 17, color: colors.muted },
  // A white disc on the photo, as the cross on a Google Maps place card.
  close: {
    position: "absolute",
    top: spacing.sm + 2,
    right: spacing.sm + 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.glass,
    shadowColor: colors.black,
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  closePressed: { backgroundColor: palette.fieldPressed },
});
