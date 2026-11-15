/**
 * The card that comes up when a pin is tapped: the photo with the name and score on it, and the
 * backend's reason underneath. Tapping it opens the place or event; the cross puts the list back.
 */
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { Icon, ScoreBadge, Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { formatDistance, formatEventTime, formatScore } from "../../lib/format";
import { colors, fontWeight, radius, spacing } from "../../theme";
import { MapPhoto } from "./MapPhoto";
import { metaLine } from "./MapRow";

const PHOTO = 148;
const TEXT = 74;
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
        styles.card,
        { opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.name}, ${formatScore(item.score)} for you. ${item.why}`}
        onPress={onOpen}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View>
          <MapPhoto item={item} height={PHOTO} />
          <LinearGradient
            colors={["rgba(11,10,15,0)", "rgba(11,10,15,0.35)", "rgba(11,10,15,0.9)"]}
            locations={[0.3, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.onPhoto}>
            <View style={styles.titles}>
              <Text numberOfLines={2} style={styles.name}>
                {item.name}
              </Text>
              <Text numberOfLines={1} style={when ? styles.when : styles.meta}>
                {when ? `${when} · ${formatDistance(item.distanceMeters)}` : metaLine(item)}
              </Text>
            </View>
            <ScoreBadge score={item.score} size="lg" />
          </View>
        </View>
        <View style={styles.text}>
          <Text numberOfLines={2} style={styles.why}>
            {item.why}
          </Text>
          <Icon name="chevron" size={18} color={colors.muted} />
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
        onPress={onClose}
        style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
      >
        <Icon name="close" size={16} color={colors.white} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: PEEK_CARD_HEIGHT,
    borderRadius: radius.xxl,
    overflow: "hidden",
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  pressed: { opacity: 0.88 },
  onPhoto: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.md,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
  },
  titles: { flex: 1, gap: 2 },
  name: { fontSize: 21, lineHeight: 25, fontWeight: fontWeight.bold, color: colors.white, letterSpacing: -0.3 },
  meta: { fontSize: 13, lineHeight: 17, color: "rgba(255,255,255,0.78)" },
  when: { fontSize: 13, lineHeight: 17, color: colors.mid, fontWeight: fontWeight.semibold },
  text: {
    height: TEXT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  why: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.fg },
  close: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,10,15,0.6)",
  },
  closePressed: { backgroundColor: "rgba(11,10,15,0.85)" },
});
