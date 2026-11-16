import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Animated, Keyboard, Platform, Pressable, StyleSheet, View, type TextInput } from "react-native";
import { api } from "../../convex/_generated/api";
import { goBack, Icon, Text } from "../components";
import { APP_NAME } from "../constants/brand";
import { AuthButton } from "../features/auth/AuthButton";
import { AUTH_ERROR, AuthField } from "../features/auth/AuthField";
import { AuthScreen } from "../features/auth/AuthScreen";
import { birthdayEntryToIso, birthdayProblem, formatBirthdayEntry } from "../features/auth/birthday";
import { authErrorMessage } from "../lib/errors";
import { colors, palette, type as typeScale } from "../theme";

type Mode = "signup" | "signin";
/** Sign up asks in two steps: the account (username, password), then the optional details. */
type Step = "account" | "details";
type Errors = { username?: string; password?: string; birthday?: string; form?: string };
type AuthUserError = Parameters<typeof authErrorMessage>[0];

/** Convex Auth's default (node_modules/@convex-dev/auth/src/lib/password.ts). The backend has the last word. */
const PASSWORD_MIN = 10;
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
 * Sign up or sign in, on a plain white page. Nothing navigates from here: once the backend says
 * we are signed in, the root layout swaps this screen for the quiz (new account) or the tabs.
 */
