import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { useConvexAuth, useMutation } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput } from "react-native";
import { api } from "../../convex/_generated/api";
import { BackButton, Button, Screen, Text } from "../components/bryan";
import { APP_NAME } from "../constants/brand";
import { colors, radius, spacing } from "../theme";

/** Sign up (username, password, display name, birthday, home city) or sign in. UI-SPEC §1. */
export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<"signup" | "signin">(params.mode === "signin" ? "signin" : "signup");
  const { isAuthenticated } = useConvexAuth();
  const { signIn, pending: signingIn } = useSignInWithUsernamePassword(api.auth);
  const { signUp, pending: signingUp } = useSignUpWithUsernamePassword(api.auth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [error, setError] = useState<string | null>(null);

  const updateSettings = useMutation(api.settings.update);
  // The sign-up hook only takes credentials, so the profile fields go through settings.update
  // once the session exists (UI-SPEC §1 fallback). The root layout then picks quiz vs tabs.
  const [pendingProfile, setPendingProfile] = useState<{ displayName?: string; birthday?: string; homeCity?: string } | null>(null);
  useEffect(() => {
    if (!isAuthenticated) return;
    const finish = () => router.replace("/");
    if (pendingProfile) updateSettings(pendingProfile).then(finish, finish);
    else finish();
  }, [isAuthenticated, pendingProfile, updateSettings]);

  const pending = signingIn || signingUp;
  const signingUpMode = mode === "signup";

  const submit = async () => {
    setError(null);
    if (signingUpMode && birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      setError("Birthday should look like 2006-04-21.");
      return;
    }
    try {
      if (signingUpMode) {
        setPendingProfile({
          displayName: displayName || undefined,
          birthday: birthday || undefined,
          homeCity: homeCity || undefined,
        });
      }
      const result = signingUpMode ? await signUp({ username, password }) : await signIn({ username, password });
      if (result.status === "error") {
        setPendingProfile(null);
        setError(result.userError.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const field = (props: React.ComponentProps<typeof TextInput>) => (
    <TextInput style={styles.input} placeholderTextColor={colors.muted} autoCapitalize="none" {...props} />
  );

  return (
    <Screen edges={["top", "bottom"]}>
      <BackButton />
      <Text variant="heading">{signingUpMode ? `Join ${APP_NAME}` : `Sign in to ${APP_NAME}`}</Text>
      {field({ placeholder: "Username", autoComplete: "username", value: username, onChangeText: setUsername })}
      {field({ placeholder: "Password", secureTextEntry: true, autoComplete: "password", value: password, onChangeText: setPassword })}
      {signingUpMode && (
        <>
          {field({ placeholder: "Display name", autoCapitalize: "words", value: displayName, onChangeText: setDisplayName })}
          {field({ placeholder: "Birthday (YYYY-MM-DD)", keyboardType: "numbers-and-punctuation", value: birthday, onChangeText: setBirthday })}
          {field({ placeholder: "Home city", autoCapitalize: "words", value: homeCity, onChangeText: setHomeCity })}
          <Text variant="caption" muted>
            Birthday keeps 21+ spots away from under-21s. Home city marks you as a local there.
          </Text>
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <Button
        title={signingUpMode ? "Create account" : "Sign in"}
        disabled={pending || !username || !password}
        onPress={submit}
      />
      <Pressable accessibilityRole="button" onPress={() => setMode(signingUpMode ? "signin" : "signup")}>
        <Text center muted>
          {signingUpMode ? "Have an account? Sign in" : "New here? Create account"}
        </Text>
      </Pressable>
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
