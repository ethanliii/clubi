import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Id } from "../../../convex/_generated/dataModel";
import { Icon, Text, TextField, useToast } from "../../components";
import { birthdayEntryToIso, birthdayProblem, formatBirthdayEntry } from "../../features/auth/birthday";
import { QuizOption } from "../../features/onboarding/QuizOption";
import { QuizProgress } from "../../features/onboarding/QuizProgress";
import { rememberQuizResult } from "../../features/onboarding/quizResult";
import { Rise } from "../../features/onboarding/Rise";
import { SpinnerButton } from "../../features/onboarding/SpinnerButton";
import {
  AGREE, BUDGET, DAYS, INTERESTS, SCENARIOS, SONGS, SQUAD, TAKES, THIS_OR_THAT,
  emptyAnswers, nightCaption, toBackendCards, type QuizAnswers, type Stars,
} from "../../features/onboarding/tasteQuiz";
import { api } from "../../lib/api";
import { confirm } from "../../lib/confirm";
import { errorMessage } from "../../lib/errors";
import { paths } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { useNearby } from "../../lib/useNearby";
import { colors, fontWeight, layout, palette, radius } from "../../theme";

type Step = { title: string; hint: string; done: boolean; body: ReactNode };

/** Today, outside the component (the purity lint). */
function today(): Date {
  return new Date();
}

/** Whole years since a YYYY-MM-DD birthday (display only; the backend applies the 21+ rule). */
function ageOn(iso: string): number {
  return Math.floor((new Date().getTime() - new Date(iso).getTime()) / 31_557_600_000);
}

/**
 * Bryan's taste quiz in this app's style, one question a screen: birthday, songs, this or that,
 * three random scenarios, squad, nights, budget, hot takes, interests, "Been here?".
 * "See my taste" maps the answers onto the backend's six cards (`users.saveQuiz`), saves the rest
 * (`onboarding.saveExtendedQuiz`, `onboarding.seedRatings`, birthday via `settings.update`) and
 * opens You're in.
 */
