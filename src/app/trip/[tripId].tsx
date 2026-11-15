import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  EmptyState,
  goBack,
  IconButton,
  Screen,
  Sheet,
  SkeletonRows,
  Text,
} from "../../components";
import { citySpot } from "../../features/trips/city";
import { InviteSheet } from "../../features/trips/InviteSheet";
import { ScreenTop } from "../../features/trips/ScreenTop";
import { TripForm } from "../../features/trips/TripForm";
import { GroupPicks, MemberList, Shortlist, type OnVote } from "../../features/trips/TripSections";
import type { Vote } from "../../features/trips/VoteButtons";
import { vibeLabel } from "../../features/trips/vibes";
import { api, type Id, type TripDetail } from "../../lib/api";
import { confirm } from "../../lib/confirm";
import { useDemoLocation } from "../../lib/demoLocation";
import { useKeptQuery } from "../../lib/useKeptQuery";
import { formatDateRange, pluralize } from "../../lib/format";
import { paths, planPath } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { useMe } from "../../state/session";
import { colors, radius, spacing } from "../../theme";

/** Same grid as `useNearby`: one "import places here" request per cell while the app is open. */
const AREA_DEGREES = 0.02;
const requestedAreas = new Set<string>();

export default function TripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const trip = useQuery(api.trips.get, { tripId: tripId as Id<"trips"> });
  // Set once I leave, decline or delete: the trip is about to vanish from under this screen,
  // and "This trip was deleted" must not flash on the way out.
  const [leaving, setLeaving] = useState(false);

  if (trip === undefined || leaving) {
    return (
      <Screen>
        <ScreenTop title="Trip" />
        <SkeletonRows count={5} />
      </Screen>
    );
  }
  if (trip === null) {
    return (
      <Screen>
        <ScreenTop title="Trip" />
        <EmptyState title="This trip was deleted" icon="users" actionLabel="Back" onAction={goBack} />
      </Screen>
    );
  }
  return (
    <TripBody
      trip={trip}
      onGone={() => {
        setLeaving(true);
        router.dismissTo(paths.trips);
      }}
    />
  );
}

