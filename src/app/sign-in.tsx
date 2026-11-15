import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, StyleSheet, View, type TextInput } from "react-native";
import { api } from "../../convex/_generated/api";
import { BackButton, Text, TextField } from "../components";
import { APP_NAME } from "../constants/brand";
import { birthdayProblem, formatBirthdayInput } from "../features/auth/birthday";
import { FormScreen } from "../features/auth/FormScreen";
import { SpinnerButton } from "../features/onboarding/SpinnerButton";
import { authErrorMessage } from "../lib/errors";
import { spacing } from "../theme";

type Mode = "signup" | "signin";
type Errors = { username?: string; password?: string; birthday?: string; form?: string };
type AuthUserError = Parameters<typeof authErrorMessage>[0];

/** Convex Auth's default (node_modules/@convex-dev/auth/src/lib/password.ts). The backend has the last word. */
const PASSWORD_HINT = "10 characters or more.";
/** How long to wait for the account to load after a good sign-in before letting the user try again. */
const ENTER_TIMEOUT_MS = 15_000;

/** Put a failed sign-in or sign-up under the field it is about, or on the line above the button. */
function placeError(userError: AuthUserError): Errors {
  const message = authErrorMessage(userError);
  if (userError.error.startsWith("USERNAME_") || userError.error === "USER_NOT_FOUND") return { username: message };
  if (userError.error.startsWith("PASSWORD_")) return { password: message };
  return { form: message };
}

/**
 * Sign up or sign in (docs/UI-SPEC.md section 1). Nothing navigates from here: once the backend says
 * we are signed in, the root layout swaps this screen for the quiz (new account) or the tabs.
 */
export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === "signup" ? "signup" : "signin");
  const { signIn, pending: signingIn } = useSignInWithUsernamePassword(api.auth);
  const { signUp, pending: signingUp } = useSignUpWithUsernamePassword(api.auth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  // True between a good sign-in and the root layout taking this screen away.
  const [entering, setEntering] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const displayNameRef = useRef<ComponentRef<typeof TextInput>>(null);

  const isSignUp = mode === "signup";
  const busy = signingIn || signingUp || entering;

  useEffect(() => {
    if (!entering) return;
    const timer = setTimeout(() => {
      setEntering(false);
      setErrors({ form: "You're signed in, but your account didn't load. Check your connection and try again." });
    }, ENTER_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [entering]);

  const clear = (field: keyof Errors) =>
    setErrors((current) => (current[field] || current.form ? { ...current, [field]: undefined, form: undefined } : current));

  const submit = async () => {
    if (busy) return;
    const name = username.trim();
    const found: Errors = {};
    if (name === "") found.username = isSignUp ? "Pick a username." : "Enter your username.";
    if (password === "") found.password = isSignUp ? "Pick a password." : "Enter your password.";
    if (isSignUp) {
      const problem = birthdayProblem(birthday, new Date());
      if (problem) found.birthday = problem;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    let result;
    if (isSignUp) {
      // The three extra fields are optional: left out when empty, because the backend takes
      // "YYYY-MM-DD or nothing" for the birthday and falls back to the username for the name.
      const account = {
        username: name,
        password,
        ...(displayName.trim() !== "" ? { displayName: displayName.trim() } : {}),
        ...(birthday.trim() !== "" ? { birthday: birthday.trim() } : {}),
        ...(homeCity.trim() !== "" ? { homeCity: homeCity.trim() } : {}),
      };
      result = await signUp(account);
    } else {
      result = await signIn({ username: name, password });
    }
    if (result.status === "error") setErrors(placeError(result.userError));
    else setEntering(true);
  };

  const switchMode = () => {
    setErrors({});
    setMode(isSignUp ? "signin" : "signup");
  };

  return (
    <FormScreen>
      <BackButton />
      <View style={styles.intro}>
        <Text variant="heading" accessibilityRole="header">
          {isSignUp ? `Join ${APP_NAME}` : "Welcome back"}
        </Text>
        <Text muted>
          {isSignUp
            ? "Pick a username and a password. The rest is optional and you can change it later."
            : "Sign in with your username and password."}
        </Text>
      </View>
      <TextField
        label="Username"
        placeholder="Username"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        submitBehavior="submit"
        editable={!busy}
        value={username}
        error={errors.username}
        onChangeText={(text) => {
          setUsername(text);
          clear("username");
        }}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <View style={styles.passwordBlock}>
        <TextField
          ref={passwordRef}
          label="Password"
          placeholder="Password"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          textContentType={isSignUp ? "newPassword" : "password"}
          returnKeyType={isSignUp ? "next" : "go"}
          submitBehavior={isSignUp ? "submit" : "blurAndSubmit"}
          editable={!busy}
          value={password}
          error={errors.password}
          hint={isSignUp ? PASSWORD_HINT : undefined}
          onChangeText={(text) => {
            setPassword(text);
            clear("password");
          }}
          onSubmitEditing={() => (isSignUp ? displayNameRef.current?.focus() : void submit())}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showPassword ? "Hide password" : "Show password"}
          hitSlop={10}
          onPress={() => setShowPassword((shown) => !shown)}
          style={styles.reveal}
        >
          <Text variant="caption" muted style={styles.revealText}>
            {showPassword ? "Hide password" : "Show password"}
          </Text>
        </Pressable>
      </View>
      {isSignUp ? (
        <>
          <TextField
            ref={displayNameRef}
            label="Display name"
            placeholder="Your name"
            hint="Optional. What friends see."
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="next"
            editable={!busy}
            value={displayName}
            onChangeText={setDisplayName}
          />
          <TextField
            label="Birthday"
            placeholder="YYYY-MM-DD"
            hint="Optional. If you're under 21 we leave 21+ spots out of your picks."
            keyboardType="number-pad"
            autoCorrect={false}
            maxLength={10}
            editable={!busy}
            value={birthday}
            error={errors.birthday}
            onChangeText={(text) => {
              setBirthday(formatBirthdayInput(text));
              clear("birthday");
            }}
          />
          <TextField
            label="Home city"
            placeholder="San Francisco"
            hint="Optional. Marks you as a local there."
            autoCapitalize="words"
            returnKeyType="go"
            editable={!busy}
            value={homeCity}
            onChangeText={setHomeCity}
            onSubmitEditing={() => void submit()}
          />
        </>
      ) : null}
      {errors.form ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
          {errors.form}
        </Text>
      ) : null}
      <SpinnerButton
        title={isSignUp ? "Sign up" : "Sign in"}
        accessibilityLabel={isSignUp ? "Sign up" : "Sign in"}
        busy={busy}
        onPress={() => void submit()}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isSignUp ? "Have an account? Sign in" : "New here? Sign up"}
        disabled={busy}
        hitSlop={8}
        onPress={switchMode}
        style={({ pressed }) => [styles.switch, (pressed || busy) && styles.dimmed]}
      >
        <Text center muted>
          {isSignUp ? "Have an account? Sign in" : "New here? Sign up"}
        </Text>
      </Pressable>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.sm },
  passwordBlock: { gap: spacing.xs },
  reveal: { alignSelf: "flex-end", minHeight: 32, justifyContent: "center", paddingHorizontal: spacing.xs },
  revealText: { fontWeight: "600" },
  error: { color: "#ff6b6b" },
  switch: { alignSelf: "center", minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.md },
  dimmed: { opacity: 0.6 },
});
