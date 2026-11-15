import { useMutation } from "convex/react";
import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Icon, Text, VenuePhoto } from "../../components";
import { onboardingColors } from "../../theme";
import {
  AGREE, BUDGET, DAYS, DEALBREAKERS, DRINKING, INTERESTS, SCENARIOS, SONGS, SQUAD, TAKES,
  THIS_OR_THAT, TRANSPORT, nightCaption, toBackendCards, type QuizAnswers, type Stars,
} from "../../features/quiz";
import { setDemo } from "../../lib/demoLocation";
import { useNearby } from "../../lib/useNearby";
import { useOnboarding } from "../../state/onboarding";

// Hinge-style onboarding look: cream background, serif questions, black accents.
const Q = onboardingColors;
const serif = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, serif" });

type Step = { title: string; sub: string; note?: string; done: (a: QuizAnswers) => boolean; body: () => ReactNode };

export default function Quiz() {
  const { answers: a, update, setTasteSummary, startQuiz } = useOnboarding();
  const saveQuiz = useMutation(api.users.saveQuiz);
  const saveExtended = useMutation(api.onboarding.saveExtendedQuiz);
  const seedRatings = useMutation(api.onboarding.seedRatings);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(startQuiz, [startQuiz]);

  const toggle = (list: number[], i: number) => (list.includes(i) ? list.filter((x) => x !== i) : [...list, i]);

  const steps: Step[] = [
    {
      title: "Vibe check",
      sub: "Rate each song 1 to 5 stars.",
      note: "Shapes your matches, not your profile",
      done: () => Object.keys(a.songs).length >= 3,
      body: () =>
        SONGS.map((s, i) => (
          <View key={s.title} style={styles.row}>
            <VenuePhoto hue={s.hue} height={44} style={styles.cover} />
            <View style={styles.flex}>
              <Text style={styles.strong}>{s.title}</Text>
              <Text variant="caption" style={styles.muted}>{s.artist} · {s.genre}</Text>
            </View>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} accessibilityLabel={`${n} stars for ${s.title}`} hitSlop={4}
                  onPress={() => update((x) => ({ songs: { ...x.songs, [i]: n as Stars } }))}>
                  <Text style={[styles.star, (a.songs[i] ?? 0) >= n && styles.starOn]}>★</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )),
    },
    {
      title: "This or that",
      sub: "Go with your gut.",
      done: () => a.thisOrThat.length >= THIS_OR_THAT.length,
      body: () => {
        const k = a.thisOrThat.length;
        if (k >= THIS_OR_THAT.length)
          return THIS_OR_THAT.map((pair, i) => (
            <Text key={i} style={styles.strong}>{i + 1}. {pair[a.thisOrThat[i]!]}</Text>
          ));
        return (
          <View style={{ gap: 10 }}>
            <Text center style={styles.muted}>{k + 1} of {THIS_OR_THAT.length}</Text>
            {THIS_OR_THAT[k]!.map((label, j) => (
              <Pressable key={label} accessibilityRole="button" accessibilityLabel={label}
                onPress={() => update((x) => ({ thisOrThat: [...x.thisOrThat, j as 0 | 1] }))}>
                <VenuePhoto hue={[320, 40, 20, 265, 290, 10, 330, 160][k * 2 + j]!} height={150} />
                <Text style={styles.ttLabel}>{label}</Text>
              </Pressable>
            ))}
          </View>
        );
      },
    },
    {
      title: "Quick scenarios",
      sub: "No wrong answers. Go with your gut.",
      done: () => a.scenarioKeys.every((k) => a.scenarios[k] !== undefined),
      body: () =>
        a.scenarioKeys.map((k) => (
          <View key={k} style={{ gap: 6 }}>
            <Text style={styles.strong}>{SCENARIOS[k].text}</Text>
            {SCENARIOS[k].options.map((o, i) => (
              <Option key={o} label={o} on={a.scenarios[k] === i}
                onPress={() => update((x) => ({ scenarios: { ...x.scenarios, [k]: i } }))} />
            ))}
          </View>
        )),
    },
    {
      title: "Your usual squad",
      sub: "How many people do you go out with?",
      done: () => a.squad !== undefined,
      body: () => SQUAD.map((o, i) => <Option key={o} label={o} on={a.squad === i} onPress={() => update({ squad: i })} />),
    },
    {
      title: "When do you go out?",
      sub: "Tap once for sometimes, twice for always.",
      done: () => a.nights.some(Boolean),
      body: () => (
        <View style={{ gap: 14 }}>
          <View style={styles.days}>
            {DAYS.map((d, i) => {
              const v = a.nights[i]!;
              return (
                <Pressable key={d} accessibilityLabel={`${d}: ${v === 1 ? "always" : v ? "sometimes" : "never"}`}
                  onPress={() => update((x) => ({ nights: x.nights.map((n, j) => (j === i ? (n === 0 ? 0.5 : n === 0.5 ? 1 : 0) : n)) }))}
                  style={styles.day}>
                  <View style={[styles.dot, v === 0.5 && styles.dotSome, v === 1 && styles.dotAlways]} />
                  <Text variant="caption" style={{ color: Q.fg }}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text center style={[styles.strong, { fontSize: 17 }]}>{nightCaption(a.nights)}</Text>
        </View>
      ),
    },
    {
      title: "What does a night cost you?",
      sub: "Total for the whole night.",
      done: () => a.budget !== undefined,
      body: () => BUDGET.map((b, i) => <Option key={b.amount} label={`${b.amount} · ${b.label}`} on={a.budget === i} onPress={() => update({ budget: i })} />),
    },
    {
      title: "Hot takes",
      sub: "How much do you agree?",
      done: () => true,
      body: () =>
        TAKES.map((t) => {
          const v = a.takes[t.key] ?? 3;
          return (
            <View key={t.key} style={[styles.card, { gap: 8 }]}>
              <Text style={styles.strong}>{t.text}</Text>
              <View style={styles.scale}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} accessibilityLabel={`${t.text}: ${AGREE[n - 1]}`}
                    onPress={() => update((x) => ({ takes: { ...x.takes, [t.key]: n } }))}
                    style={[styles.scaleStep, n <= v && styles.scaleOn]} />
                ))}
              </View>
              <Text variant="caption" center style={styles.muted}>{AGREE[v - 1]}</Text>
            </View>
          );
        }),
    },
    {
      title: "Besides nightlife, you're into…",
      sub: "Pick any. Clubi covers more than bars.",
      done: () => a.interests.length > 0,
      body: () => INTERESTS.map((o, i) => <Option key={o} label={o} on={a.interests.includes(i)} onPress={() => update((x) => ({ interests: toggle(x.interests, i) }))} />),
    },
    {
      title: "A few more things",
      sub: "These set filters, not your taste.",
      note: "Private. Only used for filters",
      done: () => a.drinking !== undefined && a.transport !== undefined,
      body: () => (
        <View style={{ gap: 12 }}>
          <Group label="Drinking">{DRINKING.map((o, i) => <Pill key={o} label={o} on={a.drinking === i} onPress={() => update({ drinking: i })} />)}</Group>
          <Group label="Getting around">{TRANSPORT.map((o, i) => <Pill key={o} label={o} on={a.transport === i} onPress={() => update({ transport: i })} />)}</Group>
          <Group label="Dealbreakers">{DEALBREAKERS.map((o, i) => <Pill key={o} label={o} on={a.dealbreakers.includes(i)} onPress={() => update((x) => ({ dealbreakers: toggle(x.dealbreakers, i) }))} />)}</Group>
        </View>
      ),
    },
    {
      title: "Show what's near you?",
      sub: "We use your area for \"near me\". Nobody else ever sees your location.",
      note: "Change this anytime in Settings",
      done: () => !!a.locationAsked,
      body: () => (
        <View style={{ gap: 10 }}>
          <Option label="📍 Turn on location" on={a.locationAsked === true && a.notifications !== false}
            onPress={() => { setDemo(false); update({ locationAsked: true }); }} />
          <Option label="Not now (use my home city)" on={false}
            onPress={() => { setDemo(true); update({ locationAsked: true }); }} />
          <Option label="🔔 Thursday picks + friend activity notifications" on={a.notifications === true}
            onPress={() => update((x) => ({ notifications: !x.notifications }))} />
        </View>
      ),
    },
    {
      title: "Been here?",
      sub: "Rate spots you know. They become your first ratings.",
      done: () => true,
      body: () => <BeenHere />,
    },
  ];

  const s = steps[step]!;
  const last = step === steps.length - 1;
  const next = async () => {
    if (!last) return setStep(step + 1);
    setSaving(true);
    try {
      const { tasteSummary } = await saveQuiz({ answers: toBackendCards(a) });
      setTasteSummary(tasteSummary);
      // Extras: the full quiz and the "Been here?" picks. A failure here doesn't block onboarding.
      const seeds = Object.entries(a.beenHere).flatMap(([id, v]) =>
        v.bucket === "skip" ? [] : [{ kind: v.kind, id: id as Id<"places"> | Id<"events">, bucket: v.bucket }],
      );
      await Promise.allSettled([saveExtended({ answers: a }), seeds.length ? seedRatings({ items: seeds }) : null]);
      router.push("/youre-in");
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };
  const back = () => (step > 0 ? setStep(step - 1) : router.back());

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.progress}><View style={[styles.progressFill, { width: `${((step + 1) / steps.length) * 100}%` }]} /></View>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={8}><Icon name="back" color={Q.fg} /></Pressable>
        <Pressable accessibilityRole="button" onPress={next} hitSlop={8}><Text style={styles.muted}>Skip</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text center style={styles.title}>{s.title}</Text>
        <Text center style={styles.muted}>{s.sub}</Text>
        <View style={{ gap: 8, marginTop: 8 }}>{s.body()}</View>
      </ScrollView>
      <View style={styles.footer}>
        <Text variant="caption" style={[styles.muted, styles.flex]}>{s.note ?? "Shapes your matches, not your profile"}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={last ? "See my taste" : "Next"}
          disabled={!s.done(a) || saving} onPress={next}
          style={[styles.nextBtn, (!s.done(a) || saving) && { backgroundColor: Q.off }]}>
          <Icon name="back" color={Q.onFg} size={20} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function BeenHere() {
  // Nearby spots to seed ratings. Saved with onboarding.seedRatings when the quiz is saved.
  const nearby = useNearby("all");
  const { answers: a, update } = useOnboarding();
  if (nearby === undefined) return <Text center style={styles.muted}>Finding spots near you…</Text>;
  const spots = nearby.items.slice(0, 8);
  if (!spots.length) return <Text center style={styles.muted}>No spots loaded for this area yet. You can skip this.</Text>;
  return (
    <>
      {spots.map((v) => (
        <View key={String(v.id)} style={[styles.card, { gap: 8 }]}>
          <Text style={styles.strong}>{v.name}</Text>
          <View style={styles.pills}>
            {(["loved", "fine", "didnt", "skip"] as const).map((b) => (
              <Pill key={b} label={{ loved: "🔥 Loved it", fine: "😐 It was fine", didnt: "💀 Didn't like it", skip: "Haven't been" }[b]}
                on={a.beenHere[String(v.id)]?.bucket === b}
                onPress={() => update((x) => ({ beenHere: { ...x.beenHere, [String(v.id)]: { kind: v.kind, bucket: b } } }))} />
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

function Option({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[styles.option, on && styles.optionOn]}>
      <Text style={{ color: Q.fg, flex: 1 }}>{label}</Text>
      <View style={[styles.radio, on && styles.radioOn]} />
    </Pressable>
  );
}

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[styles.pill, on && styles.pillOn]}>
      <Text variant="caption" style={{ color: on ? Q.onFg : Q.fg }}>{label}</Text>
    </Pressable>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <View style={styles.pills}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Q.bg },
  progress: { height: 3, backgroundColor: Q.raised },
  progressFill: { height: "100%", backgroundColor: Q.fg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 8 },
  content: { paddingHorizontal: 18, paddingBottom: 24, gap: 6 },
  title: { fontFamily: serif, fontSize: 30, lineHeight: 34, color: Q.fg },
  muted: { color: Q.muted },
  strong: { color: Q.fg, fontWeight: "600" },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Q.card, borderWidth: 1, borderColor: Q.line, borderRadius: 14, padding: 8 },
  cover: { width: 44, borderRadius: 8 },
  stars: { flexDirection: "row" },
  star: { fontSize: 20, lineHeight: 24, color: Q.starOff, paddingHorizontal: 1 },
  starOn: { color: "#f5b301" },
  ttLabel: { position: "absolute", left: 14, bottom: 12, color: "#fff", fontSize: 20, fontWeight: "700" },
  days: { flexDirection: "row", justifyContent: "space-between" },
  day: { alignItems: "center", gap: 6 },
  dot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: Q.line, backgroundColor: Q.card },
  dotSome: { borderColor: Q.fg, backgroundColor: Q.raised },
  dotAlways: { borderColor: Q.fg, backgroundColor: Q.fg },
  card: { backgroundColor: Q.card, borderWidth: 1, borderColor: Q.line, borderRadius: 14, padding: 12 },
  scale: { flexDirection: "row", gap: 6 },
  scaleStep: { flex: 1, height: 10, borderRadius: 5, backgroundColor: Q.raised },
  scaleOn: { backgroundColor: Q.fg },
  option: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Q.card, borderWidth: 1.5, borderColor: Q.line, borderRadius: 12, padding: 12 },
  optionOn: { borderColor: Q.fg, backgroundColor: Q.raised },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: Q.line },
  radioOn: { borderWidth: 5, borderColor: Q.fg },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: Q.line, backgroundColor: Q.card },
  pillOn: { backgroundColor: Q.fg, borderColor: Q.fg },
  footer: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingBottom: 12 },
  nextBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: Q.fg, alignItems: "center", justifyContent: "center", transform: [{ rotate: "180deg" }] },
});
