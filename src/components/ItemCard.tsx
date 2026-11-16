import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { NearbyItem } from "../../convex/lib/contract";
import { categoryLabel, formatDistance, formatEventTime, formatPrice, formatScore } from "../lib/format";
import { venuePath } from "../lib/links";
import { colors, fontWeight, layout, palette, radius, ratingColor, spacing } from "../theme";
import { AvatarStack } from "./Avatar";
import { Photo } from "./Photo";
import { ScoreBadge } from "./ScoreBadge";
import { Text } from "./Text";

export type ItemCardProps = {
  /** Anything shaped like a `NearbyItem`: map and home items, plan stops, group picks, search results. */
  item: NearbyItem;
  /** `row` (default): one line of a list. `card`: a photo card for carousels, name and one grey line under the photo. */
  variant?: "row" | "card";
  /** Defaults to opening the venue page for this item. */
  onPress?: () => void;
  /** Row only: number the row with the backend's `rank` ("1. Name"). */
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
 *
 * `card` is the browsing card: a borderless photo, the name in bold under it, one grey line of
 * facts, and the score ring at the right. `row` is the ranked-list row: a small photo, "1. Name",
 * a grey line, and the same ring at the right.
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
        <Photo uri={item.imageUrl} category={item.category} height={Math.round(width * 0.6)} round={radius.lg} />
        <View style={styles.cardFoot}>
          <View style={styles.cardTitles}>
            <Text numberOfLines={1} style={styles.cardName}>
              {item.name}
            </Text>
            <Text variant="caption" muted numberOfLines={1}>
              {metaLine(item, false)}
            </Text>
            {when ? (
              <Text variant="caption" numberOfLines={1} style={styles.when}>
                {performers ? `${when} · ${performers}` : when}
              </Text>
            ) : null}
            {item.why !== "" ? (
              <Text variant="caption" muted numberOfLines={1}>
                {item.why}
              </Text>
            ) : null}
          </View>
          <ScoreBadge score={item.score} size="md" />
        </View>
        {item.friends.length > 0 || children ? (
          <View style={styles.cardExtra}>
            <Friends item={item} />
            {children}
          </View>
        ) : null}
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
      <Photo
        uri={item.imageUrl}
        category={item.category}
        width={layout.rowThumb}
        height={layout.rowThumb}
        round={radius.md}
      />
      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={styles.rowName}>
          {showRank ? `${item.rank}. ` : ""}
          {item.name}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {metaLine(item, false)}
        </Text>
        {when ? (
          <Text variant="caption" numberOfLines={1} style={styles.when}>
            {performers ? `${when} · ${performers}` : when}
          </Text>
        ) : null}
        {item.why !== "" ? (
          <Text variant="caption" muted numberOfLines={2}>
            {item.why}
          </Text>
        ) : null}
        <Friends item={item} />
        {children}
      </View>
      <ScoreBadge score={item.score} size="md" style={styles.rowScore} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  friends: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  friendScore: { fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },

  // Card: no box and no border. A wide photo, then the name, one grey line, and the score ring.
  card: { gap: spacing.sm },
  cardFoot: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardTitles: { flex: 1, gap: 2 },
  cardName: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  cardExtra: { gap: spacing.xs },

  // Row: small photo, "1. Name", a grey line of facts, the reason, and the score ring at the right.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 72,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.hairline,
  },
  rowBody: { flex: 1, gap: 2, minHeight: layout.rowThumb, justifyContent: "center" },
  rowName: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  rowScore: { alignSelf: "center" },
  when: { color: colors.fg, fontWeight: fontWeight.semibold },
});
