import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AvatarStack, Button, EmptyState, ErrorBoundary, Icon, Screen, Sheet, Skeleton, Text } from "../components";
import { PlacePhoto } from "../features/trips/PlacePhoto";
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

const COVER = 148;

/**
 * What only the trip itself knows, read per card: the faces of the people who are in, and a cover
 * photo borrowed from the first shortlisted place that has one. Draws nothing until it arrives.
 */
function TripCover({ tripId }: { tripId: Id<"trips"> }) {
  const trip = useQuery(api.trips.get, { tripId });
  const cover = trip?.shortlist.find((item) => item.imageUrl)?.imageUrl;
  if (!cover) return null;
  return <PlacePhoto uri={cover} height={COVER} style={styles.cover} />;
}

function TripFaces({ tripId }: { tripId: Id<"trips"> }) {
  const trip = useQuery(api.trips.get, { tripId });
  if (!trip) return null;
  return <AvatarStack people={trip.members.filter((member) => member.isOwner || member.status === "joined")} max={4} size={28} />;
}

function TripsSkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading">
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.trip}>
          <Skeleton width="55%" height={18} />
          <Skeleton width="40%" height={13} />
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
            <Button title="New trip" accessibilityLabel="New trip" size="sm" icon="plus" onPress={openForm} style={styles.newTrip} />
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
        <View style={styles.list}>
          {trips.map((trip) => {
            const invited = trip.myStatus === "invited";
            return (
              <View key={trip.tripId} style={styles.card}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={trip.name}
                  onPress={() => router.push(tripPath(trip.tripId))}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  {/* The cover and the faces are a second, optional read: if it fails the card still stands. */}
                  <ErrorBoundary fallback={() => null}>
                    <TripCover tripId={trip.tripId} />
                  </ErrorBoundary>
                  <View style={styles.body}>
                    {invited ? <Text style={styles.invited}>{`${trip.ownerName} invited you`}</Text> : null}
                    <View style={styles.line}>
                      <View style={styles.text}>
                        <Text numberOfLines={2} style={styles.name}>
                          {trip.name}
                        </Text>
                        <Text muted numberOfLines={1} style={styles.facts}>
                          {summaryLine(trip)}
                        </Text>
                      </View>
                      <Icon name="chevron" size={16} color={colors.low} />
                    </View>
                    <View style={styles.who}>
                      <ErrorBoundary fallback={() => null}>
                        <TripFaces tripId={trip.tripId} />
                      </ErrorBoundary>
                      <Text muted numberOfLines={1} style={styles.whoText}>
                        {trip.myStatus === "owner" ? "You're organizing" : `Organized by ${trip.ownerName}`}
                      </Text>
                    </View>
                  </View>
                </Pressable>
                {invited ? (
                  <View style={styles.answer}>
                    <Button
                      title="Join"
                      accessibilityLabel="Join"
                      size="md"
                      disabled={respond.pending}
                      onPress={() => void respond.run({ tripId: trip.tripId, accept: true })}
                      style={styles.answerButton}
                    />
                    <Button
                      title="Decline"
                      accessibilityLabel="Decline"
                      variant="ghost"
                      size="md"
                      disabled={respond.pending}
                      onPress={() => void respond.run({ tripId: trip.tripId, accept: false })}
                      style={[styles.answerButton, styles.outline]}
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
  newTrip: { width: "auto" },
  list: { gap: spacing.md + 2 },
  trip: { paddingVertical: spacing.lg, gap: spacing.md },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  cover: { borderRadius: 0 },
  body: { padding: spacing.md + 2, gap: spacing.sm },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: 2 },
  invited: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.semibold, color: colors.accent },
  name: { fontSize: 18, lineHeight: 23, fontWeight: fontWeight.bold, letterSpacing: -0.3 },
  facts: { fontSize: 14, lineHeight: 19 },
  who: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 28 },
  whoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  answer: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md + 2, paddingBottom: spacing.md + 2 },
  answerButton: { flex: 1 },
  outline: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
});
