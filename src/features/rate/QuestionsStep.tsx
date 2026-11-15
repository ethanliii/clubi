import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Icon, Text } from "../../components";
import type { InsightAnswer, InsightQuestion } from "../../lib/api";
import { colors, fontWeight, radius, spacing } from "../../theme";
import { BusyButton, FlowScreen } from "./FlowScreen";
import { createTapGuard } from "./tapGuard";
import { Rise } from "./ui";

/**
 * Step 6. One question at a time, tap only. A single-pick question moves on by itself; a
 * multi-pick one waits for "Next". "Skip" leaves a question out. "Done" hands over only what was answered.
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

  const primary = isLast ? (
    <BusyButton title="Done" accessibilityLabel="Done" busy={sending} onPress={() => onDone(answersFrom(picks))} style={styles.primary} />
  ) : question.multi ? (
    <Button title="Next" accessibilityLabel="Next" onPress={next} style={styles.primary} />
  ) : null;

  return (
    <FlowScreen
      title="Quick questions"
      heading={question.text}
      sub={question.multi ? "Pick any that fit." : undefined}
      progress={{ current: index + 1, total: questions.length }}
      back={false}
      right={<Button title="Skip all" accessibilityLabel="Skip all" variant="link" disabled={sending} onPress={onSkipAll} style={styles.skipAll} />}
      footer={
        <View style={styles.buttons}>
          <Button
            title="Skip"
            accessibilityLabel="Skip"
            variant={primary ? "ghost" : "link"}
            disabled={sending}
            onPress={skip}
            style={primary ? styles.skip : styles.skipAlone}
          />
          {primary}
        </View>
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
              {on ? (
                <View style={[styles.mark, styles.markOn]}>
                  <Icon name="check" size={14} color={colors.white} />
                </View>
              ) : question.multi ? (
                <View style={styles.mark} />
              ) : null}
            </Pressable>
          );
        })}
      </Rise>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  buttons: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md },
  skip: { flex: 1 },
  skipAlone: { minHeight: 48, paddingHorizontal: spacing.xl },
  skipAll: { minHeight: 44, justifyContent: "center" },
  primary: { flex: 2, width: "auto" },
  options: { gap: spacing.sm + 2 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    minHeight: 64,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg + 2,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  optionOn: { backgroundColor: colors.accentSoft },
  optionLabel: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: fontWeight.semibold, color: colors.fg },
  optionLabelOn: { color: colors.white },
  mark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.low,
    alignItems: "center",
    justifyContent: "center",
  },
  markOn: { borderColor: colors.accent, backgroundColor: colors.accent },
});