export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === "signup" ? "signup" : "signin");
  const [step, setStep] = useState<Step>("account");
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
  const birthdayRef = useRef<ComponentRef<typeof TextInput>>(null);
  const homeCityRef = useRef<ComponentRef<typeof TextInput>>(null);
  // Each step (and each mode) eases in, so the form changes without the screen jumping.
  const [appear] = useState(() => new Animated.Value(1));

  const isSignUp = mode === "signup";
  const onDetails = isSignUp && step === "details";
  const busy = signingIn || signingUp || entering;

  useEffect(() => {
    if (!entering) return;
    const timer = setTimeout(() => {
      setEntering(false);
      setErrors({ form: "You're signed in, but your account didn't load. Check your connection and try again." });
    }, ENTER_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [entering]);

  const show = (nextMode: Mode, nextStep: Step) => {
    setMode(nextMode);
    setStep(nextStep);
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: 260, useNativeDriver: Platform.OS !== "web" }).start();
  };

  const clear = (field: keyof Errors) =>
    setErrors((current) => (current[field] || current.form ? { ...current, [field]: undefined, form: undefined } : current));

  /** What is wrong with the username and password before anything is sent, if anything. */
  const accountProblems = (): Errors => {
    const found: Errors = {};
    if (username.trim() === "") found.username = isSignUp ? "Pick a username." : "Enter your username.";
    if (password === "") found.password = isSignUp ? "Pick a password." : "Enter your password.";
    else if (isSignUp && password.length < PASSWORD_MIN) found.password = `Make it at least ${PASSWORD_MIN} characters.`;
    return found;
  };

  const finish = (result: Awaited<ReturnType<typeof signIn>> | Awaited<ReturnType<typeof signUp>>) => {
    if (result.status !== "error") {
      setEntering(true);
      return;
    }
    const placed = placeError(result.userError);
    setErrors(placed);
    // A username that is taken is only known once the account is sent: go back to where it is fixed.
    if (onDetails && (placed.username || placed.password)) show("signup", "account");
  };

  const submitSignIn = async () => {
    if (busy) return;
    const found = accountProblems();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    finish(await signIn({ username: username.trim(), password }));
  };

  const continueToDetails = () => {
    if (busy) return;
    const found = accountProblems();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    Keyboard.dismiss();
    show("signup", "details");
  };

  /** Create the account. `withDetails: false` is "Skip for now": just the username and password. */
  const submitSignUp = async (withDetails: boolean) => {
    if (busy) return;
    // The three details are optional: left out when empty, because the backend takes
    // "YYYY-MM-DD or nothing" for the birthday and falls back to the username for the name.
    const details: { displayName?: string; birthday?: string; homeCity?: string } = {};
    if (withDetails) {
      const iso = birthdayEntryToIso(birthday);
      const problem = iso === null ? "Finish the date, like 10/23/2004, or clear it." : birthdayProblem(iso, new Date());
      if (problem) {
        setErrors({ birthday: problem });
        return;
      }
      if (displayName.trim() !== "") details.displayName = displayName.trim();
      if (iso) details.birthday = iso;
      if (homeCity.trim() !== "") details.homeCity = homeCity.trim();
    }
    setErrors({});
    finish(await signUp({ username: username.trim(), password, ...details }));
  };

  const back = () => {
    if (busy) return;
    if (onDetails) {
      setErrors({});
      show("signup", "account");
    } else goBack();
  };

  const switchMode = () => {
    setErrors({});
    show(isSignUp ? "signin" : "signup", "account");
  };

  const passwordReady = password.length >= PASSWORD_MIN;
  const primaryTitle = !isSignUp ? "Sign in" : onDetails ? "Create account" : "Continue";
  const primaryPress = !isSignUp ? () => void submitSignIn() : onDetails ? () => void submitSignUp(true) : continueToDetails;
  const secondaryLabel = onDetails ? "Skip for now" : isSignUp ? "Have an account? Sign in" : `New to ${APP_NAME}? Sign up`;

  return (
    <AuthScreen>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          disabled={busy}
          hitSlop={6}
          onPress={back}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Icon name="back" size={22} color={colors.fg} />
        </Pressable>
        {isSignUp ? (
          <View accessibilityLabel={onDetails ? "Step 2 of 2" : "Step 1 of 2"} style={styles.steps}>
            <View style={[styles.stepMark, styles.stepDone]} />
            <View style={[styles.stepMark, onDetails && styles.stepDone]} />
          </View>
        ) : null}
      </View>

      <Animated.View
        style={[
          styles.form,
          { opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
        ]}
      >
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={styles.headline}>
            {!isSignUp ? "Welcome back" : onDetails ? "A little about you" : "Create your account"}
          </Text>
          <Text style={styles.sub}>
            {!isSignUp
              ? "Sign in to pick up where you left off."
              : onDetails
                ? "All optional. Change any of it later in settings."
                : "Friends find you by your username."}
          </Text>
        </View>

        {onDetails ? (
          <View key="details" style={styles.fields}>
            <AuthField
              label="Name"
              placeholder="What friends call you"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              submitBehavior="submit"
              editable={!busy}
              value={displayName}
              onChangeText={setDisplayName}
              onSubmitEditing={() => birthdayRef.current?.focus()}
            />
            <AuthField
              ref={birthdayRef}
              label="Birthday"
              placeholder="MM/DD/YYYY"
              keyboardType="number-pad"
              autoCorrect={false}
              maxLength={10}
              editable={!busy}
              value={birthday}
              error={errors.birthday}
              hint={<Text style={styles.hint}>Under 21? We leave 21+ spots out of your picks.</Text>}
              onChangeText={(text) => {
                setBirthday(formatBirthdayEntry(text));
                clear("birthday");
              }}
              onSubmitEditing={() => homeCityRef.current?.focus()}
            />
            <AuthField
              ref={homeCityRef}
              label="Home city"
              placeholder="Where you go out"
              autoCapitalize="words"
              textContentType="addressCity"
              returnKeyType="go"
              editable={!busy}
              value={homeCity}
              onChangeText={setHomeCity}
              onSubmitEditing={() => void submitSignUp(true)}
            />
          </View>
        ) : (
          <View key="account" style={styles.fields}>
            <AuthField
              label="Username"
              prefix="@"
              placeholder="username"
              autoFocus
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
            <AuthField
              ref={passwordRef}
              label="Password"
              placeholder={isSignUp ? "Pick a password" : "Your password"}
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
              hint={
                isSignUp ? (
                  <View style={styles.hintRow}>
                    {passwordReady ? <Icon name="check" size={14} color={colors.ok} /> : null}
                    <Text style={[styles.hint, passwordReady && styles.hintOk]}>{PASSWORD_MIN} characters or more</Text>
                  </View>
                ) : undefined
              }
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  hitSlop={12}
                  onPress={() => setShowPassword((shown) => !shown)}
                  style={({ pressed }) => [styles.reveal, pressed && styles.pressed]}
                >
                  <Text style={styles.revealText}>{showPassword ? "Hide" : "Show"}</Text>
                </Pressable>
              }
              onChangeText={(text) => {
                setPassword(text);
                clear("password");
              }}
              onSubmitEditing={isSignUp ? continueToDetails : () => void submitSignIn()}
            />
          </View>
        )}

        <View style={styles.actions}>
          {errors.form ? (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.formError}>
              {errors.form}
            </Text>
          ) : null}
          <AuthButton title={primaryTitle} busy={busy} onPress={primaryPress} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={secondaryLabel}
            disabled={busy}
            onPress={onDetails ? () => void submitSignUp(false) : switchMode}
            style={({ pressed }) => [styles.secondary, (pressed || busy) && styles.pressed]}
          >
            {onDetails ? (
              <Text style={styles.secondaryStrong}>Skip for now</Text>
            ) : (
              <Text style={styles.secondaryText}>
                {isSignUp ? "Have an account? " : `New to ${APP_NAME}? `}
                <Text style={styles.secondaryStrong}>{isSignUp ? "Sign in" : "Sign up"}</Text>
              </Text>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  bar: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: {
    width: 44,
    height: 44,
    marginLeft: -12,
    alignItems: "center",
    justifyContent: "center",
  },
  steps: { flexDirection: "row", gap: 6 },
  stepMark: { width: 24, height: 4, borderRadius: 2, backgroundColor: colors.line },
  stepDone: { backgroundColor: colors.accent },
  form: { paddingTop: 12 },
  intro: { gap: 8 },
  headline: { ...typeScale.heading, color: colors.fg },
  sub: { fontSize: 16, lineHeight: 22, color: colors.muted },
  fields: { marginTop: 26, gap: 18 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hint: { fontSize: 13, lineHeight: 18, color: colors.muted },
  hintOk: { color: colors.ok },
  reveal: { minHeight: 44, minWidth: 44, alignItems: "flex-end", justifyContent: "center" },
  revealText: { fontSize: 14, fontWeight: "600", color: colors.fg },
  actions: { marginTop: 32, gap: 8 },
  formError: {
    color: AUTH_ERROR,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: palette.dangerSoft,
  },
  secondary: { alignSelf: "center", minHeight: 48, justifyContent: "center", paddingHorizontal: 16 },
  secondaryText: { fontSize: 15, color: colors.muted },
  secondaryStrong: { fontSize: 15, fontWeight: "700", color: colors.accent },
  pressed: { opacity: 0.55 },
});
