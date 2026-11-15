// Owner: Brain session. Venue insights, pure part (docs/ALGORITHM.md section 3): the question bank, which
// questions to ask, answer totals, the measured venue vector and the facts shown on a venue page.
// No runtime imports, so `node --test` loads this file directly.
import type { Bucket, Category, InsightAnswer, InsightDistribution, InsightQuestion } from "./contract";
import type { Feature } from "./recs";

export const INSIGHT_N0 = 5;                  // prior strength: after 5 answers a feature is half measured
export const LOCAL_ANSWER_WEIGHT = 1.5;       // a local knows what the place is normally like
export const UNSELECTED_WEIGHT = 0.5;         // "they didn't hear it" counts half of "they heard it"
export const UNSELECTED_TARGET = 0.1;
export const QUESTIONS_PER_VISIT = 4;
export const DASHBOARD_QUESTION_WEIGHT = 0.6; // questions that feed no feature are asked less often
export const MIN_SHOW = 5;                    // nothing is stated from fewer respondents than this
export const HIGHLIGHT_SHARE = 0.5;
export const BESTFOR_SHARE = 0.3;
export const MAX_HIGHLIGHTS = 4;
export const MAX_BESTFOR = 3;
export const CONFIDENCE_MEDIUM = 5;
export const CONFIDENCE_HIGH = 20;
export const MAX_ANSWERS_PER_SUBMIT = 8;
export const MAX_CHIPS = 4;
export const AUDIENCE_SIZE = 5;
export const AUDIENCE_MIN_LOVERS = 3;
export const ALSO_MIN_SUPPORT = 2;            // ALGORITHM.md 3e: 2 today, 3 once there is data
export const ALSO_LOVED_SIZE = 5;
export const TREND_WEEKS = 8;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONDAY_OFFSET_MS = 4 * 24 * 60 * 60 * 1000;   // 1970-01-05 was the first Monday

/** Kept next to the option counts of a question: how many people answered it (a multi-select has more picks than people). */
export const RESPONDENTS_KEY = "_n";

/** Same order as FEATURES in recs.ts (a test checks it); copied so this file has no runtime import. */
export const INSIGHT_FEATURES: readonly Feature[] = ["energy", "loudness", "crowdAge", "price", "dancing", "liveMusic",
  "pop", "hiphop", "electronic", "indie", "culture", "outdoors", "food"];

const CATEGORIES: readonly Category[] = ["nightlife", "food", "culture", "outdoors", "live", "popup"];

type Targets = Partial<Record<Feature, number>>;

export type BankOption = {
  id: string;
  label: string;
  targets?: Targets;       // what this answer says about the venue, 0 to 1
  unselected?: Targets;    // multi-select only: what NOT picking it says (weight UNSELECTED_WEIGHT)
  highlight?: string;      // venue-page phrase when most people pick it; "{pct}" becomes the share
  chip?: string;           // one person's answer on a feed card
  groupSize?: number;
};
export type BankQuestion = {
  id: string;
  text: string;
  multi: boolean;
  categories: Category[] | "all";
  options: BankOption[];   // every option; for a per-category question, the union
  optionsByCategory?: Partial<Record<Category, BankOption[]>>;
};

/** { [questionId]: { [optionId]: count, _n: respondents } } */
export type Counts = Record<string, Record<string, number>>;

const opt = (id: string, label: string, extra: Omit<BankOption, "id" | "label"> = {}): BankOption => ({ id, label, ...extra });
/** An option whose venue-page phrase and feed chip are both its own label. */
const plain = (id: string, label: string, targets?: Targets): BankOption => ({ id, label, targets, highlight: label, chip: label });

const BESTFOR_BY_CATEGORY: Record<Category, BankOption[]> = {
  nightlife: [
    opt("date_night", "Date night", { targets: { loudness: 0.3 } }),
    opt("big_groups", "Big groups"),
    opt("dancing", "Dancing", { targets: { dancing: 0.9 } }),
    opt("conversation", "Conversation", { targets: { loudness: 0.2 } }),
    opt("pregame", "Pregame"),
    opt("late_night", "Late night", { targets: { energy: 0.8 } }),
  ],
  food: [
    opt("date_night", "Date night"),
    opt("big_groups", "Big groups"),
    opt("quick_bite", "Quick bite"),
    opt("special_occasion", "Special occasion", { targets: { price: 0.8 } }),
    opt("solo", "Solo"),
  ],
  culture: [
    opt("a_date", "A date"),
    opt("kids", "Kids"),
    opt("solo", "Solo"),
    opt("rainy_day", "A rainy day"),
    opt("visitors", "Visitors"),
  ],
  outdoors: [
    opt("picnic", "Picnic"),
    opt("views", "Views"),
    opt("workout", "Workout", { targets: { energy: 0.8 } }),
    opt("dogs", "Dogs"),
    opt("sunset", "Sunset"),
  ],
  live: [
    opt("dancing", "Dancing", { targets: { dancing: 0.9 } }),
    opt("hearing_music", "Hearing the music"),
    opt("meeting_people", "Meeting people"),
    opt("a_date", "A date"),
  ],
  popup: [
    opt("dancing", "Dancing", { targets: { dancing: 0.9 } }),
    opt("hearing_music", "Hearing the music"),
    opt("meeting_people", "Meeting people"),
    opt("a_date", "A date"),
  ],
};

