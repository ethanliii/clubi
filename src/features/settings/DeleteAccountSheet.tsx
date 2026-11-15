import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { Button, Sheet, Text, TextField } from "../../components";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/errors";

/**
 * "Delete account": type the username, then "Delete forever" (enabled only when it matches) calls
 * `api.settings.deleteAccount({ confirmUsername })` and signs out. The session gate goes to Welcome.
 */
export function DeleteAccountSheet({
  visible,
  onClose,
  username,
}: {
  visible: boolean;
  onClose: () => void;
  username: string;
}) {
  const { signOut } = useAuthActions();
  const deleteAccount = useMutation(api.settings.deleteAccount);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // The backend compares the same way: trimmed, without a leading @, ignoring capitals.
  const matches = username !== "" && typed.trim().replace(/^@/, "").toLowerCase() === username.toLowerCase();

  const close = () => {
    setTyped("");
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!matches || pending) return;
    setError(null);
    setPending(true);
    try {
      await deleteAccount({ confirmUsername: typed.trim() });
    } catch (thrown) {
      setError(errorMessage(thrown));
      setPending(false);
      return;
    }
    // The account is gone. Drop the session; the gate shows Welcome. Nothing navigates from here.
    try {
      await signOut();
    } catch {
      // Already signed out by the backend.
    }
  };

  return (
    <Sheet visible={visible} onClose={close} title="Delete account">
      <Text>
        This removes your rankings, posts, friendships and answers for good. It can&apos;t be undone.
      </Text>
      <TextField
        label="Type your username to confirm"
        placeholder={username}
        accessibilityLabel="Type your username to confirm"
        autoCapitalize="none"
        autoCorrect={false}
        value={typed}
        onChangeText={setTyped}
        error={error}
      />
      <Button
        title="Delete forever"
        accessibilityLabel="Delete forever"
        disabled={!matches || pending}
        style={styles.danger}
        onPress={() => void submit()}
      />
      <Button title="Keep my account" accessibilityLabel="Keep my account" variant="ghost" disabled={pending} onPress={close} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  danger: { backgroundColor: "#d9364f" },
});