export default function Quiz() {
  const [step, setStep] = useState(0);
  // Which way the next card slides in from: 1 after "Next", -1 after "Back".
  const [direction, setDirection] = useState<1 | -1>(1);
  const [a, setA] = useState<QuizAnswers>(emptyAnswers);
  const set = (patch: Partial<QuizAnswers> | ((x: QuizAnswers) => Partial<QuizAnswers>)) =>
    setA((x) => ({ ...x, ...(typeof patch === "function" ? patch(x) : patch) }));

  const { run: saveQuiz, pending } = useMutationToast(api.users.saveQuiz);
  const updateSettings = useMutation(api.settings.update);
  const saveExtended = useMutation(api.onboarding.saveExtendedQuiz);
  const seedRatings = useMutation(api.onboarding.seedRatings);
  const settings = useQuery(api.settings.get, {});
  const { signOut } = useAuthActions();
  const toast = useToast();
  const [leaving, setLeaving] = useState(false);
  const busy = pending || leaving;

  // Birthday: what was typed here, else what sign-up already saved.
  const birthday = a.birthday || (settings?.birthday ?? "");
  const birthdayIso = birthdayEntryToIso(birthday);
  const birthdayError = birthdayIso === null || birthdayIso === "" ? null : birthdayProblem(birthdayIso, today());
  const birthdayOk = !!birthdayIso && birthdayError === null;

  const steps: Step[] = [
    {
      title: "When's your birthday?",
      hint: "Only used to keep 21+ spots away from under-21s. Never shown.",
      done: birthdayOk,
      body: (
        <View style={styles.options}>
          <TextField
            label="Birthday"
            placeholder="MM/DD/YYYY"
            keyboardType="number-pad"
            value={formatBirthdayEntry(birthday)}
            onChangeText={(t) => set({ birthday: formatBirthdayEntry(t) })}
            error={birthdayError}
            maxLength={10}
          />
          {birthdayOk ? <Text style={styles.confirm}>{`You're ${ageOn(birthdayIso!)}`}</Text> : null}
        </View>
      ),
    },
    {
      title: "Rate these songs",
      hint: "Tap the stars. Rate at least three.",
      done: Object.keys(a.songs).length >= 3,
      body: (
        <View style={styles.options}>
          {SONGS.map((song, i) => (
            <View key={song.title} style={styles.songRow}>
              <View style={[styles.cover, { backgroundColor: `hsl(${song.hue}, 55%, 45%)` }]} />
              <View style={styles.flex}>
                <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
                <Text variant="caption" muted numberOfLines={1}>{song.artist} · {song.genre}</Text>
              </View>
              <View style={styles.stars}>
                {([1, 2, 3, 4, 5] as Stars[]).map((n) => (
                  <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${song.title}: ${n} stars`} hitSlop={3}
                    onPress={() => set((x) => ({ songs: { ...x.songs, [i]: n } }))}>
                    <Text style={[styles.star, (a.songs[i] ?? 0) >= n && styles.starOn]}>★</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      ),
    },
    {
      title: "This or that?",
      hint: "Go with your gut.",
      done: THIS_OR_THAT.every((_, i) => a.thisOrThat[i] !== undefined),
      body: (
        <View style={styles.options}>
          {THIS_OR_THAT.map((pair, i) => (
            <View key={pair[0]} style={styles.pair}>
              {pair.map((label, side) => (
                <View key={label} style={styles.flex}>
                  <QuizOption label={label} many={false} selected={a.thisOrThat[i] === side} disabled={busy}
                    onPress={() => set((x) => { const t = [...x.thisOrThat]; t[i] = side as 0 | 1; return { thisOrThat: t }; })} />
                </View>
              ))}
            </View>
          ))}
        </View>
      ),
    },
    ...a.scenarioKeys.map((key): Step => ({
      title: SCENARIOS[key].text,
      hint: "Choose one",
      done: a.scenarios[key] !== undefined,
      body: (
        <View accessibilityRole="radiogroup" style={styles.options}>
          {SCENARIOS[key].options.map((label, i) => (
            <QuizOption key={label} label={label} many={false} selected={a.scenarios[key] === i} disabled={busy}
              onPress={() => set((x) => ({ scenarios: { ...x.scenarios, [key]: i } }))} />
          ))}
        </View>
      ),
    })),
    {
      title: "Your usual squad",
      hint: "How many people do you go out with?",
      done: a.squad !== undefined,
      body: (
        <View accessibilityRole="radiogroup" style={styles.options}>
          {SQUAD.map((label, i) => (
            <QuizOption key={label} label={label} many={false} selected={a.squad === i} disabled={busy} onPress={() => set({ squad: i })} />
          ))}
        </View>
      ),
    },
    {
      title: "When do you go out?",
      hint: "Tap once for sometimes, twice for always.",
      done: a.nights.some(Boolean),
      body: (
        <View style={{ gap: 16 }}>
          <View style={styles.days}>
            {DAYS.map((d, i) => {
              const v = a.nights[i] ?? 0;
              return (
                <Pressable key={d} accessibilityRole="button" accessibilityLabel={`${d}: ${v === 1 ? "always" : v ? "sometimes" : "never"}`}
                  onPress={() => set((x) => ({ nights: x.nights.map((n, j) => (j === i ? (n === 0 ? 0.5 : n === 0.5 ? 1 : 0) : n)) }))}
                  style={styles.day}>
                  <View style={[styles.dayDot, v === 0.5 && styles.dayHalf, v === 1 && styles.dayFull]} />
                  <Text variant="caption">{d}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.confirm}>{nightCaption(a.nights)}</Text>
        </View>
      ),
    },
    {
      title: "What does a night cost you?",
      hint: "Total for the whole night.",
      done: a.budget !== undefined,
      body: (
        <View accessibilityRole="radiogroup" style={styles.options}>
          {BUDGET.map((b, i) => (
            <QuizOption key={b.amount} label={`${b.amount} · ${b.label}`} many={false} selected={a.budget === i} disabled={busy}
              onPress={() => set({ budget: i })} />
          ))}
        </View>
      ),
    },
    {
      title: "Hot takes",
      hint: "How much do you agree?",
      done: TAKES.every((t) => a.takes[t.key] !== undefined),
      body: (
        <View style={{ gap: 18 }}>
          {TAKES.map((t) => (
            <View key={t.key} style={{ gap: 8 }}>
              <Text style={styles.songTitle}>{t.text}</Text>
              <View style={styles.scale}>
                {AGREE.map((label, i) => {
                  const on = a.takes[t.key] === i + 1;
                  return (
                    <Pressable key={label} accessibilityRole="button" accessibilityLabel={`${t.text}: ${label}`}
                      onPress={() => set((x) => ({ takes: { ...x.takes, [t.key]: i + 1 } }))}
                      style={[styles.scaleDot, on && styles.scaleOn]} />
                  );
                })}
              </View>
              <View style={styles.scaleEnds}>
                <Text variant="caption" muted>Disagree</Text>
                <Text variant="caption" muted>Agree</Text>
              </View>
            </View>
          ))}
        </View>
      ),
    },
    {
      title: "Besides nightlife you're into…",
      hint: "Select all that apply",
      done: a.interests.length > 0,
      body: (
        <View style={styles.chips}>
          {INTERESTS.map((label, i) => (
            <QuizOption key={label} label={label} many selected={a.interests.includes(i)} disabled={busy}
              onPress={() => set((x) => ({ interests: x.interests.includes(i) ? x.interests.filter((n) => n !== i) : [...x.interests, i] }))} />
          ))}
        </View>
      ),
    },
    {
      title: "Been here?",
      hint: "Rate spots you know. These become your first ratings. Optional.",
      done: true,
      body: <BeenHere a={a} set={set} />,
    },
  ];

  const s = steps[step]!;
  const isLast = step === steps.length - 1;

  const go = (to: number) => {
    setDirection(to > step ? 1 : -1);
    setStep(to);
  };

  const next = async () => {
    if (!s.done || busy) return;
    if (!isLast) {
      go(step + 1);
      return;
    }
    const cards = toBackendCards(a);
    // On failure the toast has shown the backend's sentence and we stay on the last card.
    const saved = await saveQuiz({ answers: cards });
    if (saved === undefined) return;
    const seeds = Object.entries(a.beenHere).flatMap(([id, v]) =>
      v.bucket === "skip" ? [] : [{ kind: v.kind, id: id as Id<"places"> | Id<"events">, bucket: v.bucket }],
    );
    // The extras never block onboarding.
    await Promise.allSettled([
      birthdayIso ? updateSettings({ birthday: birthdayIso }) : null,
      saveExtended({ answers: a }),
      seeds.length ? seedRatings({ items: seeds }) : null,
    ]);
    rememberQuizResult({ answers: cards, tasteSummary: saved.tasteSummary, full: a });
    router.push(paths.tasteCard);
  };

  // The way out for someone who signed in to the wrong account. The gate shows Welcome afterwards.
  const leave = async () => {
    const sure = await confirm({
      title: "Sign out?",
      message: "You can sign back in and take the quiz any time.",
      confirmLabel: "Sign out",
    });
    if (!sure) return;
    setLeaving(true);
    try {
      await signOut();
    } catch (error) {
      toast(errorMessage(error), "error");
      setLeaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.top}>
        <View style={styles.bar}>
          {step > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={busy} onPress={() => go(step - 1)}
              style={({ pressed }) => [styles.back, (pressed || busy) && styles.dimmed]}>
              <Icon name="back" size={24} color={colors.fg} />
            </Pressable>
          ) : (
            <View style={styles.back} />
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="Sign out" disabled={busy} onPress={() => void leave()}
            style={({ pressed }) => [styles.signOut, (pressed || busy) && styles.dimmed]}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
        <QuizProgress step={step} total={steps.length} />
      </View>
      <ScrollView key={step} style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <Rise axis="x" from={direction * 28} style={styles.question}>
          <Text style={styles.count} accessibilityLabel={`Quiz, ${step + 1} of ${steps.length}`}>
            Question {step + 1} of {steps.length}
          </Text>
          <Text accessibilityRole="header" style={styles.title}>{s.title}</Text>
          <Text style={styles.hint}>{s.hint}</Text>
        </Rise>
        <Rise delay={40} from={10} duration={260}>{s.body}</Rise>
      </ScrollView>
      <View style={styles.footer}>
        {/* On a short phone the answers scroll; they fade out under the button instead of being cut. */}
        <LinearGradient colors={[FADE_FROM, colors.bg]} style={styles.fade} />
        <SpinnerButton
          title={isLast ? "See my taste" : "Next"}
          accessibilityLabel={isLast ? "See my taste" : "Next"}
          busy={pending}
          disabled={!s.done || leaving}
          buttonStyle={styles.next}
          onPress={() => void next()}
        />
        <Text variant="caption" muted center>Shapes your matches, not your profile</Text>
      </View>
    </SafeAreaView>
  );
}

const BUCKETS = [
  { bucket: "loved", label: "Absolutely" },
  { bucket: "fine", label: "Depends" },
  { bucket: "didnt", label: "Nope" },
  { bucket: "skip", label: "Haven't been" },
] as const;

/** Nearby spots to seed ratings ("Would you go back?"); saved with `onboarding.seedRatings`. */
function BeenHere({ a, set }: { a: QuizAnswers; set: (p: (x: QuizAnswers) => Partial<QuizAnswers>) => void }) {
  const nearby = useNearby("all");
  if (nearby === undefined) return <Text muted>Finding spots near you…</Text>;
  const spots = nearby.items.slice(0, 6);
  if (spots.length === 0) return <Text muted>{"No spots loaded for your area yet. You can skip this."}</Text>;
  return (
    <View style={{ gap: 16 }}>
      {spots.map((v) => (
        <View key={String(v.id)} style={{ gap: 8 }}>
          <Text style={styles.songTitle}>{v.name}</Text>
          <View style={styles.chips}>
            {BUCKETS.map((b) => (
              <QuizOption key={b.bucket} label={b.label} many selected={a.beenHere[String(v.id)]?.bucket === b.bucket}
                onPress={() => set((x) => ({ beenHere: { ...x.beenHere, [String(v.id)]: { kind: v.kind, bucket: b.bucket } } }))} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const SIDE = layout.gutter;
/** The page colour with no opacity (8-digit hex), so the fade above the button has no grey in it. */
const FADE_FROM = `${colors.bg}00`;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  top: { paddingHorizontal: SIDE, paddingTop: 4, gap: 8 },
  bar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 48 },
  back: { width: 76, height: 44, marginLeft: -10, paddingLeft: 10, justifyContent: "center" },
  count: {
    color: colors.muted, fontSize: 12, lineHeight: 16, fontWeight: fontWeight.bold, letterSpacing: 1,
    textTransform: "uppercase", marginBottom: 4, fontVariant: ["tabular-nums"],
  },
  signOut: { width: 76, height: 44, alignItems: "flex-end", justifyContent: "center" },
  signOutText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  dimmed: { opacity: 0.5 },
  content: { flexGrow: 1, paddingHorizontal: SIDE, paddingTop: 30, paddingBottom: 30, gap: 26 },
  question: { gap: 8 },
  title: { fontSize: 34, lineHeight: 39, fontWeight: "800", letterSpacing: -0.8, color: colors.fg },
  hint: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  options: { gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  confirm: { color: colors.fg, fontSize: 17, lineHeight: 22, fontWeight: fontWeight.bold, textAlign: "center" },
  songRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.lg, backgroundColor: palette.field },
  cover: { width: 44, height: 44, borderRadius: 8 },
  songTitle: { color: colors.fg, fontSize: 15, lineHeight: 20, fontWeight: fontWeight.semibold },
  stars: { flexDirection: "row" },
  star: { fontSize: 22, lineHeight: 26, color: colors.line, paddingHorizontal: 1 },
  starOn: { color: "#f5b301" },
  pair: { flexDirection: "row", gap: 10 },
  days: { flexDirection: "row", justifyContent: "space-between" },
  day: { alignItems: "center", gap: 6, paddingVertical: 4, minWidth: 40 },
  dayDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.line, backgroundColor: palette.field },
  dayHalf: { borderColor: colors.fg, backgroundColor: colors.raised },
  dayFull: { borderColor: colors.fg, backgroundColor: colors.fg },
  scale: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6 },
  scaleDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.line, backgroundColor: palette.field },
  scaleOn: { borderColor: colors.fg, backgroundColor: colors.fg },
  scaleEnds: { flexDirection: "row", justifyContent: "space-between" },
  footer: { paddingHorizontal: SIDE, paddingTop: 8, paddingBottom: 14, gap: 10 },
  fade: { position: "absolute", left: 0, right: 0, top: -28, height: 28, pointerEvents: "none" },
  next: { minHeight: 54 },
});