const unionById = (lists: BankOption[][]): BankOption[] => {
  const seen = new Map<string, BankOption>();
  for (const o of lists.flat()) if (!seen.has(o.id)) seen.set(o.id, o);
  return [...seen.values()];
};

/** Ids are stable: stored answers refer to them. Add questions and options; never rename or reuse one. */
export const QUESTION_BANK: BankQuestion[] = [
  // Universal
  {
    id: "packed", text: "How busy was it?", multi: false, categories: "all",
    options: [
      opt("empty", "Empty", { targets: { energy: 0.15 }, highlight: "Usually empty", chip: "Empty" }),
      opt("comfortable", "Comfortable", { targets: { energy: 0.4 }, highlight: "Easy to get a seat", chip: "Comfortable" }),
      plain("busy", "Busy", { energy: 0.7 }),
      plain("packed", "Packed", { energy: 0.95 }),
    ],
  },
  {
    id: "price", text: "What did you spend?", multi: false, categories: "all",
    options: [
      plain("free", "Free", { price: 0 }),
      opt("under_20", "Under $20", { targets: { price: 0.2 }, highlight: "Under $20 a head", chip: "Under $20" }),
      opt("20_50", "$20–50", { targets: { price: 0.45 }, highlight: "$20–50 a head", chip: "$20–50" }),
      opt("50_100", "$50–100", { targets: { price: 0.75 }, highlight: "$50–100 a head", chip: "$50–100" }),
      opt("100_plus", "$100+", { targets: { price: 0.95 }, highlight: "$100+ a head", chip: "$100+" }),
    ],
  },
  {
    id: "company", text: "Who were you with?", multi: false, categories: "all",
    options: [
      opt("solo", "Solo", { groupSize: 1, highlight: "Mostly solo visitors" }),
      opt("date", "A date", { groupSize: 2, highlight: "Mostly dates" }),
      opt("few_friends", "A few friends", { groupSize: 4, highlight: "Mostly small groups" }),
      opt("big_group", "A big group", { groupSize: 7, highlight: "Mostly big groups" }),
      opt("family", "Family", { groupSize: 4, highlight: "Mostly families" }),
    ],
  },
  {
    id: "return", text: "Would you go back?", multi: false, categories: "all",
    options: [
      opt("definitely", "Definitely", { highlight: "{pct}% would go back", chip: "Would go back" }),
      opt("maybe", "Maybe"),
      opt("no", "No", { highlight: "{pct}% wouldn't go back", chip: "Wouldn't go back" }),
    ],
  },
  // Per category
  {
    id: "loud", text: "How loud was it?", multi: false, categories: ["nightlife", "food", "live", "popup"],
    options: [
      plain("quiet", "Quiet", { loudness: 0.1 }),
      plain("buzzing", "Buzzing", { loudness: 0.4 }),
      plain("loud", "Loud", { loudness: 0.75 }),
      plain("deafening", "Deafening", { loudness: 1 }),
    ],
  },
  {
    id: "crowdage", text: "What was the crowd, mostly?", multi: false, categories: ["nightlife", "live", "popup", "food"],
    options: [
      opt("under_25", "Under 25", { targets: { crowdAge: 0.95 }, highlight: "Mostly under 25", chip: "Mostly under 25" }),
      opt("25_34", "25–34", { targets: { crowdAge: 0.65 }, highlight: "Mostly 25–34", chip: "Mostly 25–34" }),
      opt("35_49", "35–49", { targets: { crowdAge: 0.35 }, highlight: "Mostly 35–49", chip: "Mostly 35–49" }),
      opt("50_plus", "50+", { targets: { crowdAge: 0.1 }, highlight: "Mostly 50+", chip: "Mostly 50+" }),
      opt("mix", "A real mix", { targets: { crowdAge: 0.5 }, highlight: "Mixed-age crowd", chip: "Mixed-age crowd" }),
    ],
  },
  {
    id: "music", text: "What was playing?", multi: true, categories: ["nightlife", "live"],
    options: [
      opt("pop", "Pop / Top 40", { targets: { pop: 0.9 }, unselected: { pop: UNSELECTED_TARGET }, chip: "Pop" }),
      opt("hiphop", "Hip-hop", { targets: { hiphop: 0.9 }, unselected: { hiphop: UNSELECTED_TARGET }, chip: "Hip-hop" }),
      opt("electronic", "House / techno", { targets: { electronic: 0.9 }, unselected: { electronic: UNSELECTED_TARGET }, chip: "House / techno" }),
      opt("indie", "Indie / rock", { targets: { indie: 0.9 }, unselected: { indie: UNSELECTED_TARGET }, chip: "Indie / rock" }),
      opt("latin", "Latin", { targets: { pop: 0.5, dancing: 0.8 }, chip: "Latin" }),
      opt("live_band", "Live band", { targets: { liveMusic: 0.95 }, chip: "Live band" }),
      opt("none", "No real music", { targets: { liveMusic: 0.05, loudness: 0.2 } }),
    ],
  },
  {
    id: "dancefloor", text: "Was anyone dancing?", multi: false, categories: ["nightlife", "live"],
    options: [
      opt("nobody", "Nobody", { targets: { dancing: 0.05 }, highlight: "Nobody dances" }),
      opt("a_few", "A few", { targets: { dancing: 0.45 } }),
      opt("most", "Most of the room", { targets: { dancing: 0.95 }, highlight: "Everyone dances", chip: "Everyone dancing" }),
    ],
  },
  {
    id: "line", text: "How long did you wait to get in?", multi: false, categories: ["nightlife", "live", "popup", "food"],
    options: [
      plain("no_wait", "No wait"),
      opt("under_10", "Under 10 min", { highlight: "Short line" }),
      opt("10_30", "10–30 min", { highlight: "10–30 min line", chip: "10–30 min line" }),
      opt("over_30", "Over 30 min", { highlight: "30+ min line", chip: "30+ min line" }),
    ],
  },
  {
    id: "foodq", text: "How was the food?", multi: false, categories: ["food", "popup"],
    options: [
      opt("skip", "Skip it", { targets: { food: 0.2 }, highlight: "Skip the food" }),
      opt("fine", "Fine", { targets: { food: 0.5 } }),
      opt("great", "Great", { targets: { food: 0.8 }, highlight: "Great food", chip: "Great food" }),
      opt("best", "Best in town", { targets: { food: 1 }, highlight: "Best food in town", chip: "Best food in town" }),
    ],
  },
  {
    id: "artq", text: "How was what you saw?", multi: false, categories: ["culture"],
    options: [
      opt("skippable", "Skippable", { targets: { culture: 0.3 }, highlight: "Skippable" }),
      opt("solid", "Solid", { targets: { culture: 0.55 } }),
      opt("great", "Great", { targets: { culture: 0.8 }, highlight: "Great to see", chip: "Great to see" }),
      opt("world_class", "World class", { targets: { culture: 1 }, highlight: "World class", chip: "World class" }),
    ],
  },
  {
    id: "timeneeded", text: "How long do you need there?", multi: false, categories: ["culture", "outdoors"],
    options: [
      opt("under_30", "Under 30 min", { highlight: "Takes under 30 min" }),
      opt("hour", "About an hour", { highlight: "Takes about an hour" }),
      opt("half_day", "Half a day", { highlight: "Takes half a day" }),
      opt("full_day", "A full day", { highlight: "Takes a full day" }),
    ],
  },
  {
    id: "setting", text: "How was the setting?", multi: false, categories: ["outdoors"],
    options: [
      opt("nothing_special", "Nothing special", { targets: { outdoors: 0.3 } }),
      opt("nice", "Nice", { targets: { outdoors: 0.55 } }),
      opt("beautiful", "Beautiful", { targets: { outdoors: 0.8 }, highlight: "Beautiful setting", chip: "Beautiful setting" }),
      opt("stunning", "Stunning", { targets: { outdoors: 1 }, highlight: "Stunning setting", chip: "Stunning setting" }),
    ],
  },
  {
    id: "effort", text: "How much effort was it?", multi: false, categories: ["outdoors"],
    options: [
      plain("easy", "Easy stroll", { energy: 0.2 }),
      plain("some", "Some walking", { energy: 0.5 }),
      plain("workout", "A real workout", { energy: 0.85 }),
    ],
  },
  {
    id: "sound", text: "How was the sound?", multi: false, categories: ["live"],
    options: [
      opt("bad", "Bad", { highlight: "Bad sound" }),
      opt("ok", "OK"),
      opt("great", "Great", { highlight: "Great sound", chip: "Great sound" }),
    ],
  },
  {
    id: "worth", text: "Worth the ticket?", multi: false, categories: ["live", "popup", "culture"],
    options: [
      opt("no", "No", { highlight: "Not worth the ticket" }),
      opt("yes", "Yes", { highlight: "Worth the ticket", chip: "Worth the ticket" }),
      opt("steal", "A steal", { highlight: "A steal", chip: "A steal" }),
    ],
  },
  {
    id: "popuptype", text: "What was it, mostly?", multi: true, categories: ["popup"],
    options: [
      opt("food_drink", "Food & drink", { targets: { food: 0.8 } }),
      opt("art_design", "Art & design", { targets: { culture: 0.8 } }),
      opt("music", "Music", { targets: { liveMusic: 0.7 } }),
      opt("market", "Market / shopping", { targets: { culture: 0.5 } }),
      opt("meeting_people", "Meeting people", { targets: { energy: 0.6 } }),
    ],
  },
  {
    id: "bestfor", text: "Best for…", multi: true, categories: "all",
    options: unionById(CATEGORIES.map((c) => BESTFOR_BY_CATEGORY[c])),
    optionsByCategory: BESTFOR_BY_CATEGORY,
  },
];