function TripBody({ trip, onGone }: { trip: TripDetail; onGone: () => void }) {
  const me = useMe();
  const { tripId } = trip;
  const isOwner = trip.myStatus === "owner";
  const isIn = isOwner || trip.myStatus === "joined";

  // One sheet for the "⋯" menu and the edit form: opening a second sheet while the first is still
  // closing is unreliable on iOS, so the same sheet swaps what it shows.
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuShows, setMenuShows] = useState<"options" | "edit">("options");
  const openMenu = () => {
    setMenuShows("options");
    setMenuOpen(true);
  };
  const closeMenu = () => setMenuOpen(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  // My vote on picks that are not on the shortlist (a lone 👎 never gets there), as `trips.vote`
  // answered it. Anything on the shortlist is read from the trip itself.
  const [votedHere, setVotedHere] = useState<Record<string, Vote | undefined>>({});

  // Picks are found around the trip's own spot when it has one, then around its city when the
  // backend knows that city, otherwise around me.
  const here = useDemoLocation();
  const spot = trip.lat !== undefined && trip.lng !== undefined ? { lat: trip.lat, lng: trip.lng } : citySpot(trip.city);
  const hasSpot = spot !== undefined;
  const lat = spot?.lat ?? here.lat;
  const lng = spot?.lng ?? here.lng;
  const canPick = isIn && (hasSpot || here.ready);
  const group = useKeptQuery(api.discover.forGroup, canPick ? { tripId, lat, lng } : "skip", tripId);
  // A city nobody has opened on the map has no places yet. Ask for them once; the picks above
  // are live and fill in when the import lands.
  const ensureArea = useMutation(api.ingest.ensureArea);
  const [importing, setImporting] = useState(false);
  const area = `${Math.floor(lat / AREA_DEGREES)}:${Math.floor(lng / AREA_DEGREES)}`;
  useEffect(() => {
    if (!canPick || requestedAreas.has(area)) return;
    requestedAreas.add(area);
    ensureArea({ lat, lng }).then(
      ({ status }) => {
        if (status === "throttled") requestedAreas.delete(area);
        setImporting(status === "scheduled" || status === "importing");
      },
      () => {
        requestedAreas.delete(area);
      },
    );
  }, [canPick, area, lat, lng, ensureArea]);
  // Said under "Picks for the group" when the trip names a city we cannot put on the map.
  const picksNote =
    trip.city && citySpot(trip.city) === undefined
      ? `We can't place ${trip.city} on the map yet, so these picks are from nearby instead.`
      : undefined;

  const respond = useMutationToast(api.trips.respond);
  const vote = useMutationToast(api.trips.vote);
  const leave = useMutationToast(api.trips.leave);
  const remove = useMutationToast(api.trips.remove);
  const busy = leave.pending || remove.pending;

  const myVoteOf = (id: string): Vote | undefined => {
    const listed = trip.shortlist.find((item) => item.id === id);
    return listed ? listed.myVote : votedHere[id];
  };

  const onVote: OnVote = async (kind, id, tapped) => {
    if (vote.pending) return;
    // Tapping the thumb that is already on clears the vote.
    const next = myVoteOf(id) === tapped ? 0 : tapped;
    const result = await vote.run({ tripId, kind, id, vote: next });
    if (result !== undefined) setVotedHere((current) => ({ ...current, [id]: result.myVote }));
  };

  const answer = async (accept: boolean) => {
    const result = await respond.run({ tripId, accept });
    // A declined trip is no longer mine to see.
    if (result !== undefined && !accept) onGone();
  };

  const leaveTrip = async () => {
    const sure = await confirm({
      title: "Leave trip?",
      message: `You will stop seeing ${trip.name} and your votes are removed.`,
      confirmLabel: "Leave",
      destructive: true,
    });
    if (!sure) return;
    const result = await leave.run({ tripId });
    if (result === undefined) return;
    closeMenu();
    onGone();
  };

  const deleteTrip = async () => {
    const sure = await confirm({
      title: "Delete trip?",
      message: `${trip.name} is removed for everyone in it.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!sure) return;
    const result = await remove.run({ tripId });
    if (result === undefined) return;
    closeMenu();
    onGone();
  };

  const facts = [
    formatDateRange(trip.startDate, trip.endDate),
    trip.city ?? "",
    vibeLabel(trip.vibe),
    pluralize(trip.memberCount, "person", "people"),
  ].filter((part) => part !== "");

  return (
    <Screen>
      <View style={styles.top}>
        <ScreenTop
          title={trip.name}
          right={
            isIn ? (
              <IconButton icon="more" accessibilityLabel="Trip options" size={36} onPress={openMenu} />
            ) : undefined
          }
        />
        <Text muted>{facts.join(" · ")}</Text>
      </View>

      {trip.myStatus === "invited" ? (
        <View style={styles.invite}>
          <Text variant="label" style={styles.inviteKicker}>
            Invitation
          </Text>
          <Text variant="title">{`${trip.ownerName} invited you`}</Text>
          <Text muted>Join to see picks that suit the whole group and vote on where to go.</Text>
          <View style={styles.buttons}>
            <Button
              title="Join"
              accessibilityLabel="Join"
              disabled={respond.pending}
              onPress={() => void answer(true)}
              style={styles.flex}
            />
            <Button
              title="Decline"
              accessibilityLabel="Decline"
              variant="ghost"
              disabled={respond.pending}
              onPress={() => void answer(false)}
              style={styles.flex}
            />
          </View>
        </View>
      ) : null}

      <MemberList trip={trip} meId={me?.userId} />

      {isIn ? (
        <Button
          title="Invite friends"
          accessibilityLabel="Invite friends"
          variant="ghost"
          onPress={() => setInviteOpen(true)}
        />
      ) : null}

      {isIn ? (
        <GroupPicks
          group={group}
          meId={me?.userId}
          voteOf={myVoteOf}
          onVote={onVote}
          note={picksNote}
          importing={importing}
        />
      ) : null}

      <Shortlist items={trip.shortlist} canVote={isIn} onVote={onVote} />

      {isIn ? (
        <Button
          title="Plan the night"
          accessibilityLabel="Plan the night"
          onPress={() => router.push(planPath(tripId))}
        />
      ) : null}

      <InviteSheet trip={trip} visible={inviteOpen} onClose={() => setInviteOpen(false)} />

      <Sheet visible={menuOpen} onClose={closeMenu} title={menuShows === "edit" ? "Edit trip" : trip.name}>
        {menuShows === "edit" ? (
          <TripForm trip={trip} onSaved={closeMenu} />
        ) : isOwner ? (
          <>
            <Button
              title="Edit trip"
              accessibilityLabel="Edit trip"
              variant="ghost"
              disabled={busy}
              onPress={() => setMenuShows("edit")}
            />
            <Button
              title="Delete trip"
              accessibilityLabel="Delete trip"
              variant="ghost"
              disabled={busy}
              onPress={() => void deleteTrip()}
            />
          </>
        ) : (
          <Button
            title="Leave trip"
            accessibilityLabel="Leave trip"
            variant="ghost"
            disabled={busy}
            onPress={() => void leaveTrip()}
          />
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { gap: spacing.xs },
  inviteKicker: { color: colors.accent },
  invite: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  buttons: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
});
