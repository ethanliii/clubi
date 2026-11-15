import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { api } from "../../convex/_generated/api";
import { BackButton, Button, Screen, Text, TextField } from "../components";
import { APP_NAME } from "../constants/brand";
import { authErrorMessage } from "../lib/errors";

type Mode = "signup" | "signin";

/**
 * Sign up or sign in. Nothing navigates from here: once the backend says we are signed in,
 * the root layout swaps this screen for the quiz (new account) or the tabs.
 */
export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === "signup" ? "signup" : "signin");
  const { signIn, pending: signingIn } = useSignInWithUsernamePassword(api.auth);
  const { signUp, pending: signingUp } = useSignUpWithUsernamePassword(api.auth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pending = signingIn || signingUp;
  const isSignUp = mode === "signup";

  const submit = async () => {
    setError(null);
    const name = username.trim();
    if (name === "" || password === "") {
      setError("Enter a username and a password.");
      return;
    }
    if (isSignUp && birthday.trim() !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(birthday.trim())) {
      setError("Birthday must look like 2004-10-23, or leave it empty.");
      return;
    }
    // The three extra fields are optional and left out when empty; the backend rejects unknown ones only.
    const account = {
      username: name,
      password,
      ...(displayName.trim() !== "" ? { displayName: displayName.trim() } : {}),
      ...(birthday.trim() !== "" ? { birthday: birthday.trim() } : {}),
      ...(homeCity.trim() !== "" ? { homeCity: homeCity.trim() } : {}),
    };
    const result = isSignUp ? await signUp(account) : await signIn({ username: name, password });
    if (result.status === "error") setError(authErrorMessage(result.userError));
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <BackButton />
      <Text variant="heading">{isSignUp ? `Join ${APP_NAME}` : `Sign in to ${APP_NAME}`}</Text>
      <TextField
        label="Username"
        placeholder="Username"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        value={username}
        onChangeText={setUsername}
      />
      <TextField
        label="Password"
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete={isSignUp ? "new-password" : "current-password"}
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={isSignUp ? undefined : () => void submit()}
      />
      {isSignUp ? (
        <>
          <TextField
            label="Display name"
            placeholder="What friends see (optional)"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <TextField
            label="Birthday"
            placeholder="YYYY-MM-DD (optional)"
            autoCapitalize="none"
            autoCorrect={false}
            value={birthday}
            onChangeText={setBirthday}
          />
          <TextField
            label="Home city"
            placeholder="Where you're a local (optional)"
            value={homeCity}
            onChangeText={setHomeCity}
          />
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={isSignUp ? "Sign up" : "Sign in"}
        accessibilityLabel={isSignUp ? "Sign up" : "Sign in"}
        disabled={pending}
        onPress={() => void submit()}
      />
      <Button
        title={isSignUp ? "Have an account? Sign in" : "New here? Sign up"}
        accessibilityLabel={isSignUp ? "Have an account? Sign in" : "New here? Sign up"}
        variant="link"
        disabled={pending}
        style={styles.switch}
        onPress={() => {
          setError(null);
          setMode(isSignUp ? "signin" : "signup");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: "#ff6b6b" },
  switch: { alignSelf: "center" },
});