/** Questions whose answers must never appear next to one person's name. */
const NO_CHIP_QUESTIONS = new Set(["company"]);
const BESTFOR_QUESTION = "bestfor";

const BANK_BY_ID = new Map(QUESTION_BANK.map((q) => [q.id, q]));
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const countOf = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : 0);
const hasTargets = (o: BankOption) => o.targets !== undefined || o.unselected !== undefined;
const clip01 = (x: number) => Math.min(1, Math.max(0, x));

/** FNV-1a, 32 bit: a stable tie-break, so a query never needs Math.random(). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const isUniversal = (q: BankQuestion) => q.categories === "all";
/** True when at least one answer moves a feature; false for analytics-only questions. */
export const feedsFeatures = (q: BankQuestion) => q.options.some(hasTargets);

/** The questions that apply to a category, in bank order, each with the options that category sees. */
export function questionsForCategory(category: Category): BankQuestion[] {
  if (!CATEGORIES.includes(category)) return [];
  return QUESTION_BANK
    .filter((q) => q.categories === "all" || q.categories.includes(category))
    .map((q) => (q.optionsByCategory === undefined ? q : { ...q, options: q.optionsByCategory[category] ?? [] }))
    .filter((q) => q.options.length > 0);
}

export const toInsightQuestion = (q: BankQuestion): InsightQuestion => ({
  id: q.id, text: q.text, multi: q.multi, options: q.options.map((o) => ({ id: o.id, label: o.label })),
});

