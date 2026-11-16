import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { Button, Sheet, Text, TextField, useToast } from "../../components";
import { api } from "../../lib/api";
import { authErrorMessage, errorMessage } from "../../lib/errors";
import { palette } from "../../theme";

type ChangePasswordFailure = Extract<FunctionReturnType<typeof api.auth.changePassword>, { success: false }>;

/** A sentence for each way `api.auth.changePassword` says no. */
function passwordErrorMessage(userError: ChangePasswordFailure["userError"]): string {
  switch (userError.error) {
    case "INVALID_CREDENTIALS":
      return "That isn't your current password.";
    case "NOT_LOGGED_IN":
      return "You're signed out. Sign in and try again.";
    case "PASSWORD_TOO_COMMON":
      return "That password is too easy to guess. Pick another.";
    default:
      return authErrorMessage(userError);
  }
}

/**
 * "Change password": the current password, the new one, then
 * `api.auth.changePassword({ currentPassword, newPassword })`, which answers
 * `{ success: true }` or `{ success: false, userError }`.
 */
export function PasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const changePassword = useMutation(api.auth.changePassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    setCurrentPassword("");
    setNewPassword("");
    setError(null);
    onClose();
  };

  const submit = async () => {
    setError(null);
    if (currentPassword === "" || newPassword === "") {
      setError("Enter your current password and a new one.");
      return;
    }
    setPending(true);
    try {
      const result = await changePassword({ currentPassword, newPassword });
      if (result.success) {
        close();
        toast("Password updated", "success");
      } else {
        setError(passwordErrorMessage(result.userError));
      }
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={close} title="Change password">
      <TextField
        label="Current password"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
      />
      <TextField
        label="New password"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        value={newPassword}
        onChangeText={setNewPassword}
        onSubmitEditing={() => void submit()}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title="Update password"
        accessibilityLabel="Update password"
        loading={pending}
        onPress={() => void submit()}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  error: { color: palette.danger },
});
