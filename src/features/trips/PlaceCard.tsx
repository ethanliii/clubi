import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ScoreBadge, Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { categoryLabel, formatDistance, formatEventTime, formatPrice, formatScore } from "../../lib/format";
import { venuePath } from "../../lib/links";
import { colors, fontWeight, radius, spacing } from "../../theme";
import { PlacePhoto } from "./PlacePhoto";

/** "Cafe · $$ · 350 m" from what the backend sent. */
function metaLine(item: NearbyItem): string {
  return [categoryLabel(item.category, item.subcategory), formatPrice(item.priceLevel), formatDistance(item.distanceMeters)]
    .filter((part) => part !== "")
    .join(" · ");
}

/**
 * One place or event as a photo card: the picture first, with the score on it (for a group, the
 * group's score), then its name, what it is and the backend's reason. Tapping it opens the venue.
 * A place with no photo gets a shorter band of the category picture, so real photos lead the page.
 */
export function PlaceCard({
  item,
  now,
  photoHeight = 196,
  showRank = false,
  aside,
  children,
}: {
  item: NearbyItem;
  now: number;
  photoHeight?: number;
  /** The backend's rank on the photo's corner. */
  showRank?: boolean;
  /**
   * Sits to the right of the name, under the photo (the two thumbs). It is drawn over the card,
   * not inside it: the card is one big button, and a button inside a button does not work on the web.
   */
  aside?: ReactNode;
  /** Under the card and not part of the button: each person's score. */
  children?: ReactNode;
}) {
  const when = item.startsAt !== undefined ? formatEventTime(item.startsAt, now) : null;
  const performers = item.performers && item.performers.length > 0 ? item.performers.join(", ") : null;
  const height = item.imageUrl ? photoHeight : Math.round(photoHeight * 0.5);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${formatScore(item.score)}. ${item.why}`}
        onPress={() => router.push(venuePath(item.kind, item.id))}
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}
      >
        <View>
          <PlacePhoto uri={item.imageUrl} category={item.category} height={height} />
          {when ? (
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.78)"]}
              style={styles.scrim}
            />
          ) : null}
          {showRank ? (
            <View style={styles.rank}>
              <Text style={styles.rankText}>{item.rank}</Text>
            </View>
          ) : null}
          <View style={styles.score}>
            <ScoreBadge score={item.score} />
          </View>
          {when ? (
            <Text numberOfLines={1} style={styles.when}>
              {when}
            </Text>
          ) : null}
        </View>
        <View style={[styles.text, aside ? styles.textBesideAside : null]}>
          <Text numberOfLines={2} style={styles.name}>
            {item.name}
          </Text>
          <Text muted numberOfLines={1}>
            {performers ? `${performers} · ${metaLine(item)}` : metaLine(item)}
          </Text>
          <Text numberOfLines={2} style={styles.why}>
            {item.why}
          </Text>
        </View>
      </Pressable>
      {aside ? <View style={[styles.aside, { top: height + spacing.sm + 2 }]}>{aside}</View> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm + 2 },
  open: { gap: spacing.sm + 2 },
  pressed: { opacity: 0.8 },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 84, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  rank: {
    position: "absolute",
    top: 10,
    left: 10,
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: "rgba(11,10,15,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { color: colors.white, fontSize: 13, lineHeight: 17, fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
  score: { position: "absolute", top: 10, right: 10 },
  when: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
    color: colors.white,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: fontWeight.semibold,
  },
  text: { gap: 3 },
  // Two 44pt thumbs and the gap between them, plus air.
  textBesideAside: { paddingRight: 108, minHeight: 44 },
  aside: { position: "absolute", right: 0 },
  name: { fontSize: 18, lineHeight: 23, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  why: { color: colors.fg, opacity: 0.9 },
});
