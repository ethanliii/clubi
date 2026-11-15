import { useSignUpWithUsernamePassword } from "@convex-dev/auth/methods/username-password/react";
import { useConvexAuth, useMutation } from "convex/react";
import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Icon, SocialButton, Text } from "../../components/bryan";
import { onboardingColors } from "../../theme";

// Hinge-style sign-up: one question per screen, cream background, serif question, black round arrow.
const Q = onboardingColors;
const serif = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, serif" });
const soon = () => Alert.alert("Coming soon", "Apple and Google sign-in need the backend set up first.");

/** Whole years since a YYYY-MM-DD birthday (display only; the backend enforces 21+). */
function ageOn(birthday: string): number {
  return Math.floor((new Date().getTime() - new Date(birthday).getTime()) / 31_557_600_000);
}

type Step = "name" | "social" | "username" | "password" | "birthday" | "home";
const STEPS: Step[] = ["name", "social", "username", "password", "birthday", "home"];

/** Create account, step by step (backend: username + password, then settings.update for the rest). */
export default function CreateAccount() {
  const { isAuthenticated } = useConvexAuth();
  const { signUp, pending } = useSignUpWithUsernamePassword(api.auth);
  const updateSettings = useMutation(api.settings.update);
  const [i, setI] = useState(0);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mm, setMm] = useState("");
  const [dd, setDd] = useState("");
  const [yyyy, setYyyy] = useState("");
  const [confirmAge, setConfirmAge] = useState(false);
  const [home, setHome] = useState("");
  const [error, setError] = useState<string | null>(null);
  const step = STEPS[i]!;

  const birthday = mm && dd && yyyy.length === 4 ? `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}` : "";
  const age = birthday ? ageOn(birthday) : null;

  // Once the account exists, save the profile fields, then the quiz.
  useEffect(() => {
    if (!isAuthenticated) return;
    const go = () => router.replace("/quiz");
    updateSettings({
      displayName: [first.trim(), last.trim()].filter(Boolean).join(" ") || undefined,
      birthday: birthday || undefined,
      homeCity: home.trim() || undefined,
    }).then(go, go);
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const ok: Record<Step, boolean> = {
    name: first.trim().length > 0,
    social: true,
    username: /^[a-z0-9_.]{3,20}$/i.test(username),
    password: password.length >= 8,
    birthday: age !== null && age >= 13 && age < 110,
    home: true,
  };

  const next = async () => {
    setError(null);
    if (step === "birthday" && !confirmAge) return setConfirmAge(true);
    if (step !== "home") return setI(i + 1);
    try {
      const result = await signUp({ username, password });
      if (result.status === "error") {
        setError(result.userError.error);
        setI(STEPS.indexOf("username"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };
  const back = () => (confirmAge ? setConfirmAge(false) : i > 0 ? setI(i - 1) : router.back());

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.progress}><View style={[styles.fill, { width: `${((i + 1) / STEPS.length) * 100}%` }]} /></View>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={8}><Icon name="back" color={Q.fg} /></Pressable>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.body}>
        {step === "name" && (
          <Ask title="What's your name?" sub="Last name is optional.">
            <Field label="First name" value={first} onChangeText={setFirst} autoCapitalize="words" autoFocus />
            <Field label="Last name (optional)" value={last} onChangeText={setLast} autoCapitalize="words" />
          </Ask>
        )}
        {step === "social" && (
          <Ask title="An easier way to sign back in" sub="Connect an account to log back in fast if you're signed out.">
            <SocialButton provider="google" onPress={soon} />
            <SocialButton provider="apple" onPress={soon} />
            <Pressable onPress={() => setI(i + 1)} style={{ alignSelf: "center", padding: 8 }}>
              <Text style={{ color: Q.fg, fontWeight: "600" }}>No thanks</Text>
            </Pressable>
          </Ask>
        )}
        {step === "username" && (
          <Ask title="Pick a username" sub="3–20 letters, numbers, dots or underscores. Friends find you with it.">
            <Field label="Username" value={username} onChangeText={(t) => setUsername(t.toLowerCase())} autoFocus />
          </Ask>
        )}
        {step === "password" && (
          <Ask title="Create a password" sub="At least 8 characters.">
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoFocus />
          </Ask>
        )}
        {step === "birthday" && (
          <Ask title="When's your birthday?" sub="Only used to keep 21+ spots away from under-21s.">
            <View style={styles.row}>
              <Field label="Month" value={mm} onChangeText={setMm} keyboardType="number-pad" maxLength={2} style={{ flex: 1 }} autoFocus />
              <Field label="Day" value={dd} onChangeText={setDd} keyboardType="number-pad" maxLength={2} style={{ flex: 1 }} />
              <Field label="Year" value={yyyy} onChangeText={setYyyy} keyboardType="number-pad" maxLength={4} style={{ flex: 1.4 }} />
            </View>
            {confirmAge && age !== null && (
              <View style={styles.confirm}>
                <Text style={[styles.strong, { fontSize: 18 }]}>{`You're ${age}`}</Text>
                <Text style={styles.muted}>Born {new Date(birthday).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</Text>
                <Text style={styles.muted}>Make sure your age is correct before moving on.</Text>
                <View style={styles.row}>
                  <Pressable onPress={() => setConfirmAge(false)} style={[styles.pill, { backgroundColor: Q.card }]}><Text style={styles.strong}>Edit</Text></Pressable>
                  <Pressable onPress={() => { setConfirmAge(false); setI(i + 1); }} style={[styles.pill, { backgroundColor: Q.fg }]}><Text style={{ color: Q.onFg, fontWeight: "700" }}>Confirm</Text></Pressable>
                </View>
              </View>
            )}
          </Ask>
        )}
        {step === "home" && (
          <Ask title="Where's home?" sub="Your city marks you as a local there. Only the city is shown.">
            <Field label="Home city" value={home} onChangeText={setHome} autoCapitalize="words" autoFocus />
          </Ask>
        )}
        {error && <Text style={{ color: "#ff6b6b", marginTop: 10 }}>{error}</Text>}
        <View style={{ flex: 1 }} />
        {step !== "social" && !(step === "birthday" && confirmAge) && (
          <Pressable accessibilityRole="button" accessibilityLabel={step === "home" ? "Create account" : "Continue"}
            disabled={!ok[step] || pending} onPress={next}
            style={[styles.next, (!ok[step] || pending) && { backgroundColor: Q.off }]}>
            <Text style={{ color: Q.onFg, fontWeight: "700" }}>{step === "home" ? "Create account" : "Continue"}</Text>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Ask({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <View style={{ gap: 14 }}>
      <Text center style={styles.title}>{title}</Text>
      <Text center style={styles.muted}>{sub}</Text>
      <View style={{ gap: 10, marginTop: 6 }}>{children}</View>
    </View>
  );
}

function Field({ label, style, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={[styles.field, style]}>
      <Text variant="caption" style={styles.muted}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={Q.muted} autoCapitalize="none" {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Q.bg },
  progress: { height: 3, backgroundColor: Q.raised },
  fill: { height: "100%", backgroundColor: Q.fg },
  header: { paddingHorizontal: 18, paddingVertical: 8 },
  body: { flex: 1, paddingHorizontal: 22, paddingBottom: 18 },
  title: { fontFamily: serif, fontSize: 30, lineHeight: 34, color: Q.fg },
  muted: { color: Q.muted },
  strong: { color: Q.fg, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  field: { backgroundColor: Q.card, borderWidth: 1, borderColor: Q.line, borderRadius: 12, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  input: { color: Q.fg, fontSize: 16, paddingVertical: 6 },
  confirm: { backgroundColor: Q.card, borderRadius: 16, padding: 16, gap: 6, borderWidth: 1, borderColor: Q.line, marginTop: 10 },
  pill: { flex: 1, borderRadius: 99, paddingVertical: 11, alignItems: "center", borderWidth: 1, borderColor: Q.line },
  next: { alignSelf: "center", backgroundColor: Q.fg, borderRadius: 99, paddingHorizontal: 34, paddingVertical: 13 },
});
