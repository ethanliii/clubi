import { useAuthActions } from "@convex-dev/auth/react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, Text, useToast } from "../../components";
import { QUIZ_CARDS } from "../../features/onboarding/quizCards";
import { QuizOption } from "../../features/onboarding/QuizOption";
import { QuizProgress } from "../../features/onboarding/QuizProgress";
import { rememberQuizResult } from "../../features/onboarding/quizResult";
import { Rise } from "../../features/onboarding/Rise";
import { SpinnerButton } from "../../features/onboarding/SpinnerButton";
import { api } from "../../lib/api";
import { confirm } from "../../lib/confirm";
import { errorMessage } from "../../lib/errors";
import { paths } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors } from "../../theme";

/**
 * Six cards (docs/UI-SPEC.md section 2), one question a screen. The answer for a card is the list
 * of picked option indexes; "See my taste" sends all six to `api.users.saveQuiz` and opens the
 * taste card.
 */
export default function Quiz() {
  const [step, setStep] = useState(0);
  // Which way the next card slides in from: 1 after "Next", -1 after "Back".
  const [direction, setDirection] = useState<1 | -1>(1);
  const [answers, setAnswers] = useState<number[][]>(() => QUIZ_CARDS.map(() => []));
  const { run: saveQuiz, pending } = useMutationToast(api.users.saveQuiz);
  const { signOut } = useAuthActions();
  const toast = useToast();
  const [leaving, setLeaving] = useState(false);

  const card = QUIZ_CARDS[step];
  const picked = answers[step];
  const isLast = step === QUIZ_CARDS.length - 1;
  const busy = pending || leaving;
  const compact = card.options.length > 4;

  const toggle = (option: number) =>
    setAnswers((current) =>
      current.map((picks, index) => {
        if (index !== step) return picks;
        if (!card.many) return [option];
        return picks.includes(option) ? picks.filter((value) => value !== option) : [...picks, option];
      }),
    );

  const go = (to: number) => {
    setDirection(to > step ? 1 : -1);
    setStep(to);
  };

  const next = async () => {
    if (picked.length === 0 || busy) return;
    if (!isLast) {
      go(step + 1);
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
      <StatusBar style="light" />
      <View style={styles.top}>
        <QuizProgress step={step} total={QUIZ_CARDS.length} />
        <View style={styles.bar}>
          {step > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              disabled={busy}
              onPress={() => go(step - 1)}
              style={({ pressed }) => [styles.back, (pressed || busy) && styles.dimmed]}
            >
              <Icon name="back" size={24} color={colors.fg} />
            </Pressable>
          ) : (
            <View style={styles.back} />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            disabled={busy}
            onPress={() => void leave()}
            style={({ pressed }) => [styles.signOut, (pressed || busy) && styles.dimmed]}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        key={step}
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Rise axis="x" from={direction * 28} style={styles.question}>
          <Text style={styles.count} accessibilityLabel={`Quiz, ${step + 1} of ${QUIZ_CARDS.length}`}>
            {step + 1} of {QUIZ_CARDS.length}
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            {card.question}
          </Text>
          <Text style={styles.hint}>{card.many ? "Pick as many as you like" : "Pick one"}</Text>
        </Rise>
        <View accessibilityRole={card.many ? undefined : "radiogroup"} style={compact ? styles.optionsCompact : styles.options}>
          {card.options.map((option, index) => (
            <Rise key={option} delay={70 + index * 45} from={18}>
              <QuizOption
                label={option}
                many={card.many}
                compact={compact}
                selected={picked.includes(index)}
                disabled={busy}
                onPress={() => toggle(index)}
              />
            </Rise>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {/* On a short phone the answers scroll; they fade out under the button instead of being cut. */}
        <LinearGradient colors={["rgba(20,17,25,0)", colors.bg]} style={styles.fade} />
        <SpinnerButton
          title={isLast ? "See my taste" : "Next"}
          accessibilityLabel={isLast ? "See my taste" : "Next"}
          busy={pending}
          disabled={picked.length === 0 || leaving}
          buttonStyle={[styles.next, picked.length === 0 && !pending && styles.nextOff]}
          onPress={() => void next()}
        />
        {step === 0 ? (
          <Text variant="caption" muted center>
            Shapes your matches, not your profile
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const SIDE = 22;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  top: { paddingHorizontal: SIDE, paddingTop: 10 },
  bar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 52, marginHorizontal: -10 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  signOut: { height: 44, paddingHorizontal: 10, justifyContent: "center" },
  signOutText: { color: colors.muted, fontSize: 15, lineHeight: 20 },
  dimmed: { opacity: 0.5 },
  // The question sits at the top and the answers sit by the thumb; a short screen scrolls instead.
  content: { flexGrow: 1, justifyContent: "space-between", paddingHorizontal: SIDE, paddingTop: 12, paddingBottom: 30, gap: 28 },
  question: { gap: 10 },
  count: { color: colors.muted, fontSize: 15, lineHeight: 20, fontVariant: ["tabular-nums"] },
  title: { fontSize: 40, lineHeight: 43, fontWeight: "800", letterSpacing: -1, color: colors.fg },
  hint: { color: colors.muted, fontSize: 16, lineHeight: 22 },
  options: { gap: 10 },
  optionsCompact: { gap: 8 },
  footer: { paddingHorizontal: SIDE, paddingTop: 8, paddingBottom: 14, gap: 10 },
  fade: { position: "absolute", left: 0, right: 0, top: -28, height: 28, pointerEvents: "none" },
  next: { minHeight: 56 },
  // Still clearly the button, not a seventh answer: the accent, turned down.
  nextOff: { backgroundColor: colors.accentSoft },
});
