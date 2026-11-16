/**
 * "Change group": pick who the map is for. Two parts in one sheet: "Your plans" (tap one and the
 * map switches to it) and "Pick friends" (tick a few, then either look at picks for them without
 * saving anything, or name the group and save it as a plan).
 */
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  Avatar,
  AvatarStack,
  Button,
  Icon,
  ListRow,
  SectionHeader,
  Sheet,
  SkeletonRows,
  Text,
  TextField,
} from "../../components";
import { api, type Id, type TripSummary } from "../../lib/api";
import { formatDateRange, pluralize } from "../../lib/format";
import { paths } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, palette, spacing } from "../../theme";
import { MAX_FRIENDS, firstName, type GroupChoice } from "./group";

function tripLine(trip: TripSummary): string {
  return [
    pluralize(trip.memberCount, "person", "people"),
    trip.city ?? "",
    formatDateRange(trip.startDate, trip.endDate),
    trip.myStatus === "invited" ? "Invited" : "",
  ]
    .filter((part) => part !== "")
    .join(" · ");
}

/** The round tick at the end of a friend's row. */
function Tick({ on }: { on: boolean }) {
  return <View style={[styles.tick, on && styles.tickOn]}>{on ? <Icon name="check" size={14} color={colors.white} /> : null}</View>;
}

