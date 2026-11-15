/**
 * The name on the taste card, made from the meters the backend returned (`users.saveQuiz` and
 * `users.me.tasteSummary`): the strongest meter is the noun, the runner-up describes it, as in
 * "Music-first night owl". Nothing is scored here; the words only follow the backend's numbers.
 */
type Meter = { label: string; pct: number };

/** How each of the backend's meter labels reads as the noun and as the word in front of it. */
const WORDS: Record<string, { noun: string; adjective: string }> = {
  Chill: { noun: "chill seeker", adjective: "Low-key" },
  "Music-first": { noun: "music head", adjective: "Music-first" },
  "Night owl": { noun: "night owl", adjective: "Late-night" },
  "Budget-minded": { noun: "deal hunter", adjective: "Budget-minded" },
};

/** A meter counts as "you" from here up. */
const STRONG = 50;

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export type TasteHeadline = {
  /** The big line, e.g. "Music-first night owl". */
  title: string;
  /** True when the title is a thing you can be "a" of ("you're a night owl"). */
  countable: boolean;
  /** The label of the strongest meter, for highlighting its bar. Null when there are no meters. */
  top: string | null;
};

export function tasteHeadline(meters: readonly Meter[] | undefined): TasteHeadline {
  // Strongest first; a tie keeps the backend's order.
  const ranked = [...(meters ?? [])].sort((a, b) => b.pct - a.pct);
  const [first, second] = ranked;
  if (!first) return { title: "Your going-out taste", countable: false, top: null };
  if (first.pct < STRONG) return { title: "Hard to pin down", countable: false, top: first.label };

  const noun = WORDS[first.label]?.noun;
  if (noun === undefined) {
    // A meter this file has no words for: say the backend's labels as they are.
    const title = second && second.pct >= STRONG ? `${first.label}, ${second.label.toLowerCase()}` : first.label;
    return { title, countable: false, top: first.label };
  }
  const adjective = second && second.pct >= STRONG ? (WORDS[second.label]?.adjective ?? second.label) : null;
  return { title: adjective ? `${adjective} ${noun}` : capital(noun), countable: true, top: first.label };
}
