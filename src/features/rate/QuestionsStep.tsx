import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Icon, Text } from "../../components";
import type { InsightAnswer, InsightQuestion } from "../../lib/api";
import { colors, radius, spacing } from "../../theme";
import { BusyButton, FlowScreen } from "./FlowScreen";
import { createTapGuard } from "./tapGuard";

/**
 * Step 6. One card per question, tap only. A single-pick card moves on by itself; a multi-pick
 * card waits for "Next". "Skip" leaves a question out. "Done" hands over only what was answered.
 */
export function QuestionsStep({
  questions,
  sending,
  onDone,
  onSkipAll,
}: {
  /** At least one question, fixed for the whole step. */
  questions: InsightQuestion[];
  sending: boolean;
  onDone: (answers: InsightAnswer[]) => void;
  onSkipAll: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  // A second tap right after a card changed is the same tap landing twice.
  const [guard] = useState(createTapGuard);

  const question = questions[Math.min(index, questions.length - 1)];
  const isLast = index >= questions.length - 1;
  const picked = picks[question.id] ?? [];

  const answersFrom = (all: Record<string, string[]>): InsightAnswer[] =>
    questions.flatMap((each) => {
      const optionIds = all[each.id] ?? [];
      return optionIds.length > 0 ? [{ questionId: each.id, optionIds }] : [];
    });

  const next = () => {
    guard.mark();
    setIndex(index + 1);
  };

  const pick = (optionId: string) => {
    if (sending || guard.justMoved()) return;
    if (question.multi) {
      setPicks({
        ...picks,
        [question.id]: picked.includes(optionId) ? picked.filter((id) => id !== optionId) : [...picked, optionId],
      });
      return;
    }
    setPicks({ ...picks, [question.id]: [optionId] });
    if (!isLast) next();
  };

  const skip = () => {
    if (sending || guard.justMoved()) return;
    const without = { ...picks };
    delete without[question.id];
    setPicks(without);
    if (isLast) onDone(answersFrom(without));
    else next();
  };

  return (
    <FlowScreen
      title="Quick questions"
      back={false}
      right={<Button title="Skip all" accessibilityLabel="Skip all" variant="link" disabled={sending} onPress={onSkipAll} />}
      footer={
        <View style={styles.buttons}>
          <Button title="Skip" accessibilityLabel="Skip" variant="ghost" disabled={sending} onPress={skip} style={styles.flex} />
          {isLast ? (
            <BusyButton
              title="Done"
              accessibilityLabel="Done"
              busy={sending}
              onPress={() => onDone(answersFrom(picks))}
              style={styles.flex}
            />
          ) : question.multi ? (
            <Button title="Next" accessibilityLabel="Next" onPress={next} style={styles.flex} />
          ) : null}
        </View>
      }
    >
      <View style={styles.intro}>
        <Text muted accessibilityLabel={`${index + 1} of ${questions.length}`}>
          {index + 1} of {questions.length}
        </Text>
        <Text variant="heading" accessibilityRole="header">
          {question.text}
        </Text>
        <Text muted>{question.multi ? "Pick as many as you want." : "Tap one."}</Text>
      </View>
      {/* The key gives every card fresh buttons. */}
      <View key={question.id} style={styles.options}>
        {question.options.map((option) => {
          const on = picked.includes(option.id);
          return (
            <Pressable
              key={option.id}
              accessibilityRole={question.multi ? "checkbox" : "radio"}
              accessibilityLabel={option.label}
              accessibilityState={{ checked: on, disabled: sending }}
              disabled={sending}
              onPress={() => pick(option.id)}
              style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && styles.pressed]}
            >
              <Text variant="title" style={styles.optionLabel}>
                {option.label}
              </Text>
              {on ? <Icon name="check" size={18} color={colors.accent} /> : null}
            </Pressable>
          );
        })}
      </View>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  buttons: { flexDirection: "row", gap: spacing.md },
  intro: { gap: spacing.xs },
  options: { gap: spacing.md },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: 18,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  optionOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  optionLabel: { flex: 1 },
});
