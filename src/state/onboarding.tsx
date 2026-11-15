import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import type { QuizQuestion } from "../data/mock";
import type { QuizPicks } from "../features/taste";

type OnboardingState = {
  picks: QuizPicks;
  togglePick: (question: QuizQuestion["id"], option: number) => void;
  completed: boolean;
  complete: () => void;
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
  const [picks, setPicks] = useState<QuizPicks>({});
  const [completed, setCompleted] = useState(readCompleted);

  const value = useMemo<OnboardingState>(
    () => ({
      picks,
      togglePick: (question, option) =>
        setPicks((current) => {
          const selected = current[question] ?? [];
          const next = selected.includes(option)
            ? selected.filter((i) => i !== option)
            : [...selected, option];
          return { ...current, [question]: next };
        }),
      completed,
      complete: () => {
        saveCompleted();
        setCompleted(true);
      },
    }),
    [picks, completed],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingState {
  const state = useContext(OnboardingContext);
  if (!state) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return state;
}
