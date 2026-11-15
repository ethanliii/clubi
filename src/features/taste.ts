import { quiz, type QuizQuestion } from "../data/mock";

export type QuizPicks = Partial<Record<QuizQuestion["id"], number[]>>;

export type TasteProfile = {
  title: string;
  meters: { label: string; value: number }[];
  tags: string[];
};

const CROWD_CHILL = [85, 60, 25, 50];
const BUDGET_MINDED = [90, 65, 35, 10];
const TIMING_TITLE = ["Golden Hour", "Rooftop", "Late-Night", "Afterhours"];

function average(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function deriveTaste(picks: QuizPicks): TasteProfile {
  const music = picks.music ?? [];
  const chill = average((picks.crowd ?? []).map((i) => CROWD_CHILL[i]), 70);
  const musicFirst = music.length === 0 ? 85 : Math.min(95, 40 + music.length * 15);
  const budgetMinded = average((picks.budget ?? []).map((i) => BUDGET_MINDED[i]), 55);
  const timing = picks.timing?.[0] ?? 1;
  const persona = chill >= 60 ? "Romantic" : chill <= 40 ? "Wildcard" : "Socialite";

  const tags = quiz.flatMap((question) =>
    (picks[question.id] ?? []).slice(0, 2).map((i) => question.options[i]),
  );

  return {
    title: `${TIMING_TITLE[timing]} ${persona}`,
    meters: [
      { label: "Chill", value: chill },
      { label: "Chaos", value: 100 - chill },
      { label: "Music-first", value: musicFirst },
      { label: "Budget-minded", value: budgetMinded },
    ],
    tags,
  };
}
