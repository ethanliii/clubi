import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { EmptyState, ErrorBoundary, goBack, Screen, Skeleton, Text } from "../components";
import { citySpot } from "../features/trips/city";
import { Face, FaceRow } from "../features/trips/Faces";
import { FriendChips, toggleId } from "../features/trips/FriendChips";
import { MemberScores } from "../features/trips/MemberScores";
import { PlaceRow } from "../features/trips/PlaceCard";
import { FieldLabel, ScreenTop, SectionLabel } from "../features/trips/ScreenTop";
import { VibeChips, type Vibe } from "../features/trips/vibes";
import { api, type Id, type PlanResult } from "../lib/api";
import { pluralize } from "../lib/format";
import { useDemoLocation } from "../lib/demoLocation";
import { useNow } from "../lib/useNow";
import { useMe } from "../state/session";
import { colors, fontWeight, radius, spacing } from "../theme";

/** One step of the night on the timeline: the dot and line on the left, the stop on the right. */
function Step({ last, index, children }: { last: boolean; index: number; children: ReactNode }) {
  return (
    <View style={styles.step}>
      <View style={styles.rail}>
        <View style={styles.dot}>
          <Text style={styles.dotText}>{index + 1}</Text>
        </View>
        {last ? null : <View style={styles.line} />}
      </View>
      <View style={[styles.stepBody, !last && styles.stepGap]}>{children}</View>
    </View>
  );
}

function StopsSkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading">
      {[0, 1, 2].map((index) => (
        <Step key={index} index={index} last={index === 2}>
          <Skeleton width={72} height={14} />
          <Skeleton height={84} round={radius.md + 2} />
        </Step>
      ))}
    </View>
  );
}

export default function PlanScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  return (
    // A link with a plan id the backend does not recognise throws; show it as a plan that is gone.
    <ErrorBoundary
      key={tripId ?? ""}
      fallback={() => (
        <Screen>
          <ScreenTop title="Plan my night" />
          <EmptyState title="This plan was deleted" icon="users" actionLabel="Back" onAction={goBack} />
        </Screen>
      )}
    >
      <PlanLoader />
    </ErrorBoundary>
  );
}

function PlanLoader() {
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = params.tripId ? (params.tripId as Id<"trips">) : undefined;
  const me = useMe();
  const now = useNow();
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
        <EmptyState title="This plan was deleted" icon="users" actionLabel="Back" onAction={goBack} />
      </Screen>
    );
  }

  const you = me ? <Face name={me.displayName} uri={me.avatarUrl} label="You" selected /> : undefined;

  return (
    <Screen>
      <View style={styles.top}>
        <ScreenTop title="Plan my night" />
        <Text muted style={styles.sub}>
          {tripId && trip ? `Three stops for ${trip.name}` : "Three stops, picked for whoever is coming."}
        </Text>
      </View>

      <View style={styles.group}>
        <FieldLabel>{"Who's coming"}</FieldLabel>
        {tripId ? (
          // A trip plans for everyone who joined it; the backend says who that is.
          shown === undefined ? (
            <View style={styles.loadingFaces}>
              <Skeleton width={56} height={56} round={28} />
              <Skeleton width={56} height={56} round={28} />
            </View>
          ) : (
            <FaceRow>
              {shown.members.map((member) => (
                <Face
                  key={member.userId}
                  name={member.displayName}
                  uri={member.avatarUrl}
                  label={member.userId === me?.userId ? "You" : undefined}
                />
              ))}
            </FaceRow>
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
        <FieldLabel>Vibe</FieldLabel>
        <VibeChips value={vibe ?? shown?.vibe} onChange={setVibe} />
      </View>

      <SectionLabel title="Tonight" note={shown && shown.stops.length > 0 ? pluralize(shown.stops.length, "stop", "stops") : undefined} />
      {shown === undefined ? (
        <StopsSkeleton />
      ) : shown.stops.length === 0 ? (
        <EmptyState title="Not enough open places nearby right now." icon="map" />
      ) : (
        <View style={updating && styles.updating}>
          {shown.stops.map((stop, index) => (
            <Step key={stop.id} index={index} last={index === shown.stops.length - 1}>
              <Text style={styles.slot}>{stop.slotLabel}</Text>
              <PlaceRow item={stop} now={now}>
                <MemberScores scores={stop.memberScores} meId={me?.userId} />
              </PlaceRow>
            </Step>
          ))}
        </View>
      )}
    </Screen>
  );
}

const RAIL = 24;
const DOT = 24;

const styles = StyleSheet.create({
  group: { gap: spacing.sm + 2 },
  top: { gap: spacing.xs + 2 },
  sub: { fontSize: 15 },
  loadingFaces: { flexDirection: "row", gap: spacing.md },
  updating: { opacity: 0.5 },
  step: { flexDirection: "row", gap: spacing.md },
  rail: { width: RAIL, alignItems: "center" },
  // The numbered dot sits on the slot label's line; the line runs from it down to the next dot.
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.fg, alignItems: "center", justifyContent: "center" },
  dotText: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.bold, color: colors.white, fontVariant: ["tabular-nums"] },
  line: { flex: 1, width: 2, marginVertical: 4, borderRadius: 1, backgroundColor: colors.line },
  stepBody: { flex: 1, gap: spacing.sm + 2 },
  stepGap: { paddingBottom: spacing.xl },
  slot: { fontSize: 15, lineHeight: 24, fontWeight: fontWeight.bold, letterSpacing: -0.1, color: colors.fg },
});
