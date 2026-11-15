import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { useConvexAuth } from "convex/react";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { api } from "../../convex/_generated/api";
import { BackButton, Button, Screen, Text } from "../components";
import { APP_NAME } from "../constants/brand";
import { colors, radius, spacing } from "../theme";

export default function SignIn() {
  const { isAuthenticated } = useConvexAuth();
  const { signIn, pending: signingIn } = useSignInWithUsernamePassword(api.auth);
  const { signUp, pending: signingUp } = useSignUpWithUsernamePassword(api.auth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) router.replace("/");
  }, [isAuthenticated]);

  const submit = async (run: typeof signIn | typeof signUp) => {
    setError(null);
    const result = await run({ username, password });
    if (result.status === "error") {
      setError(result.userError.error);
    }
  };

  const pending = signingIn || signingUp;
  return (
    <Screen edges={["top", "bottom"]}>
      <BackButton />
      <Text variant="heading">Sign in to {APP_NAME}</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoComplete="username"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.muted}
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="Sign in" disabled={pending} onPress={() => submit(signIn)} />
      <Button title="Create account" variant="ghost" disabled={pending} onPress={() => submit(signUp)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.fg,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  error: { color: "#ff6b6b" },
});
