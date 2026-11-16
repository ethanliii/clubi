import type { QuizAnswers } from "./tasteQuiz";

/**
 * What `api.users.saveQuiz` just returned, handed from the quiz to the taste card it opens next.
 * It lets the card draw the moment the save resolves, and tells it which answers to name the persona
 * from. `users.me.tasteSummary` takes over as soon as it has caught up. Forgotten on "Let's go".
 */
export type QuizResult = {
  answers: number[][];
  tasteSummary: { label: string; pct: number }[];
  /** Bryan's full quiz (songs, scenarios, takes, Been here?…), for the persona line on You're in. */
  full?: QuizAnswers;
};

let last: QuizResult | null = null;

export function rememberQuizResult(result: QuizResult): void {
  last = result;
}

export function lastQuizResult(): QuizResult | null {
  return last;
}

export function forgetQuizResult(): void {
  last = null;
}
