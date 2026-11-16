import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Button, Text } from "../../components";
import type { InsightAnswer, InsightQuestion } from "../../lib/api";
import { colors, fontWeight, palette, spacing } from "../../theme";
import { BusyButton, FlowScreen } from "./FlowScreen";
import { createTapGuard } from "./tapGuard";
import { Rise } from "./ui";

/**
 * Step 6. One question at a time, tap only. A single-pick question moves on by itself; a
 * multi-pick one waits for "Next". "Skip" (top right) leaves a question out. "Done" hands over only what was answered.
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

  const nothingPicked = picked.length === 0;

  return (
    <FlowScreen
      title="Quick questions"
      heading={question.text}
      sub={question.multi ? "Pick any that fit." : undefined}
      progress={{ current: index + 1, total: questions.length }}
      back={false}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip"
          accessibilityState={{ disabled: sending }}
          disabled={sending}
          hitSlop={8}
          onPress={skip}
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      }
      footer={
        <>
          {isLast ? (
            <BusyButton title="Done" accessibilityLabel="Done" busy={sending} disabled={nothingPicked} onPress={() => onDone(answersFrom(picks))} />
          ) : (
            <Button title="Next" accessibilityLabel="Next" disabled={nothingPicked} onPress={next} />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip all"
            accessibilityState={{ disabled: sending }}
            disabled={sending}
            onPress={onSkipAll}
            style={({ pressed }) => [styles.skipAll, pressed && styles.pressed]}
          >
            <Text style={styles.skipAllText}>Skip all</Text>
          </Pressable>
        </>
      }
    >
      {/* The key gives every card fresh buttons and replays the entrance. */}
      <Rise key={question.id} style={styles.options}>
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
              <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </Rise>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  skip: { minHeight: 44, justifyContent: "center", paddingLeft: spacing.md },
  skipText: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.semibold, color: colors.muted },
  skipAll: { minHeight: 36, alignItems: "center", justifyContent: "center" },
  skipAllText: { fontSize: 13, lineHeight: 17, color: colors.muted },
  // Wrapping chips, the same shape as the labels on "Add details".
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  option: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: palette.field,
    alignItems: "center",
    justifyContent: "center",
  },
  optionOn: { backgroundColor: colors.fg },
  optionLabel: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.semibold, color: colors.fg },
  optionLabelOn: { color: colors.bg },
});
