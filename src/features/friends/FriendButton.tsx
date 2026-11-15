import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, IconButton, Sheet, Text, useToast } from "../../components";
import { api, type FriendStatus, type Id } from "../../lib/api";
import { confirm } from "../../lib/confirm";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, spacing } from "../../theme";

export type FriendButtonProps = {
  userId: Id<"users">;
  displayName: string;
  /** From the backend (`ProfileResult.user.status`, `UserSearchResult.status`). It alone picks the button. */
  status: FriendStatus;
  requestId?: Id<"friendships">;
  /** Small buttons for a list row. Default is full width, for a profile. */
  compact?: boolean;
  /** The label when `status` is `none`. "Add friend" by default; "Add" on suggestions. */
  addLabel?: string;
};

/**
 * The friend button, driven only by the backend's `status`:
 *   none → "Add friend" · outgoing → "Requested" (tap to take it back) ·
 *   incoming → "Accept" and "Decline" · friends → "Friends" (menu with "Remove friend") · self → nothing.
 * The label changes by itself once the backend has answered.
 */
export function FriendButton({
  userId,
  displayName,
  status,
  requestId,
  compact = false,
  addLabel = "Add friend",
}: FriendButtonProps) {
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const request = useMutationToast(api.friends.request);
  const respond = useMutationToast(api.friends.respond);
  const cancel = useMutationToast(api.friends.cancel);
  const remove = useMutationToast(api.friends.remove);
  const pending = request.pending || respond.pending || cancel.pending || remove.pending;
  // In a list the buttons are small pills that hug their label; on a profile they fill the row.
  const size = compact ? "sm" : "lg";
  const fit = compact ? styles.compact : undefined;
  const slop = compact ? COMPACT_SLOP : undefined;

  if (status === "self") return null;

  if (status === "none") {
    return (
      <Button
        title={addLabel}
        accessibilityLabel={addLabel}
        variant={compact ? "light" : "primary"}
        size={size}
        disabled={pending}
        hitSlop={slop}
        style={fit}
        onPress={async () => {
          const result = await request.run({ userId });
          if (result) toast(result.status === "friends" ? `You and ${displayName} are now friends` : "Request sent", "success");
        }}
      />
    );
  }

  if (status === "outgoing") {
    return (
      <Button
        title="Requested"
        accessibilityLabel="Requested"
        variant="ghost"
        disabled={pending || requestId === undefined}
        size={size}
        hitSlop={slop}
        style={fit}
        onPress={async () => {
          if (requestId === undefined) return;
          const sure = await confirm({
            title: "Take back your friend request?",
            message: `${displayName} won't be told.`,
            confirmLabel: "Take it back",
            cancelLabel: "Keep it",
          });
          if (sure) await cancel.run({ requestId });
        }}
      />
    );
  }

  if (status === "incoming") {
    const answer = (accept: boolean) => async () => {
      if (requestId === undefined) return;
      const result = await respond.run({ requestId, accept });
      if (result !== undefined && accept) toast(`You and ${displayName} are now friends`, "success");
    };
    if (compact) {
      // One tap to accept; declining is the small cross beside it.
      return (
        <View style={styles.pair}>
          <Button
            title="Accept"
            accessibilityLabel="Accept"
            size="sm"
            disabled={pending || requestId === undefined}
            hitSlop={COMPACT_SLOP}
            style={styles.compact}
            onPress={answer(true)}
          />
          <IconButton
            icon="close"
            accessibilityLabel="Decline"
            plain
            size={36}
            color={colors.muted}
            disabled={pending || requestId === undefined}
            onPress={answer(false)}
          />
        </View>
      );
    }
    return (
      <View style={[styles.pair, styles.pairWide]}>
        <Button
          title="Accept"
          accessibilityLabel="Accept"
          disabled={pending || requestId === undefined}
          style={styles.half}
          onPress={answer(true)}
        />
        <Button
          title="Decline"
          accessibilityLabel="Decline"
          variant="ghost"
          disabled={pending || requestId === undefined}
          style={styles.half}
          onPress={answer(false)}
        />
      </View>
    );
  }

  return (
    <>
      <Button
        title="Friends"
        accessibilityLabel="Friends"
        variant="ghost"
        disabled={pending}
        size={size}
        hitSlop={slop}
        style={fit}
        onPress={() => setMenuOpen(true)}
      />
      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={displayName}>
        <Text muted>You are friends. You see each other&apos;s rankings and posts.</Text>
        <Button
          title="Remove friend"
          accessibilityLabel="Remove friend"
          variant="ghost"
          disabled={pending}
          onPress={async () => {
            const result = await remove.run({ userId });
            if (result !== undefined) {
              setMenuOpen(false);
              toast(`Removed ${displayName}`, "info");
            }
          }}
        />
        <Button title="Close" accessibilityLabel="Close" variant="link" style={styles.close} onPress={() => setMenuOpen(false)} />
      </Sheet>
    </>
  );
}

/** A list button is 36 tall; this makes what the thumb can hit 48. */
const COMPACT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };

const styles = StyleSheet.create({
  compact: { width: "auto", paddingHorizontal: 16 },
  pair: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pairWide: { width: "100%" },
  half: { flex: 1, width: "auto" },
  close: { alignSelf: "center" },
});
