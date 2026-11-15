import { router } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Avatar, Button, Chip, ChipRow, Skeleton, Text } from "../../components";
import type { FriendItem, Id } from "../../lib/api";
import { paths } from "../../lib/links";
import { radius, spacing } from "../../theme";

/**
 * "Who's coming": one chip per friend from `api.friends.list`, tap to add or take away.
 * `leading` goes first (the "You" chip). `onNavigate` runs before "Find friends" leaves the screen,
 * so a sheet can close itself.
 */
export function FriendChips({
  friends,
  selected,
  onToggle,
  leading,
  onNavigate,
}: {
  /** undefined while `friends.list` is loading. */
  friends: FriendItem[] | undefined;
  selected: Id<"users">[];
  onToggle: (userId: Id<"users">) => void;
  leading?: ReactNode;
  onNavigate?: () => void;
}) {
  if (friends === undefined) {
    return (
      <ChipRow>
        {leading}
        <Skeleton width={96} height={40} round={radius.pill} />
        <Skeleton width={120} height={40} round={radius.pill} />
        <Skeleton width={88} height={40} round={radius.pill} />
      </ChipRow>
    );
  }
  if (friends.length === 0) {
    return (
      <View style={{ gap: spacing.sm }}>
        {leading ? <ChipRow>{leading}</ChipRow> : null}
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
    <ChipRow>
      {leading}
      {friends.map((friend) => (
        <Chip
          key={friend.userId}
          label={friend.displayName}
          accessibilityLabel={friend.displayName}
          selected={selected.includes(friend.userId)}
          leading={<Avatar name={friend.displayName} uri={friend.avatarUrl} size={22} />}
          onPress={() => onToggle(friend.userId)}
        />
      ))}
    </ChipRow>
  );
}

/** Add the id when it is missing, take it out when it is there. */
export function toggleId(list: Id<"users">[], userId: Id<"users">): Id<"users">[] {
  return list.includes(userId) ? list.filter((id) => id !== userId) : [...list, userId];
}
