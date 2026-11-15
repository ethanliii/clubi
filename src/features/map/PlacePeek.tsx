import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { NearbyItem } from "../../../convex/lib/contract";
import { Avatar, Button, Chip, Photo, ScoreBadge, Skeleton, Text, openVenue, timeAgo } from "../../components";
import { colors, radius, spacing } from "../../theme";

/**
 * Google-Maps-style place card in the map sheet: actions, a swipeable strip of what people posted
 * (friends' photos + captions), "Know before you go" from venue insights, then quotes.
 */
export function PlacePeek({ item, onClose }: { item: NearbyItem; onClose: () => void }) {
  const venue = useQuery(api.places.get, { kind: item.kind, id: item.id });
  const toggleSave = useMutation(api.saves.toggle);

  const save = () =>
    toggleSave({ kind: item.kind, id: item.id, type: "want" }).catch((e: unknown) =>
      Alert.alert("Couldn't save", e instanceof Error ? e.message : "Try again"),
    );
  const directions = () => {
    const url = Platform.OS === "ios" ? `maps://?daddr=${item.lat},${item.lng}` : `geo:${item.lat},${item.lng}?q=${encodeURIComponent(item.name)}`;
    Linking.openURL(url).catch(() => undefined);
  };

  const shots = venue ? venue.friendRankings.filter((f) => f.photoUrl) : [];
  const quotes = venue ? venue.friendRankings.filter((f) => f.caption) : [];

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.between}>
        <Pressable onPress={() => openVenue(item)} style={{ flex: 1 }}>
          <Text variant="title" numberOfLines={1}>{item.name}</Text>
          <Text variant="caption" muted numberOfLines={1}>
            {[item.subcategory ?? item.category, item.priceLevel ? "$".repeat(item.priceLevel) : null, item.openNow ? "Open now" : null].filter(Boolean).join(" · ")}
          </Text>
        </Pressable>
        <ScoreBadge score={item.score} />
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8}><Text muted>✕</Text></Pressable>
      </View>
      <Text variant="caption">{item.why}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
        <Chip label="Directions" onPress={directions} />
        <Chip label={item.kind === "event" ? "Rank this event" : "Rank this place"}
          onPress={() => router.push({ pathname: "/rate", params: { kind: item.kind, id: String(item.id) } })} />
        <Chip label={item.saved ? "Saved" : "Save"} onPress={save} />
        <Chip label="Details" onPress={() => openVenue(item)} />
      </ScrollView>

      {venue === undefined ? (
        <Skeleton height={150} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          <View style={styles.shot}><Photo item={item} height={150} /></View>
          {shots.map((f) => (
            <View key={String(f.userId)} style={styles.shot}>
              <Image source={{ uri: f.photoUrl! }} style={{ width: "100%", height: 150 }} />
              <View style={styles.shotTag}>
                <Avatar name={f.displayName} url={f.avatarUrl} size={16} />
                <Text style={styles.shotText}>{f.displayName.split(" ")[0]} · {f.score.toFixed(1)} · {timeAgo(f.when)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {venue?.insights && venue.insights.highlights.length > 0 && (
        <View style={styles.card}>
          <Text style={{ fontWeight: "700" }}>Know before you go</Text>
          {venue.insights.highlights.slice(0, 3).map((h) => <Text key={h} variant="caption">• {h}</Text>)}
          {venue.insights.bestFor.length > 0 && <Text variant="caption" muted>Best for: {venue.insights.bestFor.join(", ")}</Text>}
        </View>
      )}

      {quotes.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {quotes.map((f) => (
            <View key={String(f.userId)} style={styles.quote}>
              <Text style={styles.quoteText} numberOfLines={4}>{`“${f.caption}”`}</Text>
              <Text variant="caption" muted>{f.displayName} · {f.score.toFixed(1)}</Text>
            </View>
          ))}
        </ScrollView>
      )}
      <Button title="See all" variant="ghost" onPress={() => openVenue(item)} />
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", alignItems: "center", gap: 10 },
  actions: { gap: 8 },
  strip: { gap: 8 },
  shot: { width: 200, borderRadius: radius.lg, overflow: "hidden" },
  shotTag: { position: "absolute", left: 6, bottom: 6, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 },
  shotText: { color: colors.white, fontSize: 11, lineHeight: 14 },
  card: { backgroundColor: colors.raised, borderRadius: radius.lg, padding: 12, gap: 4 },
  quote: { width: 220, backgroundColor: colors.raised, borderRadius: radius.lg, padding: 12, gap: 6 },
  quoteText: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
});
