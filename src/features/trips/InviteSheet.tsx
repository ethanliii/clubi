import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Avatar, Button, EmptyState, Icon, Sheet, SkeletonRows, Text, useToast } from "../../components";
import { api, type Id, type TripDetail } from "../../lib/api";
import { pluralize } from "../../lib/format";
import { paths } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, spacing } from "../../theme";
import { toggleId } from "./FriendChips";

type Person = { userId: Id<"users">; displayName: string; avatarUrl?: string };

function PersonRow({
  person,
  subtitle,
  local = false,
  selected,
  note,
  onPress,
}: {
  person: Person;
  subtitle: string;
  local?: boolean;
  selected: boolean;
  /** Set for someone already on the trip ("Joined", "Invited"): the row is shown but cannot be picked. */
  note?: string;
  onPress: () => void;
}) {
  const locked = note !== undefined;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={person.displayName}
      accessibilityState={{ checked: selected, disabled: locked }}
      disabled={locked}
      onPress={onPress}
      style={({ pressed }) => [styles.row, (pressed || locked) && styles.dimmed]}
    >
      <Avatar name={person.displayName} uri={person.avatarUrl} size={44} />
      <View style={styles.rowText}>
        <View style={styles.nameLine}>
          <Text numberOfLines={1} style={styles.name}>
            {person.displayName}
          </Text>
          {local ? (
            <Text variant="caption" style={styles.local}>
              Local
            </Text>
          ) : null}
        </View>
        <Text variant="caption" muted numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      {locked ? (
        <Text variant="caption" muted>
          {note}
        </Text>
      ) : (
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected ? <Icon name="check" size={16} color={colors.white} /> : null}
        </View>
      )}
    </Pressable>
  );
}

/**
 * "Invite friends": the backend's suggestions on top (with its reason and a "Local" mark),
 * then every friend. Pick any number, then "Send invites" → `api.trips.invite`.
 */
export function InviteSheet({
  trip,
  visible,
  onClose,
}: {
  trip: TripDetail;
  visible: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const suggestions = useQuery(api.trips.suggestMembers, visible ? { tripId: trip.tripId } : "skip");
  const overview = useQuery(api.friends.list, visible ? {} : "skip");
  const invite = useMutationToast(api.trips.invite);
  const [selected, setSelected] = useState<Id<"users">[]>([]);

  const close = () => {
    setSelected([]);
    onClose();
  };

  const send = async () => {
    const result = await invite.run({ tripId: trip.tripId, userIds: selected });
    if (result === undefined) return;
    toast(
      result.invited > 0 ? `Invited ${pluralize(result.invited, "friend")}` : "They are already on this trip",
      result.invited > 0 ? "success" : "info",
    );
    close();
  };

  const loading = suggestions === undefined || overview === undefined;
  const friends = overview?.friends ?? [];
  const suggestedIds = new Set((suggestions ?? []).map((person) => person.userId));
  const statusOf = new Map(trip.members.map((member) => [member.userId, member]));
  const others = friends.filter((friend) => !suggestedIds.has(friend.userId));

  return (
    <Sheet visible={visible} onClose={close} title="Invite friends" scroll={false}>
      {loading ? (
        <SkeletonRows count={4} />
      ) : friends.length === 0 ? (
        <EmptyState
          title="No friends to invite yet."
          body="Add friends first, then bring them along."
          actionLabel="Find friends"
          onAction={() => {
            close();
            router.push(paths.friends);
          }}
        />
      ) : (
        <>
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {suggestions.length > 0 ? (
              <>
                <Text style={styles.section}>Suggested</Text>
                {suggestions.map((person) => (
                  <PersonRow
                    key={person.userId}
                    person={person}
                    subtitle={person.reason}
                    local={person.isLocal}
                    selected={selected.includes(person.userId)}
                    onPress={() => setSelected((current) => toggleId(current, person.userId))}
                  />
                ))}
              </>
            ) : null}
            {others.length > 0 ? (
              <>
                <Text style={styles.section}>{suggestions.length > 0 ? "All friends" : "Friends"}</Text>
                {others.map((friend) => {
                  const member = statusOf.get(friend.userId);
                  const note =
                    member === undefined || member.status === "declined"
                      ? undefined
                      : member.status === "invited"
                        ? "Invited"
                        : "Joined";
                  return (
                    <PersonRow
                      key={friend.userId}
                      person={friend}
                      subtitle={member?.status === "declined" ? "Declined the last invite" : `@${friend.username}`}
                      selected={selected.includes(friend.userId)}
                      note={note}
                      onPress={() => setSelected((current) => toggleId(current, friend.userId))}
                    />
                  );
                })}
              </>
            ) : null}
          </ScrollView>
          <Button
            title="Send invites"
            accessibilityLabel="Send invites"
            disabled={selected.length === 0 || invite.pending}
            onPress={() => void send()}
          />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0 },
  section: { marginTop: spacing.md, marginBottom: spacing.xs, fontSize: 13, fontWeight: "600", color: colors.muted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.sm,
  },
  dimmed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 2 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { flexShrink: 1, fontSize: 16, fontWeight: "600" },
  local: { color: colors.ok, fontWeight: "600" },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
