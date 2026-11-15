import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { NearbyItem } from "../../convex/lib/contract";
import { categoryHue, categoryLabel, formatDistance, formatEventTime, formatPrice, formatScore } from "../lib/format";
import { venuePath } from "../lib/links";
import { colors, fontWeight, radius, spacing } from "../theme";
import { AvatarStack } from "./Avatar";
import { ScoreBadge } from "./ScoreBadge";
import { Text } from "./Text";
import { VenuePhoto } from "./VenuePhoto";

export type ItemCardProps = {
  /** Anything shaped like a `NearbyItem`: map and home items, plan stops, group picks, search results. */
  item: NearbyItem;
  /** `row` (default): one line of a list. `card`: a picture card for sideways rows. */
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
function metaLine(item: NearbyItem): string {
  return [
    categoryLabel(item.category, item.subcategory),
    formatPrice(item.priceLevel),
    formatDistance(item.distanceMeters),
    // The backend's `why` line often already says "Open now"; say it once.
    item.kind === "place" && item.openNow && !item.why.includes("Open now") ? "Open now" : "",
  ]
    .filter((part) => part !== "")
    .join(" · ");
}

function Picture({ item, height, round }: { item: NearbyItem; height: number; round: number }) {
  const [failed, setFailed] = useState(false);
  if (item.imageUrl && !failed) {
    return (
      <Image
        source={{ uri: item.imageUrl }}
        resizeMode="cover"
        onError={() => setFailed(true)}
        style={[styles.image, { height, borderRadius: round }]}
      />
    );
  }
  return <VenuePhoto hue={categoryHue(item.category)} height={height} style={{ borderRadius: round }} />;
}

function Friends({ item }: { item: NearbyItem }) {
  if (item.friends.length === 0) return null;
  return (
    <View style={styles.friends}>
      <AvatarStack people={item.friends} size={22} />
      <Text variant="caption" muted numberOfLines={1} style={styles.flex}>
        {item.friends.map((friend) => `${friend.displayName.split(" ")[0]} ${formatScore(friend.score)}`).join(" · ")}
      </Text>
    </View>
  );
}

/**
 * One place or event, drawn from a `NearbyItem` exactly as the backend returned it:
 * name, what it is, the score with its `why` line, distance, friends' avatars and scores,
 * and for events the start time and who is playing.
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
        <View>
          <Picture item={item} height={120} round={0} />
          <View style={styles.cardScore}>
            <ScoreBadge score={item.score} />
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text variant="title" numberOfLines={1}>
            {item.name}
          </Text>
          <Text variant="caption" numberOfLines={2} style={styles.why}>
            {item.why}
          </Text>
          <Text variant="caption" muted numberOfLines={1}>
            {`${item.matchPct}% match · ${metaLine(item)}`}
          </Text>
          {when ? (
            <Text variant="caption" numberOfLines={1} style={styles.when}>
              {when}
            </Text>
          ) : null}
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
      <View style={styles.thumb}>
        <Picture item={item} height={56} round={radius.md} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={styles.rowName}>
            {item.name}
          </Text>
          <ScoreBadge score={item.score} />
        </View>
        <Text variant="caption" numberOfLines={2} style={styles.why}>
          {item.why}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {`${item.matchPct}% match · ${metaLine(item)}`}
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
  pressed: { opacity: 0.7 },
  image: { width: "100%", backgroundColor: colors.raised },
  why: { color: colors.fg },
  when: { color: colors.mid, fontWeight: fontWeight.semibold },
  friends: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  cardScore: { position: "absolute", top: spacing.sm, right: spacing.sm },
  cardBody: { padding: spacing.md, gap: 4 },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 72,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rank: { width: 22, textAlign: "center", fontWeight: fontWeight.bold, marginTop: 18 },
  thumb: { width: 56, height: 56 },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  rowName: { flex: 1, fontSize: 15, fontWeight: fontWeight.semibold },
});
