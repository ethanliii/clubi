import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Avatar, BackButton, Button, Chip, EmptyState, MatchBadge, Photo, Screen, ScoreBadge, Skeleton, Text, timeAgo,
} from "../../../components";
import { colors, radius, ratingColor, spacing } from "../../../theme";

type Kind = "place" | "event";

/** Venue / event page. UI-SPEC §5. Everything rendered comes from places.get. */
export default function Venue() {
  const params = useLocalSearchParams<{ kind: string; id: string }>();
  const kind: Kind = params.kind === "event" ? "event" : "place";
  const id = params.id as Id<"places"> | Id<"events">;
  const venue = useQuery(api.places.get, { kind, id });
  const toggleSave = useMutation(api.saves.toggle);

  if (venue === undefined) {
    return (
      <Screen>
        <BackButton />
        <Skeleton height={240} />
        <Skeleton height={120} />
      </Screen>
    );
  }
  if (venue === null) {
    return (
      <Screen>
        <BackButton />
        <EmptyState text="This place is no longer listed" action={<Button title="Back" variant="ghost" onPress={() => router.back()} />} />
      </Screen>
    );
  }

  const save = async (type: "want" | "going") => {
    try {
      await toggleSave({ kind, id, type });
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : "Something went wrong");
    }
  };
  const directions = () => {
    const url = Platform.OS === "ios" ? `maps://?daddr=${venue.lat},${venue.lng}` : `geo:${venue.lat},${venue.lng}?q=${encodeURIComponent(venue.name)}`;
    Linking.openURL(url).catch(() => undefined);
  };
  const rankLabel = venue.myRanking ? "Rank again" : kind === "event" ? "Rank this event" : "Rank this place";
  const price = venue.priceLevel ? "$".repeat(venue.priceLevel) : null;

  return (
    <Screen>
      <View style={styles.between}>
        <BackButton />
        <Button title={venue.saved ? "Saved" : "Save"} variant="ghost" style={styles.small} onPress={() => save("want")} />
      </View>
      <View style={styles.photo}>
        <Photo item={venue} height={240} />
      </View>
      <View style={{ gap: 4 }}>
        <Text variant="heading">{venue.name}</Text>
        <Text muted>
          {[venue.subcategory ?? venue.category, price, venue.openNow ? "Open now" : null,
            venue.startsAt ? new Date(venue.startsAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : null]
            .filter(Boolean).join(" · ")}
        </Text>
      </View>

      <View style={styles.scorebox}>
        <ScoreBadge score={venue.score} size="lg" />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.row}>
            <Text variant="label">for you</Text>
            <MatchBadge match={venue.matchPct} size="sm" />
          </View>
          <Text>{venue.why}</Text>
          {venue.myRanking && (
            <Text variant="caption" muted>
              You ranked it #{venue.myRanking.position} of {venue.myRanking.outOf} · {venue.myRanking.score.toFixed(1)}
            </Text>
          )}
        </View>
      </View>

      {venue.breakdown && venue.breakdown.length > 0 && (
        <View style={styles.card}>
          {venue.breakdown.map((b) => (
            <View key={b.label} style={styles.row}>
              <Text variant="caption" style={{ width: 70 }}>{b.label}</Text>
              <View style={styles.bar}><View style={[styles.barFill, { width: `${b.value * 10}%`, backgroundColor: ratingColor(b.value) }]} /></View>
              <Text variant="caption" style={{ width: 28, textAlign: "right" }}>{b.value.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      )}

      {venue.insights && (venue.insights.highlights.length > 0 || venue.insights.bestFor.length > 0) && (
        <View style={{ gap: 6 }}>
          <Text variant="title">Know before you go</Text>
          <View style={styles.chips}>
            {[...venue.insights.highlights, ...venue.insights.bestFor.map((b) => `Best for: ${b}`)].map((c) => <Chip key={c} label={c} />)}
          </View>
        </View>
      )}

      <View style={{ gap: 6 }}>
        <Text variant="title">{"Friends who've been"}</Text>
        {venue.friendRankings.length === 0 ? (
          <Text muted>None of your friends have ranked this yet. Be the first.</Text>
        ) : (
          venue.friendRankings.map((f) => (
            <Pressable key={String(f.userId)} style={styles.review}
              onPress={() => router.push({ pathname: "/user/[userId]", params: { userId: String(f.userId) } })}>
              <Avatar name={f.displayName} url={f.avatarUrl} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600" }}>{f.displayName}{f.isLocal ? " · Local" : ""}</Text>
                {f.caption ? <Text variant="caption">{`"${f.caption}"`}</Text> : null}
                <Text variant="caption" muted>{timeAgo(f.when)} ago</Text>
              </View>
              <ScoreBadge score={f.score} size="sm" />
            </Pressable>
          ))
        )}
      </View>

      {venue.tags.length > 0 && <View style={styles.chips}>{venue.tags.map((t) => <Chip key={t} label={t} />)}</View>}

      {(venue.address || venue.hours) && (
        <View style={styles.card}>
          {venue.address && <Text variant="caption"><Text variant="caption" muted>Address  </Text>{venue.address}</Text>}
          {venue.hours && <Text variant="caption"><Text variant="caption" muted>Hours  </Text>{venue.hours}</Text>}
        </View>
      )}

      <Button title={rankLabel} onPress={() => router.push({ pathname: "/rate", params: { kind, id: String(id) } })} />
      <View style={styles.row}>
        {kind === "event" && <Button title={venue.going ? "Going" : "I'm going"} variant="ghost" style={{ flex: 1, width: "auto" }} onPress={() => save("going")} />}
        {venue.ticketUrl && <Button title="Get tickets" variant="ghost" style={{ flex: 1, width: "auto" }} onPress={() => Linking.openURL(venue.ticketUrl!)} />}
        <Button title="Directions" variant="ghost" style={{ flex: 1, width: "auto" }} onPress={directions} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  small: { width: "auto", paddingVertical: 8, paddingHorizontal: 14 },
  photo: { borderRadius: radius.xl, overflow: "hidden" },
  scorebox: { flexDirection: "row", gap: spacing.md, alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.xl, padding: 14 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, gap: 8 },
  bar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.raised, overflow: "hidden" },
  barFill: { height: "100%" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  review: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
});
