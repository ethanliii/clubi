import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Skeleton, Text } from "../../components";
import type { FriendItem, Id } from "../../lib/api";
import { paths } from "../../lib/links";
import { spacing } from "../../theme";
import { Face, FaceRow } from "./Faces";
import { GUTTER } from "./Page";

/**
 * "Who's coming": one face per friend from `api.friends.list`, tap to add or take away.
 * `leading` goes first (my own face). `onNavigate` runs before "Find friends" leaves the screen,
 * so a sheet can close itself.
 */
export function FriendChips({
  friends,
  selected,
  onToggle,
  leading,
  onNavigate,
  inset = GUTTER,
}: {
  /** undefined while `friends.list` is loading. */
  friends: FriendItem[] | undefined;
  selected: Id<"users">[];
  onToggle: (userId: Id<"users">) => void;
  leading?: ReactNode;
  onNavigate?: () => void;
  /** The side margin of whatever holds the row, so it can run off both edges. */
  inset?: number;
}) {
  if (friends === undefined) {
    return (
      <View style={styles.loading}>
        {leading}
        <Skeleton width={56} height={56} round={28} />
        <Skeleton width={56} height={56} round={28} />
        <Skeleton width={56} height={56} round={28} />
      </View>
    );
  }
  if (friends.length === 0) {
    return (
      <View style={styles.none}>
        {leading ? <View style={styles.loading}>{leading}</View> : null}
        <Text muted>Add friends to bring them along.</Text>
        <Button
          title="Find friends"
          accessibilityLabel="Find friends"
          variant="ghost"
          onPress={() => {
            onNavigate?.();
            router.push(paths.friends);
          }}
        />
      </View>
    );
  }
  return (
    <FaceRow inset={inset}>
      {leading}
      {friends.map((friend) => (
        <Face
          key={friend.userId}
          name={friend.displayName}
          uri={friend.avatarUrl}
          selected={selected.includes(friend.userId)}
          onPress={() => onToggle(friend.userId)}
        />
      ))}
    </FaceRow>
  );
}

/** Add the id when it is missing, take it out when it is there. */
export function toggleId(list: Id<"users">[], userId: Id<"users">): Id<"users">[] {
  return list.includes(userId) ? list.filter((id) => id !== userId) : [...list, userId];
}

const styles = StyleSheet.create({
  loading: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  none: { gap: spacing.sm },
});
