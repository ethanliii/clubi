import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, EmptyState, Header, Icon, ListRow, Screen, Sheet, SkeletonRows } from "../components";
import { TripForm } from "../features/trips/TripForm";
import { api, type Id, type TripSummary } from "../lib/api";
import { formatDateRange, pluralize } from "../lib/format";
import { tripPath } from "../lib/links";
import { useMutationToast } from "../lib/useMutationToast";
import { colors, spacing } from "../theme";

/** "4 people · Mar 12–15 · New York", or "Invited by Bryan" while the invite is open. */
function summaryLine(trip: TripSummary): string {
  const facts = [formatDateRange(trip.startDate, trip.endDate), trip.city ?? ""].filter((part) => part !== "");
  if (trip.myStatus === "invited") return [`Invited by ${trip.ownerName}`, ...facts].join(" · ");
  return [pluralize(trip.memberCount, "person", "people"), ...facts].join(" · ");
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
      <Header
        title="Trips"
        right={
          // With no trips the one "New trip" button is in the middle of the screen.
          hasTrips ? (
            <Button title="New trip" accessibilityLabel="New trip" onPress={openForm} style={styles.newTrip} />
          ) : undefined
        }
      />

      {trips === undefined ? (
        <SkeletonRows count={4} />
      ) : trips.length === 0 ? (
        <EmptyState
          icon="users"
          title="Going somewhere with friends? Start a trip."
          actionLabel="New trip"
          onAction={openForm}
        />
      ) : (
        <View>
          {trips.map((trip) => (
            <View key={trip.tripId} style={styles.trip}>
              <ListRow
                title={trip.name}
                subtitle={summaryLine(trip)}
                divider={false}
                left={
                  <View style={styles.badge}>
                    <Icon name={trip.startDate !== undefined ? "calendar" : "users"} size={20} color={colors.muted} />
                  </View>
                }
                right={<Icon name="chevron" size={16} color={colors.muted} />}
                onPress={() => router.push(tripPath(trip.tripId))}
              />
              {trip.myStatus === "invited" ? (
                <View style={styles.answer}>
                  <Button
                    title="Join"
                    accessibilityLabel="Join"
                    disabled={respond.pending}
                    onPress={() => void respond.run({ tripId: trip.tripId, accept: true })}
                    style={styles.flex}
                  />
                  <Button
                    title="Decline"
                    accessibilityLabel="Decline"
                    variant="ghost"
                    disabled={respond.pending}
                    onPress={() => void respond.run({ tripId: trip.tripId, accept: false })}
                    style={styles.flex}
                  />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <Sheet visible={formOpen} onClose={() => setFormOpen(false)} title="New trip">
        <TripForm key={formRound} onCreated={onCreated} onNavigate={() => setFormOpen(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  newTrip: { width: "auto", paddingVertical: spacing.sm + 2 },
  trip: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  answer: { flexDirection: "row", gap: spacing.sm, paddingBottom: spacing.md },
});
