import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { BackButton, Button, Screen, Text } from "../../components";
import { quiz } from "../../data/mock";
import { useOnboarding } from "../../state/onboarding";
import { colors, spacing } from "../../theme";

export default function Quiz() {
  const [step, setStep] = useState(0);
  const { picks, togglePick } = useOnboarding();
  const question = quiz[step];
  const selected = picks[question.id] ?? [];
  const isLast = step === quiz.length - 1;

  const next = () => (isLast ? router.push("/taste-card") : setStep(step + 1));
  const back = () => (step > 0 ? setStep(step - 1) : router.back());

  return (
    <Screen scroll={false} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <BackButton onPress={back} />
        <Text muted>
          {step + 1} of {quiz.length}
        </Text>
        <Pressable accessibilityRole="button" onPress={next} hitSlop={8}>
          <Text muted>Skip</Text>
        </Pressable>
      </View>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${((step + 1) / quiz.length) * 100}%` }]} />
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.intro}>
          <Text variant="heading">{question.question}</Text>
          <Text muted>Pick as many as you want.</Text>
        </View>
        <View style={styles.tiles}>
          {question.options.map((option, index) => {
            const on = selected.includes(index);
            return (
              <Pressable
                key={option}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => togglePick(question.id, index)}
                style={[styles.tile, on && styles.tileOn]}
              >
                <Text style={styles.tileText}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <Button title={isLast ? "See my taste" : "Next"} onPress={next} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progress: { height: 4, borderRadius: 4, backgroundColor: colors.surface, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.accent },
  body: { flex: 1 },
  bodyContent: { gap: spacing.lg },
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
});
