import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Screen, Text } from "../../components";
import { api } from "../../lib/api";
import { paths } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, spacing } from "../../theme";

/** The six cards from docs/UI-SPEC.md section 2. An answer is the list of picked option indexes. */
const CARDS: { question: string; options: string[]; many: boolean }[] = [
  { question: "What music gets you out?", options: ["House", "Hip-hop", "Pop", "Techno", "Latin", "Live bands"], many: true },
  { question: "Your ideal crowd?", options: ["Intimate", "Lively", "Packed", "Don't care"], many: false },
  { question: "Budget for a night out?", options: ["Under $20", "$20–50", "$50–100", "$100+"], many: false },
  { question: "When does your night peak?", options: ["Before 10", "10 to 12", "After midnight", "Sunrise"], many: false },
  { question: "Loud or can you hear yourself?", options: ["Quiet", "Some buzz", "Loud", "Deafening"], many: false },
  { question: "Besides nightlife you're into…", options: ["Food", "Museums & art", "Outdoors", "Live shows"], many: true },
];

export default function Quiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[][]>(() => CARDS.map(() => []));
  const { run: saveQuiz, pending } = useMutationToast(api.users.saveQuiz);
  const card = CARDS[step];
  const picked = answers[step];
  const isLast = step === CARDS.length - 1;

  const toggle = (option: number) =>
    setAnswers((current) =>
      current.map((picks, index) => {
        if (index !== step) return picks;
        if (!card.many) return [option];
        return picks.includes(option) ? picks.filter((value) => value !== option) : [...picks, option];
      }),
    );

  const next = async () => {
    if (!isLast) {
      setStep(step + 1);
      return;
    }
    const saved = await saveQuiz({ answers });
    if (saved !== undefined) router.push(paths.tasteCard);
  };

  return (
    <Screen scroll={false} edges={["top", "bottom"]}>
      <Text muted center>
        {step + 1} of {CARDS.length}
      </Text>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${((step + 1) / CARDS.length) * 100}%` }]} />
      </View>
      <View style={styles.intro}>
        <Text variant="heading">{card.question}</Text>
        <Text muted>{card.many ? "Pick as many as you want." : "Pick one."}</Text>
      </View>
      <View style={styles.tiles}>
        {card.options.map((option, index) => {
          const on = picked.includes(index);
          return (
            <Pressable
              key={option}
              accessibilityRole={card.many ? "checkbox" : "radio"}
              accessibilityLabel={option}
              accessibilityState={{ checked: on }}
              onPress={() => toggle(index)}
              style={[styles.tile, on && styles.tileOn]}
            >
              <Text style={styles.tileText}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.spacer} />
      <View style={styles.buttons}>
        {step > 0 ? (
          <Button
            title="Back"
            accessibilityLabel="Back"
            variant="ghost"
            disabled={pending}
            style={styles.button}
            onPress={() => setStep(step - 1)}
          />
        ) : null}
        <Button
          title={isLast ? (pending ? "Saving…" : "See my taste") : "Next"}
          accessibilityLabel={isLast ? "See my taste" : "Next"}
          disabled={picked.length === 0 || pending}
          style={styles.button}
          onPress={() => void next()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { height: 4, borderRadius: 4, backgroundColor: colors.surface, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.accent },
  intro: { gap: spacing.xs },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48%",
    flexGrow: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
  },
  tileOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  tileText: { fontWeight: "600" },
  spacer: { flex: 1 },
  buttons: { flexDirection: "row", gap: spacing.md },
  button: { flex: 1 },
});
