import { useAuthActions } from "@convex-dev/auth/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Icon, Screen, Text, useToast } from "../../components";
import { QUIZ_CARDS } from "../../features/onboarding/quizCards";
import { rememberQuizResult } from "../../features/onboarding/quizResult";
import { SpinnerButton } from "../../features/onboarding/SpinnerButton";
import { api } from "../../lib/api";
import { confirm } from "../../lib/confirm";
import { errorMessage } from "../../lib/errors";
import { paths } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, radius, spacing } from "../../theme";

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
    <Screen scroll={false} edges={["top", "bottom"]}>
      <View style={styles.top}>
        <Text variant="label" accessibilityLabel={`Quiz, ${step + 1} of ${QUIZ_CARDS.length}`}>
          Quiz · {step + 1} of {QUIZ_CARDS.length}
        </Text>
        <Button
          title="Sign out"
          accessibilityLabel="Sign out"
          variant="link"
          disabled={busy}
          hitSlop={12}
          style={styles.signOut}
          onPress={() => void leave()}
        />
      </View>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${((step + 1) / QUIZ_CARDS.length) * 100}%` }]} />
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text variant="heading" accessibilityRole="header">
            {card.question}
          </Text>
          <Text muted>{card.many ? "Pick as many as you like." : "Pick one."}</Text>
        </View>
        <View accessibilityRole={card.many ? undefined : "radiogroup"} style={styles.tiles}>
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
                style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && styles.tilePressed]}
              >
                <Text style={[styles.tileText, on && styles.tileTextOn]}>{option}</Text>
                {on ? (
                  <View style={styles.tick}>
                    <Icon name="check" size={12} color={colors.white} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.buttons}>
        {step > 0 ? (
          // Wrapped so both buttons get the same width (a padded box cannot shrink to an equal share by itself).
          <View style={styles.button}>
            <Button
              title="Back"
              accessibilityLabel="Back"
              variant="ghost"
              disabled={busy}
              onPress={() => setStep(step - 1)}
            />
          </View>
        ) : null}
        <SpinnerButton
          title={isLast ? "See my taste" : "Next"}
          accessibilityLabel={isLast ? "See my taste" : "Next"}
          busy={pending}
          disabled={picked.length === 0 || leaving}
          style={styles.button}
          onPress={() => void next()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 40 },
  signOut: { minHeight: 40, paddingHorizontal: spacing.xs },
  progress: { height: 4, borderRadius: 4, backgroundColor: colors.surface, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: colors.accent },
  body: { flex: 1 },
  bodyContent: { gap: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  intro: { gap: spacing.sm },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tile: {
    width: "47%",
    flexGrow: 1,
    minHeight: 64,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  tileOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  tilePressed: { opacity: 0.75 },
  tileText: { fontWeight: "600", fontSize: 15, textAlign: "center" },
  tileTextOn: { color: colors.white },
  tick: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  buttons: { flexDirection: "row", gap: spacing.md },
  button: { flex: 1 },
});