/** How many people answered a question. Old rows without the respondent count fall back to the picks. */
export function respondentsOf(counts: Counts | undefined, question: BankQuestion): number {
  const row = isRecord(counts) ? counts[question.id] : undefined;
  if (!isRecord(row)) return 0;
  const stored = countOf(row[RESPONDENTS_KEY]);
  if (stored > 0) return stored;
  const picks = question.options.map((o) => countOf(row[o.id]));
  return question.multi ? Math.max(0, ...picks) : picks.reduce((s, x) => s + x, 0);
}

/** Entropy of the answer split over ln(options): 0 when everyone agrees, 1 when evenly split or unanswered. */
export function answerEntropy(counts: Counts | undefined, question: BankQuestion): number {
  const row = isRecord(counts) && isRecord(counts[question.id]) ? counts[question.id] : {};
  const picks = question.options.map((o) => countOf(row[o.id]));
  const total = picks.reduce((s, x) => s + x, 0);
  if (total <= 0 || question.options.length < 2) return 1;
  const h = picks.reduce((s, x) => (x > 0 ? s - (x / total) * Math.log(x / total) : s), 0);
  return clip01(h / Math.log(question.options.length));
}

/** 3c: how much one more answer to this question is worth at this venue. */
export function questionValue(counts: Counts | undefined, question: BankQuestion, n0 = INSIGHT_N0): number {
  const phi = feedsFeatures(question) ? 1 : DASHBOARD_QUESTION_WEIGHT;
  return (1 / Math.sqrt(n0 + respondentsOf(counts, question))) * (0.5 + 0.5 * answerEntropy(counts, question)) * phi;
}

/**
 * 3c: the n - 1 questions we know least about, plus the universal question with the fewest answers, so
 * price / company / return keep rotating in. Ties are broken by a hash of seed + question id: the same
 * seed always sees the same set, and two friends at the same bar see different ones.
 */
export function pickQuestions(category: Category, counts: Counts | undefined, opts: { n?: number; seed?: string } = {}): InsightQuestion[] {
  const pool = questionsForCategory(category);
  const wanted = typeof opts.n === "number" && Number.isFinite(opts.n) ? Math.floor(opts.n) : QUESTIONS_PER_VISIT;
  const n = Math.min(pool.length, Math.max(1, wanted));
  if (n === 0) return [];
  const seed = opts.seed ?? "";
  const ranked = pool
    .map((q) => ({
      q, value: questionValue(counts, q), asked: respondentsOf(counts, q), feeds: feedsFeatures(q), tie: hashString(`${seed}:${q.id}`),
    }))
    .sort((a, b) => b.value - a.value || a.tie - b.tie);
  const picked = ranked.slice(0, n - 1);
  const rest = ranked.filter((r) => !picked.includes(r));
  const floor = [...rest].filter((r) => isUniversal(r.q)).sort((a, b) => a.asked - b.asked || a.tie - b.tie)[0] ?? rest[0];
  if (floor !== undefined) picked.push(floor);
  return picked
    .sort((a, b) => +b.feeds - +a.feeds || b.value - a.value || a.tie - b.tie)
    .map((r) => toInsightQuestion(r.q));
}

