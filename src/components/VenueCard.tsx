import { router } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import type { NearbyItem } from "../../convex/lib/contract";
import { colors, radius, spacing } from "../theme";
import { FriendScores, formatDistance } from "./Bits";
import { MatchBadge, ScoreBadge } from "./ScoreBadge";
import { Text } from "./Text";
import { VenuePhoto } from "./VenuePhoto";

const CATEGORY_HUE: Record<string, number> = { nightlife: 320, food: 25, culture: 265, outdoors: 140, live: 200, popup: 45 };

export function openVenue(item: Pick<NearbyItem, "kind" | "id">) {
  router.push({ pathname: "/venue/[kind]/[id]", params: { kind: item.kind, id: String(item.id) } });
}

export function Photo({ item, height }: { item: Pick<NearbyItem, "imageUrl" | "category">; height: number }) {
  if (item.imageUrl) return <Image source={{ uri: item.imageUrl }} style={{ height, width: "100%" }} />;
  return <VenuePhoto hue={CATEGORY_HUE[item.category] ?? 300} height={height} style={{ borderRadius: 0 }} />;
}

/** Everything shown comes straight from the backend item: score + why, match %, distance, friends. */
export function VenueCard({ item, big, tag }: { item: NearbyItem; big?: boolean; tag?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={item.name} onPress={() => openVenue(item)} style={[styles.card, !big && styles.small]}>
      <View>
        <Photo item={item} height={big ? 200 : 96} />
        {tag && <Text style={styles.tag}>{tag}</Text>}
      </View>
      <View style={[styles.meta, !big && { padding: 8 }]}>
        <View style={styles.between}>
          <Text variant={big ? "title" : "body"} style={!big && { fontWeight: "600" }} numberOfLines={1}>
            {item.name}
          </Text>
          {big && <MatchBadge match={item.matchPct} />}
        </View>
        <View style={[styles.between, { justifyContent: "flex-start" }]}>
          <ScoreBadge score={item.score} size="sm" />
          <Text variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
            {item.subcategory ?? item.category} · {formatDistance(item.distanceMeters)}
            {item.openNow ? " · Open now" : ""}
            {item.startsAt ? ` · ${new Date(item.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
          </Text>
        </View>
        <Text variant="caption" style={styles.why} numberOfLines={big ? 2 : 2}>
          {item.why}
        </Text>
        {big && <FriendScores friends={item.friends} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: "hidden" },
  small: { width: 170 },
  meta: { padding: spacing.md, gap: 6 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  why: { color: colors.fg, opacity: 0.85 },
  tag: {
    position: "absolute",
    left: 12,
    top: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    overflow: "hidden",
  },
});
