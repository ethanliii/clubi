import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AvatarStack, Button, EmptyState, ErrorBoundary, Icon, Screen, Sheet, Skeleton, Text } from "../components";
import { ScreenTop } from "../features/trips/ScreenTop";
import { TripForm } from "../features/trips/TripForm";
import { api, type Id, type TripSummary } from "../lib/api";
import { formatDateRange, pluralize } from "../lib/format";
import { tripPath } from "../lib/links";
import { useMutationToast } from "../lib/useMutationToast";
import { colors, fontWeight, radius, spacing } from "../theme";

/** "Mar 12–15 · New York · 4 people" */
function summaryLine(trip: TripSummary): string {
  return [formatDateRange(trip.startDate, trip.endDate), trip.city ?? "", pluralize(trip.memberCount, "person", "people")]
    .filter((part) => part !== "")
    .join(" · ");
}

/** The faces of the people who are in on a trip, read from the trip itself. Draws nothing until they arrive. */
function TripFaces({ tripId }: { tripId: Id<"trips"> }) {
  const trip = useQuery(api.trips.get, { tripId });
  if (!trip) return null;
  return <AvatarStack people={trip.members.filter((member) => member.isOwner || member.status === "joined")} max={5} size={32} />;
}

function TripsSkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading">
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.trip}>
          <Skeleton width="55%" height={22} />
          <Skeleton width="40%" height={13} />
          <Skeleton width={96} height={32} round={16} />
        </View>
      ))}
    </View>
  );
}

export default function TripsScreen() {
  const trips = useQuery(api.trips.list, {});
  const [formOpen, setFormOpen] = useState(false);
  // A new number each time the form opens, so it always starts empty.
  const [formRound, setFormRound] = useState(0);
  const respond = useMutationToast(api.trips.respond);

  const openForm = () => {
    setFormRound((round) => round + 1);
    setFormOpen(true);
  };

  const onCreated = (tripId: Id<"trips">) => {
    setFormOpen(false);
    router.push(tripPath(tripId));
  };

  const hasTrips = trips !== undefined && trips.length > 0;

  return (
    <Screen>
      <ScreenTop
        title="Trips"
        right={
          // With no trips the one "New trip" button is in the middle of the screen.
          hasTrips ? (
            <Button title="New trip" accessibilityLabel="New trip" onPress={openForm} style={styles.newTrip} />
          ) : undefined
        }
      />

      {trips === undefined ? (
        <TripsSkeleton />
      ) : trips.length === 0 ? (
        <EmptyState
          icon="users"
          title="Going somewhere with friends? Start a trip."
          actionLabel="New trip"
          onAction={openForm}
        />
      ) : (
        <View>
          {trips.map((trip, index) => {
            const invited = trip.myStatus === "invited";
            return (
              <View key={trip.tripId} style={[styles.trip, index > 0 && styles.divided]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={trip.name}
                  onPress={() => router.push(tripPath(trip.tripId))}
                  style={({ pressed }) => [styles.open, pressed && styles.pressed]}
                >
                  <View style={styles.text}>
                    {invited ? <Text style={styles.invited}>{`${trip.ownerName} invited you`}</Text> : null}
                    <Text numberOfLines={2} style={styles.name}>
                      {trip.name}
                    </Text>
                    <Text muted numberOfLines={1} style={styles.facts}>
                      {summaryLine(trip)}
                    </Text>
                    {/* The faces are a second, optional read: if it fails the row still stands. */}
                    <ErrorBoundary fallback={() => null}>
                      <View style={styles.faces}>
                        <TripFaces tripId={trip.tripId} />
                      </View>
                    </ErrorBoundary>
                  </View>
                  <Icon name="chevron" size={18} color={colors.muted} />
                </Pressable>
                {invited ? (
                  <View style={styles.answer}>
                    <Button
                      title="Join"
                      accessibilityLabel="Join"
                      disabled={respond.pending}
                      onPress={() => void respond.run({ tripId: trip.tripId, accept: true })}
                      style={styles.answerButton}
                    />
                    <Button
                      title="Decline"
                      accessibilityLabel="Decline"
                      variant="ghost"
                      disabled={respond.pending}
                      onPress={() => void respond.run({ tripId: trip.tripId, accept: false })}
                      style={styles.answerButton}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <Sheet visible={formOpen} onClose={() => setFormOpen(false)} title="New trip">
        <TripForm key={formRound} onCreated={onCreated} onNavigate={() => setFormOpen(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  newTrip: { width: "auto", minHeight: 40, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill },
  trip: { paddingVertical: spacing.lg + 2, gap: spacing.md },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  open: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: 3 },
  invited: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.semibold, color: colors.accent },
  name: { fontSize: 22, lineHeight: 27, fontWeight: fontWeight.bold, letterSpacing: -0.3 },
  facts: { fontSize: 15 },
  faces: { minHeight: 36, justifyContent: "center", marginTop: spacing.sm },
  answer: { flexDirection: "row", gap: spacing.sm },
  answerButton: { flex: 1, borderRadius: radius.pill },
});