/** The name ALGORITHM.md 3c uses. */
export const chooseQuestions = (category: Category, counts: Counts | undefined, seed: string, max = QUESTIONS_PER_VISIT) =>
  pickQuestions(category, counts, { n: max, seed });

/**
 * What a submit may store: known questions that apply to the category, known options, one option for a
 * single-choice question, no repeats. Anything else (an old app version, a typo) is dropped, never thrown on.
 */
export function cleanAnswers(category: Category, answers: readonly InsightAnswer[] | undefined, max = MAX_ANSWERS_PER_SUBMIT): InsightAnswer[] {
  const byId = new Map(questionsForCategory(category).map((q) => [q.id, q]));
  const out: InsightAnswer[] = [];
  const seen = new Set<string>();
  for (const a of Array.isArray(answers) ? answers : []) {
    if (out.length >= max) break;
    const q = isRecord(a) && typeof a.questionId === "string" ? byId.get(a.questionId) : undefined;
    if (q === undefined || seen.has(q.id) || !Array.isArray(a.optionIds)) continue;
    const chosen = q.options.filter((o) => a.optionIds.includes(o.id)).map((o) => o.id);
    const optionIds = q.multi ? chosen : (a.optionIds as unknown[]).filter((id): id is string => chosen.includes(id as string)).slice(0, 1);
    if (optionIds.length === 0) continue;
    seen.add(q.id);
    out.push({ questionId: q.id, optionIds });
  }
  return out;
}

/**
 * Adds `weight` per picked option, and per respondent under RESPONDENTS_KEY. Returns a new object.
 * Unknown question or option ids are ignored. A negative weight subtracts; entries that reach zero
 * are deleted, so adding and then removing the same answers gives back the same totals.
 */
export function addAnswers(counts: Counts | undefined, answers: readonly InsightAnswer[] | undefined, weight = 1): Counts {
  const out: Counts = {};
  if (isRecord(counts)) {
    for (const [qid, row] of Object.entries(counts)) {
      if (!isRecord(row)) continue;
      const kept = Object.entries(row).filter(([, c]) => countOf(c) > 0) as [string, number][];
      if (kept.length > 0) out[qid] = Object.fromEntries(kept);
    }
  }
  if (!Number.isFinite(weight) || weight === 0) return out;
  const seen = new Set<string>();
  for (const a of Array.isArray(answers) ? answers : []) {
    const q = isRecord(a) && typeof a.questionId === "string" ? BANK_BY_ID.get(a.questionId) : undefined;
    if (q === undefined || seen.has(q.id) || !Array.isArray(a.optionIds)) continue;
    const valid = q.options.filter((o) => a.optionIds.includes(o.id)).map((o) => o.id);
    const optionIds = q.multi ? valid : (a.optionIds as unknown[]).filter((id): id is string => valid.includes(id as string)).slice(0, 1);
    if (optionIds.length === 0) continue;
    seen.add(q.id);
    const row = { ...(out[q.id] ?? {}) };
    for (const key of [...optionIds, RESPONDENTS_KEY]) {
      const next = (row[key] ?? 0) + weight;
      if (next > 1e-9) row[key] = next;
      else delete row[key];
    }
    if (Object.keys(row).length > 0) out[q.id] = row;
    else delete out[q.id];
  }
  return out;
}

export const removeAnswers = (counts: Counts | undefined, answers: readonly InsightAnswer[] | undefined, weight = 1): Counts =>
  addAnswers(counts, answers, -weight);

/**
 * 3b: the measured value of each feature (mu) and the weight of answers behind it (n), from the totals.
 * `counts` holds everyone's answers; `localCounts` the subset given by locals, who count
 * LOCAL_ANSWER_WEIGHT instead of 1. Features nobody has spoken to have weight 0 (and value 0).
 * `category` says whose options are read: "Date night" means a quiet room for a bar and nothing for a
 * restaurant. Without it the union of every category's options is used (first definition of an id wins).
 * Questions fewer than `minRespondents` people answered are left out.
 */