export function GroupPicker({
  visible,
  onClose,
  current,
  onChoose,
}: {
  visible: boolean;
  onClose: () => void;
  /** The group on the map now, so it can be marked. */
  current: GroupChoice | null;
  onChoose: (choice: GroupChoice) => void;
}) {
  const trips = useQuery(api.trips.list, visible ? {} : "skip");
  // A plan with nobody else in it is not a group.
  const plans = trips?.filter((trip) => trip.memberCount >= 2);
  const overview = useQuery(api.friends.list, visible ? {} : "skip");
  const [picked, setPicked] = useState<Id<"users">[]>(() => (current?.kind === "friends" ? current.memberIds : []));
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const create = useMutationToast(api.trips.create, { success: "Plan saved" });

  const friends = overview?.friends ?? [];
  const chosen = friends.filter((friend) => picked.includes(friend.userId));
  const full = picked.length >= MAX_FRIENDS;
  const currentTrip = current?.kind === "trip" ? current.tripId : null;

  const toggle = (userId: Id<"users">) =>
    setPicked((ids) => (ids.includes(userId) ? ids.filter((id) => id !== userId) : ids.length >= MAX_FRIENDS ? ids : [...ids, userId]));

  const close = () => {
    setNaming(false);
    setNameError(null);
    onClose();
  };

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed === "") {
      setNameError("Give the plan a name");
      return;
    }
    const result = await create.run({ name: trimmed, memberIds: picked });
    if (result === undefined) return;
    setNaming(false);
    setName("");
    onChoose({ kind: "trip", tripId: result.tripId });
  };

  if (naming) {
    return (
      <Sheet visible={visible} onClose={close} title="Save as a plan">
        <View style={styles.who}>
          <AvatarStack people={chosen} max={5} size={32} />
          <Text muted numberOfLines={2} style={styles.flex}>
            {`You and ${chosen.map((friend) => firstName(friend.displayName)).join(", ")}`}
          </Text>
        </View>
        <TextField
          label="Plan name"
          placeholder="Friday night"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setNameError(null);
          }}
          error={nameError}
          autoFocus
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={() => void save()}
        />
        <Text variant="caption" muted>
          They get an invite. The map counts each friend once they join.
        </Text>
        <Button title="Save plan" accessibilityLabel="Save plan" loading={create.pending} disabled={create.pending} onPress={() => void save()} />
        <Button title="Back" accessibilityLabel="Back to friends" variant="quiet" size="md" onPress={() => setNaming(false)} />
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={close} title={current === null ? "Who's going?" : "Change group"} scroll={false}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.scroller}>
        <SectionHeader title="Your plans" />
        {plans === undefined ? (
          <SkeletonRows count={2} />
        ) : plans.length === 0 ? (
          <Text muted style={styles.note}>
            No plans yet. Pick friends below and save them as a plan.
          </Text>
        ) : (
          plans.map((trip, index) => (
            <ListRow
              key={trip.tripId}
              title={trip.name}
              subtitle={tripLine(trip)}
              accessibilityLabel={`Show picks for ${trip.name}`}
              divider={index < plans.length - 1}
              left={
                <View style={styles.planIcon}>
                  <Icon name="users" size={20} color={colors.accent} />
                </View>
              }
              right={<Icon name={trip.tripId === currentTrip ? "check" : "chevron"} size={18} color={trip.tripId === currentTrip ? colors.accent : colors.low} />}
              onPress={() => onChoose({ kind: "trip", tripId: trip.tripId })}
            />
          ))
        )}

        <View style={styles.gap} />
        <SectionHeader title="Pick friends" />
        {overview === undefined ? (
          <SkeletonRows count={3} />
        ) : friends.length === 0 ? (
          <View style={styles.noFriends}>
            <Text muted style={styles.note}>
              Add friends to see what works for all of you.
            </Text>
            <Button
              title="Find friends"
              accessibilityLabel="Find friends"
              variant="secondary"
              size="md"
              onPress={() => {
                close();
                router.push(paths.friends);
              }}
            />
          </View>
        ) : (
          friends.map((friend, index) => {
            const on = picked.includes(friend.userId);
            return (
              <ListRow
                key={friend.userId}
                title={friend.displayName}
                subtitle={friend.tasteMatchPct !== undefined ? `${friend.tasteMatchPct}% taste match` : `@${friend.username}`}
                accessibilityLabel={`${on ? "Remove" : "Add"} ${friend.displayName}`}
                divider={index < friends.length - 1}
                left={<Avatar name={friend.displayName} uri={friend.avatarUrl} size={44} />}
                right={<Tick on={on} />}
                style={!on && full ? styles.dimmed : undefined}
                onPress={() => toggle(friend.userId)}
              />
            );
          })
        )}
      </ScrollView>

      {friends.length > 0 ? (
        <View style={styles.footer}>
          {picked.length > 0 ? (
            <Text variant="caption" muted center>
              {full
                ? `You and ${picked.length} friends: that's the most a group can be.`
                : `You and ${pluralize(picked.length, "friend")}`}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show picks"
            accessibilityState={{ disabled: picked.length === 0 }}
            disabled={picked.length === 0}
            onPress={() => onChoose({ kind: "friends", memberIds: picked })}
            style={({ pressed }) => [styles.primary, picked.length === 0 && styles.primaryOff, pressed && styles.primaryPressed]}
          >
            <Text style={[styles.primaryText, picked.length === 0 && styles.primaryTextOff]}>Show picks</Text>
          </Pressable>
          {picked.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save as a plan"
              hitSlop={8}
              onPress={() => setNaming(true)}
              style={({ pressed }) => [styles.link, pressed && styles.primaryPressed]}
            >
              <Text style={styles.linkText}>Save as a plan</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  scroller: { flexGrow: 0, flexShrink: 1 },
  gap: { height: spacing.lg },
  note: { paddingVertical: spacing.sm },
  noFriends: { gap: spacing.sm, paddingBottom: spacing.sm },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  tick: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  tickOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  dimmed: { opacity: 0.4 },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.hairline,
  },
  primary: { height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  primaryOff: { backgroundColor: palette.field },
  primaryPressed: { opacity: 0.8 },
  primaryText: { fontSize: 16, lineHeight: 21, fontWeight: "700", color: colors.white },
  primaryTextOff: { color: colors.muted },
  link: { alignSelf: "center", minHeight: 32, justifyContent: "center", marginTop: 4 },
  linkText: { fontSize: 15, lineHeight: 20, fontWeight: "600", color: colors.accent },
  who: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
