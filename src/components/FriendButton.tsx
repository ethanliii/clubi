import { useMutation } from "convex/react";
import { Alert, StyleSheet, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { FriendStatus } from "../../convex/lib/contract";
import { Button } from "./Button";

/**
 * The friend button follows `status` (UI-SPEC §9): Add friend → Requested → Accept / Decline → Friends.
 * Private accounts use this flow. "Follow" for public accounts needs the backend follow ask (Q20).
 */
export function FriendButton({ userId, status, requestId, compact }: {
  userId: Id<"users">; status: FriendStatus; requestId?: Id<"friendships">; compact?: boolean;
}) {
  const request = useMutation(api.friends.request);
  const cancel = useMutation(api.friends.cancel);
  const respond = useMutation(api.friends.respond);
  const remove = useMutation(api.friends.remove);
  const run = (p: Promise<unknown>) => p.catch((e: unknown) => Alert.alert("Something went wrong", e instanceof Error ? e.message : "Try again"));
  const style = compact ? styles.compact : undefined;

  if (status === "self") return null;
  if (status === "none") return <Button title={compact ? "Add" : "Add friend"} style={style} onPress={() => run(request({ userId }))} />;
  if (status === "outgoing")
    return (
      <Button title="Requested" variant="ghost" style={style} onPress={() =>
        requestId && Alert.alert("Cancel request?", undefined, [
          { text: "Keep", style: "cancel" },
          { text: "Cancel request", style: "destructive", onPress: () => run(cancel({ requestId })) },
        ])} />
    );
  if (status === "incoming" && requestId)
    return (
      <View style={styles.row}>
        <Button title="Accept" style={[style, { flex: 1, width: "auto" }]} onPress={() => run(respond({ requestId, accept: true }))} />
        <Button title="Decline" variant="ghost" style={[style, { flex: 1, width: "auto" }]} onPress={() => run(respond({ requestId, accept: false }))} />
      </View>
    );
  return (
    <Button title="Friends" variant="ghost" style={style} onPress={() =>
      Alert.alert("Friends", undefined, [
        { text: "Close", style: "cancel" },
        { text: "Remove friend", style: "destructive", onPress: () => run(remove({ userId })) },
      ])} />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  compact: { width: "auto", paddingVertical: 8, paddingHorizontal: 14 },
});