export function observedVector(
  counts: Counts | undefined, localCounts?: Counts, category?: Category, minRespondents = 0,
): { vector: number[]; weight: number[] } {
  const sum = INSIGHT_FEATURES.map(() => 0);
  const weight = INSIGHT_FEATURES.map(() => 0);
  const extra = LOCAL_ANSWER_WEIGHT - 1;
  const read = (qid: string, key: string) => {
    const all = isRecord(counts) && isRecord(counts[qid]) ? countOf(counts[qid][key]) : 0;
    const local = isRecord(localCounts) && isRecord(localCounts[qid]) ? countOf(localCounts[qid][key]) : 0;
    return all + extra * Math.min(local, all);
  };
  const add = (targets: Targets | undefined, w: number) => {
    if (targets === undefined || w <= 0) return;
    for (const [feature, target] of Object.entries(targets)) {
      const k = INSIGHT_FEATURES.indexOf(feature as Feature);
      if (k < 0 || typeof target !== "number") continue;
      sum[k] += w * target;
      weight[k] += w;
    }
  };
  for (const q of category === undefined ? QUESTION_BANK : questionsForCategory(category)) {
    if (!feedsFeatures(q) || respondentsOf(counts, q) < minRespondents) continue;
    const respondents = read(q.id, RESPONDENTS_KEY);
    for (const o of q.options) {
      const picked = read(q.id, o.id);
      add(o.targets, picked);
      if (q.multi) add(o.unselected, UNSELECTED_WEIGHT * Math.max(0, respondents - picked));
    }
  }
  return { vector: sum.map((s, k) => (weight[k] > 0 ? clip01(s / weight[k]) : 0)), weight };
}

/**
 * What may leave the backend as a venue vector: the same measurement, from the questions at least MIN_SHOW
 * people answered at this venue. A vector moved by one person's answers can be solved for those answers
 * (the prior and n0 are known), so the rule that hides a split under MIN_SHOW respondents applies here too.
 */
export const measuredVector = (category: Category, counts: Counts | undefined, localCounts?: Counts, minRespondents = MIN_SHOW) =>
  observedVector(counts, localCounts, category, minRespondents);

/**
 * 3b: the prior shrunk toward what was measured, f = (n0 * prior + n * mu) / (n0 + n) per feature.
 * With no answers for a feature this is the prior exactly.
 */
export function blendVector(prior: number[], observed?: number[], weight?: number[], n0 = INSIGHT_N0): number[] {
  if (observed === undefined || weight === undefined || observed.length !== prior.length || weight.length !== prior.length) return [...prior];
  return prior.map((p, k) => {
    const n = weight[k], mu = observed[k];
    if (!Number.isFinite(n) || n <= 0 || !Number.isFinite(mu)) return p;
    return clip01((Math.max(0, n0) * p + n * mu) / (Math.max(0, n0) + n));
  });
}

/**
 * Section 2.3 rule 6: a feature is "measured" once the weight of answers behind it reaches n0, the point
 * where the blend is at least half what visitors said. `weight` is a venue's `observedWeight`.
 */
export const isMeasured = (feature: Feature | undefined, weight: number[] | undefined, n0 = INSIGHT_N0) =>
  feature !== undefined && weight !== undefined && (weight[INSIGHT_FEATURES.indexOf(feature)] ?? 0) >= n0;

/** True when any feature has answers behind it, i.e. the blend differs from the prior. */
export const hasObservations = (weight: number[] | undefined) => weight !== undefined && weight.some((w) => w > 0);

type Tally = { question: BankQuestion; total: number; options: { option: BankOption; count: number; share: number }[] };

function tally(category: Category, counts: Counts | undefined): Tally[] {
  return questionsForCategory(category).map((question) => {
    const row = isRecord(counts) && isRecord(counts[question.id]) ? counts[question.id] : {};
    const total = respondentsOf(counts, question);
    return {
      question, total,
      options: question.options.map((option) => {
        const count = Math.min(countOf(row[option.id]), total);
        return { option, count, share: total > 0 ? count / total : 0 };
      }),
    };
  });
}

/**
 * One entry per question of the category, in bank order. `total` is always the number of respondents.
 * Below MIN_SHOW the split itself is withheld (every count 0, no `top`): the answers of one or two
 * people are not a fact about the venue and could point at who gave them.
 */
export function distributions(category: Category, counts: Counts | undefined): InsightDistribution[] {
  return tally(category, counts).map(({ question, total, options }) => {
    const show = total >= MIN_SHOW;
    const leader = [...options].sort((a, b) => b.count - a.count)[0];
    const dist: InsightDistribution = {
      questionId: question.id,
      text: question.text,
      total,
      options: options.map(({ option, count, share }) => ({
        id: option.id, label: option.label, count: show ? count : 0, pct: show ? Math.round(share * 100) : 0,
      })),
    };
    if (show && leader !== undefined && leader.count > 0) dist.top = leader.option.label;
    return dist;
  });
}

/**
 * 3d: one phrase per single-choice question whose leading option has at least HIGHLIGHT_SHARE of at
 * least MIN_SHOW respondents (and is not tied for the lead). Strongest first, at most MAX_HIGHLIGHTS.
 */
