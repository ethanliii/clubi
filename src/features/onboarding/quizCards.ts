/**
 * The six quiz cards from docs/UI-SPEC.md section 2, in the order the backend expects
 * (convex/users.ts counts 6, 4, 4, 4, 4, 4 options). The answer for a card is the list of picked
 * option indexes, so never reorder the options.
 */
export type QuizCard = { question: string; options: readonly string[]; many: boolean };

export const QUIZ_CARDS: readonly QuizCard[] = [
  {
    question: "What music gets you out?",
    options: ["House", "Hip-hop", "Pop", "Techno", "Latin", "Live bands"],
    many: true,
  },
  { question: "Your ideal crowd?", options: ["Intimate", "Lively", "Packed", "Don't care"], many: false },
  { question: "Budget for a night out?", options: ["Under $20", "$20–50", "$50–100", "$100+"], many: false },
  {
    question: "When does your night peak?",
    options: ["Before 10", "10 to 12", "After midnight", "Sunrise"],
    many: false,
  },
  {
    question: "Loud or can you hear yourself?",
    options: ["Quiet", "Some buzz", "Loud", "Deafening"],
    many: false,
  },
  {
    question: "Besides nightlife you're into…",
    options: ["Food", "Museums & art", "Outdoors", "Live shows"],
    many: true,
  },
];

/** The words the user picked on the "pick many" cards (music, other interests), for the line under the taste card. */
export function pickedTags(answers: readonly (readonly number[])[] | undefined): string[] {
  if (!answers) return [];
  return QUIZ_CARDS.flatMap((card, index) =>
    card.many ? [...(answers[index] ?? [])].sort((a, b) => a - b).flatMap((option) => card.options[option] ?? []) : [],
  );
}
