/**
 * Bryan's taste quiz (see bryan-design/QUIZ_SPEC.md).
 *
 * The backend's `users.saveQuiz` takes the answers to its 6 cards today. Until it accepts the
 * full quiz (ask E1 in the merge doc), `toBackendCards()` maps our answers onto those 6 cards so
 * the taste model gets real data now. `answers` keeps everything for when the extended call lands.
 */

export type Stars = 1 | 2 | 3 | 4 | 5;

export type QuizAnswers = {
  songs: Partial<Record<number, Stars>>;   // index into SONGS
  thisOrThat: (0 | 1)[];                   // per pair: 0 = left, 1 = right
  scenarioKeys: ScenarioKey[];             // the 3 shown to this person
  scenarios: Partial<Record<ScenarioKey, number>>;
  squad?: number;                          // index into SQUAD
  nights: number[];                        // 7 values, Mon–Sun: 0 | 0.5 | 1
  budget?: number;                         // index into BUDGET
  takes: Partial<Record<TakeKey, number>>; // 1–5 agree
  interests: number[];                     // indexes into INTERESTS
  drinking?: number;
  transport?: number;
  dealbreakers: number[];
  locationAsked?: boolean;
  notifications?: boolean;
  beenHere: Record<string, { kind: "place" | "event"; bucket: "loved" | "fine" | "didnt" | "skip" }>;   // venue id → bucket
};

export const emptyAnswers = (): QuizAnswers => ({
  songs: {},
  thisOrThat: [],
  scenarioKeys: pickScenarios(),
  scenarios: {},
  nights: [0, 0, 0, 0, 0, 0, 0],
  takes: {},
  interests: [],
  dealbreakers: [],
  beenHere: {},
});

/** Genre order matches the backend card 1 options where possible. */
export const SONGS = [
  { title: "One More Time", artist: "Daft Punk", genre: "House / EDM", hue: 280 },
  { title: "Not Like Us", artist: "Kendrick Lamar", genre: "Hip-hop", hue: 10 },
  { title: "Espresso", artist: "Sabrina Carpenter", genre: "Pop", hue: 195 },
  { title: "Tití Me Preguntó", artist: "Bad Bunny", genre: "Latin", hue: 330 },
  { title: "Mr. Brightside", artist: "The Killers", genre: "Indie / Rock", hue: 40 },
  { title: "Kill Bill", artist: "SZA", genre: "R&B", hue: 150 },
] as const;

export const THIS_OR_THAT = [
  ["Packed dance floor", "Open patio"],
  ["Dive bar", "Rooftop"],
  ["DJ set", "Live band"],
  ["Dancing", "Talking"],
] as const;

export type ScenarioKey = "oneam" | "packed" | "song" | "onedrink" | "tuesday";
export const SCENARIOS: Record<ScenarioKey, { text: string; options: string[] }> = {
  oneam: { text: "It's 1am. What are you doing?", options: ["😴 Already asleep", "🏠 Heading home", "🌮 Food run", "🎉 Finding the afterparty"] },
  packed: { text: "You walk in and it's packed wall to wall. You…", options: ["Turn around and leave", "Find a quiet corner", "Grab a drink and scope it out", "Straight to the middle"] },
  song: { text: "The DJ plays your song. You…", options: ["Nod along", "Sing under your breath", "Scream every word", "Take over the dance floor"] },
  onedrink: { text: 'Your friend says "just one drink." Reality:', options: ["Actually one", "Two, tops", "Closing the bar", "Somehow at a different party at 2"] },
  tuesday: { text: 'Group chat at 11pm on a Tuesday: "outside?"', options: ["Ignore it", '"Maybe next time"', "Ask where first", "Already putting shoes on"] },
};

function pickScenarios(): ScenarioKey[] {
  const keys = Object.keys(SCENARIOS) as ScenarioKey[];
  return keys.sort(() => Math.random() - 0.5).slice(0, 3);
}

export const SQUAD = ["Solo", "2–3", "4–6", "The whole floor"] as const;
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const BUDGET = [
  { amount: "$0", label: "Free campus party" },
  { amount: "$20", label: "A couple drinks" },
  { amount: "$60", label: "Bottle splits" },
  { amount: "$100+", label: "No regrets" },
] as const;

export type TakeKey = "pregame" | "unplanned" | "friends" | "cover";
export const TAKES: { key: TakeKey; text: string }[] = [
  { key: "pregame", text: "Pregame > the actual party" },
  { key: "unplanned", text: "Best nights are unplanned" },
  { key: "friends", text: "I go wherever my friends go" },
  { key: "cover", text: "I'd pay a $25 cover for the right spot" },
];
export const AGREE = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"] as const;