export function highlights(category: Category, counts: Counts | undefined): string[] {
  const found: { text: string; share: number }[] = [];
  for (const { question, total, options } of tally(category, counts)) {
    if (question.multi || total < MIN_SHOW) continue;
    const [first, second] = [...options].sort((a, b) => b.count - a.count);
    if (first === undefined || first.option.highlight === undefined) continue;
    if (first.share < HIGHLIGHT_SHARE || (second !== undefined && second.count === first.count)) continue;
    found.push({ text: first.option.highlight.replace("{pct}", String(Math.round(first.share * 100))), share: first.share });
  }
  return found.sort((a, b) => b.share - a.share).slice(0, MAX_HIGHLIGHTS).map((h) => h.text);
}

/** 3d: the "best for" options picked by at least BESTFOR_SHARE of at least MIN_SHOW respondents, top MAX_BESTFOR. */
export function bestFor(category: Category, counts: Counts | undefined): string[] {
  const row = tally(category, counts).find((t) => t.question.id === BESTFOR_QUESTION);
  if (row === undefined || row.total < MIN_SHOW) return [];
  return row.options
    .filter((o) => o.share >= BESTFOR_SHARE)
    .sort((a, b) => b.share - a.share)
    .slice(0, MAX_BESTFOR)
    .map((o) => o.option.label);
}

export const confidenceOf = (nAnswers: number): "low" | "medium" | "high" =>
  nAnswers >= CONFIDENCE_HIGH ? "high" : nAnswers >= CONFIDENCE_MEDIUM ? "medium" : "low";

/** 3d in one call. With low confidence (under 5 people answered anything) nothing is stated at all. */
export function summarize(category: Category, counts: Counts | undefined, nRespondents: number): {
  distributions: InsightDistribution[]; highlights: string[]; bestFor: string[]; confidence: "low" | "medium" | "high";
} {
  const confidence = confidenceOf(nRespondents);
  const low = confidence === "low";
  return {
    distributions: distributions(category, counts),
    highlights: low ? [] : highlights(category, counts),
    bestFor: low ? [] : bestFor(category, counts),
    confidence,
  };
}

/** Short labels of one person's own answers for a feed card ("Packed", "Mostly 25–34"), in bank order. */
export function answerChips(answers: readonly InsightAnswer[] | undefined, max = MAX_CHIPS): string[] {
  const list = Array.isArray(answers) ? answers.filter((a) => isRecord(a) && Array.isArray(a.optionIds)) : [];
  const chips: string[] = [];
  for (const q of QUESTION_BANK) {
    if (NO_CHIP_QUESTIONS.has(q.id)) continue;
    const answer = list.find((a) => a.questionId === q.id);
    if (answer === undefined) continue;
    const picked = q.options.filter((o) => answer.optionIds.includes(o.id) && o.chip !== undefined);
    for (const o of q.multi ? picked.slice(0, 2) : picked.slice(0, 1)) {
      if (o.chip !== undefined && !chips.includes(o.chip)) chips.push(o.chip);
    }
  }
  return chips.slice(0, Math.max(0, max));
}

/** Average party size from the "who were you with" answers, or undefined when nobody answered. */
export function averageGroupSize(counts: Counts | undefined): number | undefined {
  const q = BANK_BY_ID.get("company");
  const row = q !== undefined && isRecord(counts) && isRecord(counts[q.id]) ? counts[q.id] : undefined;
  if (q === undefined || row === undefined) return undefined;
  let people = 0, n = 0;
  for (const o of q.options) {
    const c = countOf(row[o.id]);
    people += c * (o.groupSize ?? 0);
    n += c;
  }
  return n > 0 ? people / n : undefined;
}

// ───────────── Dashboard math (3e). Plain data in, plain data out; convex/insights.ts does the reads. ─────────────

const DASHBOARD_PHRASES: Record<Feature, string> = {
  energy: "High energy", loudness: "Loud rooms", crowdAge: "Young crowds", price: "Upscale spots", dancing: "Dancing",
  liveMusic: "Live music", pop: "Pop music", hiphop: "Hip-hop", electronic: "Electronic music", indie: "Indie scene",
  culture: "Art and culture", outdoors: "Outdoors", food: "Great food",
};

const meanVector = (rows: number[][]) =>
  INSIGHT_FEATURES.map((_, k) => rows.reduce((s, r) => s + (r[k] ?? 0), 0) / Math.max(1, rows.length));

/**
 * What sets the people who loved a place apart: mean taste of the lovers minus mean taste of every
 * rater, the AUDIENCE_SIZE features with the largest positive gap. Empty under AUDIENCE_MIN_LOVERS.
 */
