import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Avatar, Chip, ChipRow, EmptyState, goBack, ItemCard, Screen, Skeleton, Text } from "../components";
import { citySpot } from "../features/trips/city";
import { FriendChips, toggleId } from "../features/trips/FriendChips";
import { MemberScores } from "../features/trips/MemberScores";
import { ScreenTop } from "../features/trips/ScreenTop";
import { VibeChips, type Vibe } from "../features/trips/vibes";
import { api, type Id, type PlanResult } from "../lib/api";
import { useDemoLocation } from "../lib/demoLocation";
import { useMe } from "../state/session";
import { colors, radius, spacing } from "../theme";

function StopsSkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.stops}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.stop}>
          <Skeleton width={64} height={11} />
          <View style={styles.skeletonRow}>
            <Skeleton width={56} height={56} />
            <View style={styles.skeletonLines}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="85%" height={11} />
              <Skeleton width="40%" height={11} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function PlanScreen() {
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = params.tripId ? (params.tripId as Id<"trips">) : undefined;
  const me = useMe();
  const { lat, lng, ready } = useDemoLocation();

  const [memberIds, setMemberIds] = useState<Id<"users">[]>([]);
  // undefined until the user taps one: the backend then picks (the trip's vibe, or its default)
  // and says which in `plan.vibe`.
  const [vibe, setVibe] = useState<Vibe | undefined>(undefined);

  const trip = useQuery(api.trips.get, tripId ? { tripId } : "skip");
  const friends = useQuery(api.friends.list, tripId ? "skip" : {});
  // A trip is planned around its own spot (the backend reads it from the trip), then around its
  // city when the backend knows that city, otherwise around me. Wait for the trip so the stops
  // do not start near me and then jump to its city.
  const tripCity = trip && trip.lat === undefined ? citySpot(trip.city) : undefined;
  const plan = useQuery(
    api.discover.plan,
    tripId
      ? trip && (tripCity !== undefined || ready)
        ? { lat: tripCity?.lat ?? lat, lng: tripCity?.lng ?? lng, tripId, ...(vibe ? { vibe } : {}) }
        : "skip"
      : ready
        ? { lat, lng, memberIds, ...(vibe ? { vibe } : {}) }
        : "skip",
  );

  // Keep the last answer on screen while a new one loads, so the stops do not blink out
  // each time a friend or a vibe is tapped.
  const [lastPlan, setLastPlan] = useState<PlanResult | undefined>(undefined);
  if (plan !== undefined && plan !== lastPlan) setLastPlan(plan);
  const shown = plan ?? lastPlan;
  const updating = plan === undefined && shown !== undefined;

  if (tripId && trip === null) {
    return (
      <Screen>
        <ScreenTop title="Plan my night" />
        <EmptyState title="This trip was deleted" icon="users" actionLabel="Back" onAction={goBack} />
      </Screen>
    );
  }

  const you = <Chip label="You" selected leading={me ? <Avatar name={me.displayName} uri={me.avatarUrl} size={22} /> : undefined} />;

  return (
    <Screen>
      <View style={styles.top}>
        <ScreenTop title="Plan my night" kicker="Itinerary" />
        {tripId && trip ? <Text muted>{`Three stops for ${trip.name}`}</Text> : null}
      </View>

      <View style={styles.group}>
        <Text variant="label">{"Who's coming"}</Text>
        {tripId ? (
          // A trip plans for everyone who joined it; the backend says who that is.
          shown === undefined ? (
            <ChipRow>
              <Skeleton width={96} height={40} round={radius.pill} />
              <Skeleton width={120} height={40} round={radius.pill} />
            </ChipRow>
          ) : (
            <ChipRow>
              {shown.members.map((member) => (
                <Chip
                  key={member.userId}
                  label={member.userId === me?.userId ? "You" : member.displayName}
                  selected
                  leading={<Avatar name={member.displayName} uri={member.avatarUrl} size={22} />}
                />
              ))}
            </ChipRow>
          )
        ) : (
          <FriendChips
            friends={friends?.friends}
            selected={memberIds}
            onToggle={(userId) => setMemberIds((current) => toggleId(current, userId))}
            leading={you}
          />
        )}
      </View>

      <View style={styles.group}>
        <Text variant="label">Vibe</Text>
        <VibeChips value={vibe ?? shown?.vibe} onChange={setVibe} />
      </View>

      {shown === undefined ? (
        <StopsSkeleton />
      ) : shown.stops.length === 0 ? (
        <EmptyState title="Not enough open places nearby right now." icon="map" />
      ) : (
        <View style={[styles.stops, updating && styles.updating]}>
          {shown.stops.map((stop) => (
            <View key={stop.id} style={styles.stop}>
              <Text variant="label">{stop.slotLabel}</Text>
              <ItemCard item={stop} style={styles.stopCard}>
                <MemberScores scores={stop.memberScores} meId={me?.userId} />
              </ItemCard>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  top: { gap: spacing.xs },
  stops: { gap: spacing.md },
  // Each stop is one of Bryan's cards: the time slot as the small label, the place under it.
  stop: {
    gap: spacing.sm + 2,
    padding: spacing.md + 2,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  stopCard: { borderBottomWidth: 0, paddingVertical: 0, minHeight: 0 },
  updating: { opacity: 0.5 },
  skeletonRow: { flexDirection: "row", gap: spacing.md },
  skeletonLines: { flex: 1, gap: spacing.sm },
});
