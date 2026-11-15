import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { NearbyItem } from "../../convex/lib/contract";
import { categoryLabel, formatDistance, formatEventTime, formatPrice, formatScore } from "../lib/format";
import { venuePath } from "../lib/links";
import { colors, elevation, fontWeight, layout, palette, radius, ratingColor, spacing } from "../theme";
import { AvatarStack } from "./Avatar";
import { Photo } from "./Photo";
import { ScoreBadge } from "./ScoreBadge";
import { Text } from "./Text";

export type ItemCardProps = {
  /** Anything shaped like a `NearbyItem`: map and home items, plan stops, group picks, search results. */
  item: NearbyItem;
  /** `row` (default): one line of a list. `card`: a photo card for sideways rows. */
  variant?: "row" | "card";
  /** Defaults to opening the venue page for this item. */
  onPress?: () => void;
  /** Row only: show the backend's `rank` in front ("1", "2", …). */
  showRank?: boolean;
  /** Card only: its width. Default 240. */
  width?: number;
  /** Extra content at the bottom: each member's score, vote buttons, a "Start" label. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** "Cafe · $$ · 350 m · Open now" from what the backend sent. */
function metaLine(item: NearbyItem, withMatch: boolean): string {
  return [
    withMatch ? `${item.matchPct}% match` : "",
    categoryLabel(item.category, item.subcategory),
    formatPrice(item.priceLevel),
    formatDistance(item.distanceMeters),
    // The backend's `why` line often already says "Open now"; say it once.
    item.kind === "place" && item.openNow && !item.why.includes("Open now") ? "Open now" : "",
  ]
    .filter((part) => part !== "")
    .join(" · ");
}

/** Friends who ranked it: their faces, then "Maya 8.2 · Sam 7.5" with each score in its rating colour. */
function Friends({ item }: { item: NearbyItem }) {
  if (item.friends.length === 0) return null;
  const shown = item.friends.slice(0, 3);
  return (
    <View style={styles.friends}>
      <AvatarStack people={shown} size={20} />
      <Text variant="caption" muted numberOfLines={1} style={styles.flex}>
        {shown.map((friend, index) => (
          <Text key={`${friend.displayName}-${index}`} variant="caption" muted>
            {index > 0 ? "  ·  " : ""}
            {friend.displayName.split(" ")[0]}{" "}
            <Text variant="caption" style={[styles.friendScore, { color: ratingColor(friend.score) }]}>
              {formatScore(friend.score)}
            </Text>
          </Text>
        ))}
        {item.friends.length > shown.length ? `  +${item.friends.length - shown.length}` : ""}
      </Text>
    </View>
  );
}

/**
 * One place or event, drawn from a `NearbyItem` exactly as the backend returned it: its photo, name,
 * what it is, the score with its `why` line, distance, the friends who ranked it, and for events
 * the start time and who is playing.
 */
export function ItemCard({ item, variant = "row", onPress, showRank = false, width = 240, children, style }: ItemCardProps) {
  const open = onPress ?? (() => router.push(venuePath(item.kind, item.id)));
  const label = `${item.name}, ${formatScore(item.score)} for you. ${item.why}`;
  const when = item.startsAt !== undefined ? formatEventTime(item.startsAt) : null;
  const performers = item.performers && item.performers.length > 0 ? item.performers.join(", ") : null;

  if (variant === "card") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={open}
        style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed, style]}
      >
        {/* The photo carries the name and the score; the reason reads underneath it. */}
        <Photo uri={item.imageUrl} category={item.category} height={Math.round(width * 1.08)} scrim="bottom">
          <View style={styles.onPhoto}>
            <ScoreBadge score={item.score} style={styles.cardScore} />
            <View style={styles.cardTitles}>
              <Text numberOfLines={2} style={styles.cardName}>
                {item.name}
              </Text>
              <Text variant="caption" numberOfLines={1} style={styles.cardMeta}>
                {when ?? metaLine(item, false)}
              </Text>
            </View>
          </View>
        </Photo>
        <View style={styles.cardBody}>
          <Text soft numberOfLines={2}>
            {item.why}
          </Text>
          <Text variant="caption" muted numberOfLines={1}>
            {when ? metaLine(item, true) : `${item.matchPct}% match`}
          </Text>
          {performers ? (
            <Text variant="caption" muted numberOfLines={1}>
              {performers}
            </Text>
          ) : null}
          <Friends item={item} />
          {children}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={open}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}
    >
      {showRank ? (
        <Text style={styles.rank} muted>
          {item.rank}
        </Text>
      ) : null}
      <Photo
        uri={item.imageUrl}
        category={item.category}
        width={layout.rowThumb}
        height={layout.rowThumb}
        round={radius.lg}
      />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={styles.rowName}>
            {item.name}
          </Text>
          <ScoreBadge score={item.score} />
        </View>
        <Text soft numberOfLines={2} style={styles.why}>
          {item.why}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {metaLine(item, true)}
        </Text>
        {when ? (
          <Text variant="caption" numberOfLines={1} style={styles.when}>
            {performers ? `${when} · ${performers}` : when}
          </Text>
        ) : null}
        <Friends item={item} />
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  friends: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  friendScore: { fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },

  // Card: no box. A tall photo with the name on it, the reason under it.
  card: { gap: spacing.sm + 2 },
  onPhoto: { flex: 1, justifyContent: "space-between", padding: spacing.md },
  cardScore: { ...elevation.card },
  cardTitles: { gap: 2 },
  cardName: { fontSize: 19, lineHeight: 23, fontWeight: fontWeight.bold, letterSpacing: -0.4, color: palette.onPhoto },
  cardMeta: { color: palette.onPhotoMuted },
  cardBody: { gap: spacing.xs, paddingHorizontal: 2 },

  // Row: photo, then name and score on one line, the reason, and the facts.
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    minHeight: 72,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.hairline,
  },
  rank: { width: 22, textAlign: "center", fontWeight: fontWeight.semibold, fontVariant: ["tabular-nums"], lineHeight: layout.rowThumb, color: colors.low },
  rowBody: { flex: 1, gap: 3, minHeight: layout.rowThumb, justifyContent: "center" },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  rowName: { flex: 1, fontSize: 16, lineHeight: 21, fontWeight: fontWeight.semibold, letterSpacing: -0.2 },
  why: { lineHeight: 19 },
  when: { color: colors.fg, fontWeight: fontWeight.semibold },
});