export function audienceProfile(loverTastes: number[][], allTastes: number[][]): { label: string; pct: number }[] {
  const ok = (t: number[]) => Array.isArray(t) && t.length === INSIGHT_FEATURES.length;
  const lovers = loverTastes.filter(ok), all = allTastes.filter(ok);
  if (lovers.length < AUDIENCE_MIN_LOVERS || all.length === 0) return [];
  const mine = meanVector(lovers), base = meanVector(all);
  return INSIGHT_FEATURES
    .map((feature, k) => ({ feature, gap: mine[k] - base[k], mean: mine[k] }))
    .filter((f) => f.gap > 1e-9)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, AUDIENCE_SIZE)
    .map((f) => ({ label: DASHBOARD_PHRASES[f.feature], pct: Math.round(clip01(f.mean) * 100) }));
}

/** Counts of whole-number values in [0, size); anything else is skipped. */
export function histogram(values: (number | undefined)[], size: number): number[] {
  const out = Array.from({ length: size }, () => 0);
  for (const x of values) if (typeof x === "number" && Number.isInteger(x) && x >= 0 && x < size) out[x] += 1;
  return out;
}

export function bucketCounts(buckets: Bucket[]): { loved: number; fine: number; didnt: number } {
  const out = { loved: 0, fine: 0, didnt: 0 };
  for (const b of buckets) if (b in out) out[b] += 1;
  return out;
}

/** Head-to-head record of one item from comparison rows: the win rate and the tally against each opponent. */
export function winRecord(itemId: string, comparisons: { winnerId: string; loserId: string }[]): {
  wins: number; losses: number; winRate?: number; opponents: { id: string; wins: number; losses: number }[];
} {
  const versus = new Map<string, { id: string; wins: number; losses: number }>();
  let wins = 0, losses = 0;
  for (const c of comparisons) {
    if (c.winnerId === c.loserId || (c.winnerId !== itemId && c.loserId !== itemId)) continue;
    const won = c.winnerId === itemId;
    const other = won ? c.loserId : c.winnerId;
    const row = versus.get(other) ?? { id: other, wins: 0, losses: 0 };
    if (won) { row.wins += 1; wins += 1; } else { row.losses += 1; losses += 1; }
    versus.set(other, row);
  }
  const total = wins + losses;
  return {
    wins, losses,
    winRate: total > 0 ? Math.round((wins / total) * 100) / 100 : undefined,
    opponents: [...versus.values()].sort((a, b) => b.wins + b.losses - (a.wins + a.losses) || b.wins - a.wins),
  };
}

/** lift(i -> j) = P(loved j | loved i) / P(loved j). 1 means "no more than anyone"; 0 when it cannot be computed. */
export function lift(both: number, lovedI: number, lovedJ: number, nUsers: number): number {
  if (both <= 0 || lovedI <= 0 || lovedJ <= 0 || nUsers <= 0) return 0;
  return (both / lovedI) / (lovedJ / nUsers);
}

/**
 * "Also loved": from the loved lists of the people who loved item i, the other items at least
 * `minSupport` of them loved too, with how many. Each list is one person's; repeats in a list count once.
 */
export function coLoved(itemId: string, lovedLists: string[][], minSupport = ALSO_MIN_SUPPORT): { id: string; both: number }[] {
  const both = new Map<string, number>();
  for (const list of lovedLists) {
    for (const id of new Set(list)) if (id !== itemId) both.set(id, (both.get(id) ?? 0) + 1);
  }
  return [...both.entries()]
    .filter(([, n]) => n >= minSupport)
    .map(([id, n]) => ({ id, both: n }))
    .sort((a, b) => b.both - a.both || (a.id < b.id ? -1 : 1));
}

/** Monday 00:00 UTC of the week a timestamp falls in. */
export const weekStartOf = (ms: number) => Math.floor((ms - MONDAY_OFFSET_MS) / WEEK_MS) * WEEK_MS + MONDAY_OFFSET_MS;

/**
 * Average score and count per week, oldest first, for the `weeks` weeks ending at the newest rating.
 * Anchored on the data, not on the clock, so a live query returns the same thing until a rating arrives.
 */
export function weeklyTrend(points: { at: number; score: number }[], weeks = TREND_WEEKS): { weekStart: number; avgScore: number; n: number }[] {
  const valid = points.filter((p) => Number.isFinite(p.at) && Number.isFinite(p.score));
  if (valid.length === 0) return [];
  const last = Math.max(...valid.map((p) => weekStartOf(p.at)));
  const first = last - (weeks - 1) * WEEK_MS;
  const byWeek = new Map<number, { sum: number; n: number }>();
  for (const p of valid) {
    const week = weekStartOf(p.at);
    if (week < first) continue;
    const row = byWeek.get(week) ?? { sum: 0, n: 0 };
    row.sum += p.score; row.n += 1;
    byWeek.set(week, row);
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekStart, { sum, n }]) => ({ weekStart, avgScore: Math.round((sum / n) * 10) / 10, n }));
}
