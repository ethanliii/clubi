import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Sheet, Text, useToast } from "../../components";
import { api, type FriendStatus, type Id } from "../../lib/api";
import { confirm } from "../../lib/confirm";
import { useMutationToast } from "../../lib/useMutationToast";
import { spacing } from "../../theme";
import { RowButton } from "./RowButton";

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

  if (status === "self") return null;

  if (status === "none") {
    const add = async () => {
      const result = await request.run({ userId });
      if (result) toast(result.status === "friends" ? `You and ${displayName} are now friends` : "Request sent", "success");
    };
    if (compact) return <RowButton title={addLabel} kind="solid" disabled={pending} onPress={() => void add()} />;
    return <Button title={addLabel} accessibilityLabel={addLabel} disabled={pending} onPress={add} />;
  }

  if (status === "outgoing") {
    const takeBack = async () => {
      if (requestId === undefined) return;
      const sure = await confirm({
        title: "Take back your friend request?",
        message: `${displayName} won't be told.`,
        confirmLabel: "Take it back",
        cancelLabel: "Keep it",
      });
      if (sure) await cancel.run({ requestId });
    };
    const off = pending || requestId === undefined;
    if (compact) return <RowButton title="Requested" kind="soft" disabled={off} onPress={() => void takeBack()} />;
    return <Button title="Requested" accessibilityLabel="Requested" variant="secondary" disabled={off} onPress={takeBack} />;
  }

  if (status === "incoming") {
    const answer = (accept: boolean) => async () => {
      if (requestId === undefined) return;
      const result = await respond.run({ requestId, accept });
      if (result !== undefined && accept) toast(`You and ${displayName} are now friends`, "success");
    };
    const off = pending || requestId === undefined;
    if (compact) {
      // The solid button says yes; the quiet word beside it says no.
      return (
        <View style={styles.pairCompact}>
          <RowButton title="Accept" kind="solid" disabled={off} onPress={() => void answer(true)()} />
          <RowButton title="Decline" kind="quiet" disabled={off} onPress={() => void answer(false)()} />
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
      {compact ? (
        <RowButton title="Friends" kind="outline" disabled={pending} onPress={() => setMenuOpen(true)} />
      ) : (
        <Button
          title="Friends"
          accessibilityLabel="Friends"
          variant="secondary"
          disabled={pending}
          onPress={() => setMenuOpen(true)}
        />
      )}
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

const styles = StyleSheet.create({
  pair: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pairCompact: { flexDirection: "row", alignItems: "center", gap: 2 },
  pairWide: { width: "100%" },
  half: { flex: 1, width: "auto" },
  close: { alignSelf: "center" },
});
