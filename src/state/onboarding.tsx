import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { emptyAnswers, type QuizAnswers } from "../features/quiz";

type TasteSummary = { label: string; pct: number }[];

type OnboardingState = {
  answers: QuizAnswers;
  update: (patch: Partial<QuizAnswers> | ((a: QuizAnswers) => Partial<QuizAnswers>)) => void;
  /** Meters returned by `users.saveQuiz`, shown on the taste card. */
  tasteSummary: TasteSummary | null;
  setTasteSummary: (t: TasteSummary) => void;
  completed: boolean;
  complete: () => void;
  /** True from the first quiz screen until "Let's go", so saving the quiz doesn't jump past the taste card. */
  inQuiz: boolean;
  startQuiz: () => void;
};

const OnboardingContext = createContext<OnboardingState | null>(null);

const COMPLETED_KEY = "onboarding-complete";

function readCompleted(): boolean {
  if (Platform.OS !== "web") return SecureStore.getItem(COMPLETED_KEY) === "1";
  return typeof localStorage !== "undefined" && localStorage.getItem(COMPLETED_KEY) === "1";
}

function saveCompleted() {
  if (Platform.OS !== "web") SecureStore.setItem(COMPLETED_KEY, "1");
  else localStorage.setItem(COMPLETED_KEY, "1");
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<QuizAnswers>(emptyAnswers);
  const [tasteSummary, setTasteSummary] = useState<TasteSummary | null>(null);
  const [completed, setCompleted] = useState(readCompleted);
  const [inQuiz, setInQuiz] = useState(false);

  const value = useMemo<OnboardingState>(
    () => ({
      answers,
      update: (patch) =>
        setAnswers((current) => ({ ...current, ...(typeof patch === "function" ? patch(current) : patch) })),
      tasteSummary,
      setTasteSummary,
      completed,
      complete: () => {
        saveCompleted();
        setCompleted(true);
        setInQuiz(false);
      },
      inQuiz,
      startQuiz: () => setInQuiz(true),
    }),
    [answers, tasteSummary, completed, inQuiz],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingState {
  const state = useContext(OnboardingContext);
  if (!state) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return state;
}