/** Same options, same order as backend card 6. */
export const INTERESTS = ["Food", "Museums & art", "Outdoors", "Live shows"] as const;
export const DRINKING = ["Yes", "Sometimes", "No"] as const;
export const TRANSPORT = ["Walk", "Bike", "Uber", "Car"] as const;
export const DEALBREAKERS = ["Long lines", "Dress code", "Cover", "Too packed"] as const;

export function nightCaption(nights: number[]): string {
  const always = nights.flatMap((v, i) => (v === 1 ? [DAYS[i]] : []));
  const some = nights.flatMap((v, i) => (v === 0.5 ? [DAYS[i]] : []));
  if (!always.length && !some.length) return "Tap the nights you usually go out";
  if (always.length + some.length >= 5) return "Every night is a weekend 😅";
  const head = always.length ? `${always.join(" + ")} warrior 🔥` : "";
  const tail = some.length ? `${always.length ? " · sometimes " : "Sometimes "}${some.join(", ")}` : "";
  return head + tail;
}

/**
 * Maps the full quiz onto the backend's 6 cards (option counts 6, 4, 4, 4, 4, 4):
 * 1 music [House, Hip-hop, Pop, Techno, Latin, Live bands] · 2 crowd [Intimate, Lively, Packed, Don't care]
 * 3 budget · 4 peak [Before 10, 10 to 12, After midnight, Sunrise] · 5 loud [Quiet, Some buzz, Loud, Deafening]
 * 6 interests [Food, Museums & art, Outdoors, Live shows].
 */
export function toBackendCards(a: QuizAnswers): number[][] {
  const liked = (i: number) => (a.songs[i] ?? 0) >= 4;
  const music = new Set<number>();
  if (liked(0)) music.add(0);
  if (liked(1)) music.add(1);
  if (liked(2) || liked(5)) music.add(2);
  if ((a.songs[0] ?? 0) === 5) music.add(3);
  if (liked(3)) music.add(4);
  if (liked(4) || a.thisOrThat[2] === 1) music.add(5);
  if (a.thisOrThat[2] === 0) music.add(0);
  if (music.size === 0) music.add(2);

  const packed = a.scenarios.packed;
  const crowd = a.thisOrThat[0] === 0 || (packed ?? 0) >= 3 ? 2 : a.thisOrThat[0] === 1 ? 0 : packed === 2 ? 1 : 3;

  const oneam = a.scenarios.oneam;
  const peak = oneam === undefined ? 1 : oneam;

  const song = a.scenarios.song;
  const loud = song === 3 ? 3 : a.thisOrThat[3] === 0 ? 2 : a.thisOrThat[3] === 1 ? 1 : 2;

  return [
    [...music].sort(),
    [crowd],
    [a.budget ?? 1],
    [peak],
    [loud],
    a.interests.length ? [...a.interests].sort() : [3],
  ];
}

/** Persona name is local copy (allowed by UI-SPEC); the meters come from the backend. */
export function archetype(a: QuizAnswers): { name: string; line: string } {
  const late = (a.scenarios.oneam ?? 1) >= 3 || (a.scenarios.onedrink ?? 0) >= 3;
  const wild = a.thisOrThat[0] === 0 || (a.scenarios.packed ?? 0) >= 3 || (a.scenarios.song ?? 0) >= 3;
  const fancy = a.thisOrThat[1] === 1;
  const talk = a.thisOrThat[3] === 1;
  const spont = (a.takes.unplanned ?? 3) >= 4 || (a.scenarios.tuesday ?? 0) >= 3;
  const squad = (a.squad ?? 1) >= 2;
  if (late && wild && (a.songs[0] ?? 0) >= 4) return { name: "Afterhours Purist", line: "Here for the 2 AM set, not the 10 PM one." };
  if (wild) return { name: "Dance Floor Regular", line: "The more packed, the better." };
  if (fancy && !wild) return { name: "Rooftop Romantic", line: "Good views, good drinks, real conversations." };
  if (talk) return { name: "Patio Philosopher", line: "Best nights are long talks under string lights." };
  if (spont) return { name: "Wildcard", line: "No plans, all vibes, somehow ends up everywhere." };
  if (squad) return { name: "Squad Captain", line: "Rolls deep. The group chat runs through you." };
  if ((a.budget ?? 1) === 0) return { name: "Free Party Finder", line: "Knows every free campus event first." };
  return { name: "All-Rounder", line: "Down for anything, as long as the people are good." };
}
