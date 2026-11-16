import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ScoreBadge, Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { categoryLabel, formatDistance, formatEventTime, formatPrice, formatScore } from "../../lib/format";
import { venuePath } from "../../lib/links";
import { colors, fontWeight, palette, radius, scrim, spacing } from "../../theme";
import { PlacePhoto } from "./PlacePhoto";

/** "Cafe · $$ · 350 m" from what the backend sent. */
export function metaLine(item: NearbyItem): string {
  return [categoryLabel(item.category, item.subcategory), formatPrice(item.priceLevel), formatDistance(item.distanceMeters)]
    .filter((part) => part !== "")
    .join(" · ");
}

/**
 * One place or event as a photo card: the picture with nothing around it, then the name in bold
 * with the score ring at its right (for a group, the group's score), one grey line of what it is,
 * and the backend's reason. Tapping it opens the venue.
 * A place with no photo gets a shorter band of the category picture, so real photos lead the page.
 */
export function PlaceCard({
  item,
  now,
  photoHeight = 188,
  showRank = false,
  aside,
  children,
}: {
  item: NearbyItem;
  now: number;
  photoHeight?: number;
  /** The backend's rank in front of the name: "1. Name". */
  showRank?: boolean;
  /** At the right of the line under the card (the two thumbs). Not part of the card's own button. */
  aside?: ReactNode;
  /** At the left of that same line: each person's score. */
  children?: ReactNode;
}) {
  const when = item.startsAt !== undefined ? formatEventTime(item.startsAt, now) : null;
  const performers = item.performers && item.performers.length > 0 ? item.performers.join(", ") : null;
  const height = item.imageUrl ? photoHeight : Math.round(photoHeight * 0.5);
  // Who took the photo, when the backend says (Google's photos ask for it). Read loosely: the
  // field is newer than some of the shapes this card is given.
  const credit = item.imageUrl ? (item as { imageAttribution?: string }).imageAttribution : undefined;
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
              colors={[...scrim.bottom.colors]}
              locations={[...scrim.bottom.locations]}
              style={styles.scrim}
            />
          ) : null}
          {when ? (
            <Text numberOfLines={1} style={[styles.when, credit ? styles.whenBesideCredit : null]}>
              {when}
            </Text>
          ) : null}
          {credit ? (
            <Text numberOfLines={1} style={styles.credit}>
              {credit}
            </Text>
          ) : null}
        </View>
        <View style={styles.head}>
          <View style={styles.text}>
            <Text numberOfLines={2} style={styles.name}>
              {showRank ? `${item.rank}. ${item.name}` : item.name}
            </Text>
            <Text muted numberOfLines={1} style={styles.meta}>
              {performers ? `${performers} · ${metaLine(item)}` : metaLine(item)}
            </Text>
            <Text numberOfLines={2} style={styles.why}>
              {item.why}
            </Text>
          </View>
          <ScoreBadge score={item.score} />
        </View>
      </Pressable>
      {aside || children ? (
        <View style={styles.foot}>
          <View style={styles.people}>{children}</View>
          {aside}
        </View>
      ) : null}
    </View>
  );
}

const THUMB = 84;

/**
 * The same place as a compact row: a square photo, the name in bold, one grey line, the reason,
 * and the score ring at the right. Used where three of them must fit on one screen.
 */
export function PlaceRow({ item, now, children }: { item: NearbyItem; now: number; /** Under the row: each person's score. */ children?: ReactNode }) {
  const when = item.startsAt !== undefined ? formatEventTime(item.startsAt, now) : null;
  return (
    <View style={styles.rowWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${formatScore(item.score)}. ${item.why}`}
        onPress={() => router.push(venuePath(item.kind, item.id))}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <PlacePhoto uri={item.imageUrl} category={item.category} height={THUMB} width={THUMB} round={radius.md + 2} />
        <View style={styles.text}>
          <Text numberOfLines={2} style={styles.rowName}>
            {item.name}
          </Text>
          <Text muted numberOfLines={1} style={styles.meta}>
            {when ? `${when} · ${metaLine(item)}` : metaLine(item)}
          </Text>
          <Text numberOfLines={2} style={styles.why}>
            {item.why}
          </Text>
        </View>
        <ScoreBadge score={item.score} />
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  open: { gap: spacing.sm + 2 },
  pressed: { opacity: 0.7 },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 84, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  when: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    color: palette.onPhoto,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: fontWeight.semibold,
  },
  whenBesideCredit: { right: "45%" },
  credit: {
    position: "absolute",
    right: 8,
    bottom: 8,
    maxWidth: "50%",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: palette.backdrop,
    color: palette.onPhoto,
    fontSize: 10,
    lineHeight: 13,
  },
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 17, lineHeight: 22, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  meta: { fontSize: 14, lineHeight: 19 },
  why: { fontSize: 14, lineHeight: 19, color: palette.soft },
  foot: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 },
  people: { flex: 1 },
  rowWrap: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  rowName: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
});
