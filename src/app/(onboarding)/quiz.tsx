import { useAuthActions } from "@convex-dev/auth/react";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, Text, useToast } from "../../components";
import { QUIZ_CARDS } from "../../features/onboarding/quizCards";
import { rememberQuizResult } from "../../features/onboarding/quizResult";
import { SpinnerButton } from "../../features/onboarding/SpinnerButton";
import { api } from "../../lib/api";
import { confirm } from "../../lib/confirm";
import { errorMessage } from "../../lib/errors";
import { paths } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";

/**
 * Six cards (docs/UI-SPEC.md section 2). The answer for a card is the list of picked option indexes;
 * "See my taste" sends all six to `api.users.saveQuiz` and opens the taste card.
 */
export default function Quiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[][]>(() => QUIZ_CARDS.map(() => []));
  const { run: saveQuiz, pending } = useMutationToast(api.users.saveQuiz);
  const { signOut } = useAuthActions();
  const toast = useToast();
  const [leaving, setLeaving] = useState(false);

  const card = QUIZ_CARDS[step];
  const picked = answers[step];
  const isLast = step === QUIZ_CARDS.length - 1;
  const busy = pending || leaving;

  const toggle = (option: number) =>
    setAnswers((current) =>
      current.map((picks, index) => {
        if (index !== step) return picks;
        if (!card.many) return [option];
        return picks.includes(option) ? picks.filter((value) => value !== option) : [...picks, option];
      }),
    );

  const next = async () => {
    if (picked.length === 0 || busy) return;
    if (!isLast) {
      setStep(step + 1);
      return;
    }
    // On failure the toast has shown the backend's sentence and we stay on card 6.
    const saved = await saveQuiz({ answers });
    if (saved === undefined) return;
    rememberQuizResult({ answers, tasteSummary: saved.tasteSummary });
    router.push(paths.tasteCard);
  };

  // The way out for someone who signed in to the wrong account. The gate shows Welcome afterwards.
  const leave = async () => {
    const sure = await confirm({
      title: "Sign out?",
      message: "You can sign back in and take the quiz any time.",
      confirmLabel: "Sign out",
    });
    if (!sure) return;
    setLeaving(true);
    try {
      await signOut();
    } catch (error) {
      toast(errorMessage(error), "error");
      setLeaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${((step + 1) / QUIZ_CARDS.length) * 100}%` }]} />
      </View>
      <View style={styles.header}>
        {step > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            disabled={busy}
            hitSlop={8}
            onPress={() => setStep(step - 1)}
            style={({ pressed }) => [styles.back, (pressed || busy) && styles.dimmed]}
          >
            <Icon name="back" color={Q.fg} />
            <Text style={styles.strong}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          disabled={busy}
          hitSlop={12}
          onPress={() => void leave()}
          style={({ pressed }) => [styles.signOut, (pressed || busy) && styles.dimmed]}
        >
          <Text style={styles.muted}>Sign out</Text>
        </Pressable>
      </View>
      <ScrollView key={step} style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="caption" center style={styles.muted} accessibilityLabel={`Quiz, ${step + 1} of ${QUIZ_CARDS.length}`}>
          Quiz · {step + 1} of {QUIZ_CARDS.length}
        </Text>
        <Text center accessibilityRole="header" style={styles.title}>
          {card.question}
        </Text>
        <Text center style={styles.muted}>
          {card.many ? "Pick as many as you like." : "Pick one."}
        </Text>
        <View accessibilityRole={card.many ? undefined : "radiogroup"} style={styles.options}>
          {card.options.map((option, index) => {
            const on = picked.includes(index);
            return (
              <Pressable
                key={option}
                accessibilityRole={card.many ? "checkbox" : "radio"}
                accessibilityLabel={option}
                accessibilityState={{ checked: on, disabled: busy }}
                // react-native-web reads the aria prop, not accessibilityState, for the checked state.
                aria-checked={on}
                disabled={busy}
                onPress={() => toggle(index)}
                style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && styles.optionPressed]}
              >
                <Text style={styles.optionText}>{option}</Text>
                <View style={[styles.radio, on && styles.radioOn]} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Text variant="caption" style={[styles.muted, styles.flex]}>
          Shapes your matches, not your profile
        </Text>
        <SpinnerButton
          title={isLast ? "See my taste" : "Next"}
          accessibilityLabel={isLast ? "See my taste" : "Next"}
          busy={pending}
          disabled={picked.length === 0 || leaving}
          buttonStyle={[styles.next, pending && styles.nextBusy, (picked.length === 0 || busy) && styles.nextOff]}
          onPress={() => void next()}
        />
      </View>
    </SafeAreaView>
  );
}

// Bryan's quiz look: cream background, serif questions, black accents.
const Q = { bg: "#f5f3ee", card: "#ffffff", line: "#dedbd3", fg: "#16151a", muted: "#7a7680", raised: "#ecebe6" };
const serif = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, serif" });

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Q.bg },
  flex: { flex: 1 },
  progress: { height: 3, backgroundColor: Q.raised },
  progressFill: { height: "100%", backgroundColor: Q.fg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 40,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  back: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 32 },
  signOut: { minHeight: 32, justifyContent: "center" },
  dimmed: { opacity: 0.6 },
  content: { paddingHorizontal: 18, paddingBottom: 24, gap: 6 },
  title: { fontFamily: serif, fontSize: 30, lineHeight: 34, color: Q.fg },
  muted: { color: Q.muted },
  strong: { color: Q.fg, fontWeight: "600" },
  options: { gap: 8, marginTop: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Q.card,
    borderWidth: 1.5,
    borderColor: Q.line,
    borderRadius: 12,
    padding: 12,
  },
  optionOn: { borderColor: Q.fg, backgroundColor: Q.raised },
  optionPressed: { opacity: 0.75 },
  optionText: { color: Q.fg, flex: 1 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: Q.line },
  radioOn: { borderWidth: 5, borderColor: Q.fg },
  footer: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingBottom: 12 },
  next: { width: "auto", height: 50, paddingVertical: 0, paddingHorizontal: 26, borderRadius: 25, backgroundColor: Q.fg },
  nextBusy: { paddingRight: 46 },
  nextOff: { backgroundColor: "#c4c1b9", opacity: 1 },
});
