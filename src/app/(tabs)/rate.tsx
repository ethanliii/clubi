import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Bucket, Category, InsightAnswer, RankResult, Visibility } from "../../../convex/lib/contract";
import { BackButton, Button, Chip, EmptyState, Icon, Screen, ScoreBadge, Skeleton, Text } from "../../components/bryan";
import { useDemoLocation } from "../../lib/demoLocation";
import { useNearby } from "../../lib/useNearby";
import { colors, radius, spacing } from "../../theme";

type TargetId = Id<"places"> | Id<"events">;
type Target = { kind: "place" | "event"; id: TargetId; name: string; category: Category };
type Step = "pick" | "bucket" | "compare" | "details" | "result" | "questions";

// Three overall buckets, then "Which was better?" against your other places (decision Q16).
const BUCKETS: { bucket: Bucket; emoji: string; label: string; color: string }[] = [
  { bucket: "loved", emoji: "🔥", label: "Loved it", color: "#7fd8a4" },
  { bucket: "fine", emoji: "😐", label: "It was fine", color: "#f5d27a" },
  { bucket: "didnt", emoji: "💀", label: "Didn't like it", color: "#f28b9b" },
];
const CATEGORY_NOUN: Record<Category, string> = {
  nightlife: "bars & clubs", food: "restaurants", culture: "culture", outdoors: "outdoors", live: "shows", popup: "pop-ups",
};
const TAGS = ["Great music", "Packed", "Chill", "Pricey", "Cheap drinks", "Good for groups", "Date spot", "Long line", "Great food", "Worth it", "Touristy", "Hidden gem"];
const VISIBILITY: { v: Visibility; label: string }[] = [
  { v: "friends", label: "Friends" },
  { v: "public", label: "Public" },
  { v: "private", label: "Only me" },
];

/** The rank flow. UI-SPEC §6. Leaving mid-flow saves nothing. */
export default function Rate() {
  const params = useLocalSearchParams<{ kind?: string; id?: string }>();
  const [rawStep, setStep] = useState<Step>("pick");
  const [picked, setTarget] = useState<Target | null>(null);
  const [dismissedId, setDismissedId] = useState<string | undefined>(undefined);
  const usePreset = !!params.id && params.id !== dismissedId;
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [position, setPosition] = useState(1);
  const [comparisons, setComparisons] = useState<{ winnerId: TargetId; loserId: TargetId }[]>([]);
  const [result, setResult] = useState<RankResult | null>(null);

  // Opened from "Rank this place": skip step 1.
  const preset = useQuery(
    api.places.get,
    params.kind && params.id ? { kind: params.kind === "event" ? "event" : "place", id: params.id as TargetId } : "skip",
  );
  const presetTarget: Target | null =
    usePreset && preset ? { kind: preset.kind, id: preset.id, name: preset.name, category: preset.category } : null;
  const target = picked ?? presetTarget;
  const step: Step = rawStep === "pick" && presetTarget ? "bucket" : rawStep;

  const reset = () => {
    setDismissedId(params.id);
    setStep("pick");
    setTarget(null);
    setBucket(null);
    setComparisons([]);
    setResult(null);
  };

  return (
    <Screen>
      {step !== "pick" && step !== "result" && <BackButton onPress={reset} />}
      {step === "pick" && <Pick onPick={(t) => { setTarget(t); setStep("bucket"); }} />}
      {step === "bucket" && target && (
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: 4 }}>
            <Text variant="heading">{target.name}</Text>
            <Text muted>Add to my list of <Text style={{ fontWeight: "700", textTransform: "capitalize" }}>{CATEGORY_NOUN[target.category]}</Text></Text>
          </View>
          <View style={styles.card}>
            <Text variant="title" center>How was it?</Text>
            {/* Beli-style: three colored circles (green / yellow / red). Labels match UI-SPEC for Revyl. */}
            <View style={styles.circles}>
              {BUCKETS.map((b) => (
                <Pressable key={b.bucket} accessibilityRole="button" accessibilityLabel={b.label}
                  onPress={() => { setBucket(b.bucket); setStep("compare"); }} style={styles.circleCol}>
                  <View style={[styles.circle, { backgroundColor: b.color }]}>
                    <Text style={{ fontSize: 24, lineHeight: 30 }}>{b.emoji}</Text>
                  </View>
                  <Text variant="caption" center>{b.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
      {step === "compare" && target && bucket && (
        <Compare
          target={target}
          bucket={bucket}
          onDone={(pos, comps) => { setPosition(pos); setComparisons(comps); setStep("details"); }}
        />
      )}
      {step === "details" && target && bucket && (
        <Details
          target={target}
          bucket={bucket}
          position={position}
          comparisons={comparisons}
          onPosted={(r) => { setResult(r); setStep("result"); }}
        />
      )}
      {step === "result" && target && result && bucket && (
        <ResultView target={target} bucket={bucket} result={result} onContinue={() => setStep("questions")} />
      )}
      {step === "questions" && target && result && (
        <Questions target={target} rankingId={result.rankingId} onDone={() => { reset(); router.push("/"); }} />
      )}
    </Screen>
  );
}

function Pick({ onPick }: { onPick: (t: Target) => void }) {
  const { lat, lng, ready } = useDemoLocation();
  const nearby = useNearby("all");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const results = useQuery(api.places.search, ready && query.length >= 2 ? { text: query, lat, lng } : "skip");
  const rows = query.length >= 2 ? results : nearby?.items.slice(0, 8);

  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="heading">Rank a spot</Text>
      <TextInput style={styles.input} placeholder="Where did you go?" placeholderTextColor={colors.muted}
        value={text} onChangeText={setText} accessibilityLabel="Where did you go?" />
      {rows === undefined ? (
        <Skeleton height={200} />
      ) : rows.length === 0 ? (
        <EmptyState text="No matches" />
      ) : (
        rows.map((r) => (
          <Pressable key={String(r.id)} style={styles.row}
            onPress={() => onPick({ kind: r.kind, id: r.id, name: r.name, category: r.category })}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600" }}>{r.name}</Text>
              <Text variant="caption" muted>{r.subcategory ?? r.category}</Text>
            </View>
            <ScoreBadge score={r.score} size="sm" />
          </Pressable>
        ))
      )}
    </View>
  );
}

/** Binary search against the user's own list in this bucket (UI-SPEC §6 step 3, max 4 rounds). */
function Compare({ target, bucket, onDone }: {
  target: Target; bucket: Bucket; onDone: (position: number, comps: { winnerId: TargetId; loserId: TargetId }[]) => void;
}) {
  const raw = useQuery(api.rankings.listInBucket, { category: target.category, bucket });
  const list = useMemo(() => raw?.filter((r) => r.id !== target.id), [raw, target.id]);
  type Round = { lo: number; hi: number | null; rounds: number; comps: { winnerId: TargetId; loserId: TargetId }[]; skip: number };
  const [s, setS] = useState<Round>({ lo: 0, hi: null, rounds: 0, comps: [], skip: 0 });
  const [history, setHistory] = useState<Round[]>([]);

  const H = s.hi ?? list?.length ?? 0;
  const total = list ? Math.min(4, Math.ceil(Math.log2(list.length + 1))) : 0;
  const mid = Math.floor((s.lo + H) / 2);
  const idx = mid + s.skip; // "Skip" compares against the next place in range instead
  const finished = list !== undefined && (s.lo >= H || s.rounds >= 4 || idx >= H);
  const position = mid + 1; // UI-SPEC: floor((lo + hi) / 2) + 1

  useEffect(() => {
    if (finished) onDone(position, s.comps);
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  if (list === undefined) return <Skeleton height={240} />;
  if (finished) return null;
  const other = list[idx]!;
  const go = (next: Round) => { setHistory([...history, s]); setS(next); };
  const pickNew = () => go({ lo: s.lo, hi: idx, rounds: s.rounds + 1, comps: [...s.comps, { winnerId: target.id, loserId: other.id }], skip: 0 });
  const pickOther = () => go({ lo: idx + 1, hi: H, rounds: s.rounds + 1, comps: [...s.comps, { winnerId: other.id, loserId: target.id }], skip: 0 });
  const undo = () => { const prev = history[history.length - 1]; if (prev) { setS(prev); setHistory(history.slice(0, -1)); } };

  return (
    <View style={[styles.card, { gap: spacing.md }]}>
      <Text variant="title" center>Which do you prefer?</Text>
      <Text muted center variant="caption">{s.rounds + 1} of {total}</Text>
      <View style={styles.vs}>
        <Pressable accessibilityRole="button" accessibilityLabel={target.name} onPress={pickNew} style={styles.vsCard}>
          <Text variant="title" center>{target.name}</Text>
        </Pressable>
        <View style={styles.or}><Text variant="label" style={{ color: colors.fg }}>OR</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={other.name} onPress={pickOther} style={styles.vsCard}>
          <Text variant="title" center>{other.name}</Text>
          <Text variant="caption" muted center>{other.score.toFixed(1)}</Text>
        </Pressable>
      </View>
      <View style={styles.vsFooter}>
        <Pressable accessibilityRole="button" accessibilityLabel="Undo" disabled={!history.length} onPress={undo} style={[styles.footBtn, !history.length && { opacity: 0.35 }]}>
          <Icon name="undo" size={16} color={colors.fg} />
          <Text variant="caption">Undo</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Too tough" onPress={() => onDone(position, s.comps)} style={styles.tough}>
          <Text variant="caption">Too tough</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip" onPress={() => setS({ ...s, skip: s.skip + 1 })} style={styles.footBtn}>
          <Text variant="caption">Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Details({ target, bucket, position, comparisons, onPosted }: {
  target: Target; bucket: Bucket; position: number; comparisons: { winnerId: TargetId; loserId: TargetId }[];
  onPosted: (r: RankResult) => void;
}) {
  const rank = useMutation(api.rankings.rank);
  const [tags, setTags] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("friends");
  const [posting, setPosting] = useState(false);

  const post = async () => {
    setPosting(true);
    try {
      const r = await rank({
        kind: target.kind, id: target.id, bucket, position, comparisons, tags,
        caption: caption.trim() || undefined, visibility,
      });
      onPosted(r);
    } catch (e) {
      Alert.alert("Couldn't post", e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="heading">{target.name}</Text>
      <View style={styles.chips}>
        {TAGS.map((t) => (
          <Chip key={t} label={t} on={tags.includes(t)} onPress={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])} />
        ))}
      </View>
      <TextInput style={[styles.input, { minHeight: 70 }]} placeholder="Add a note (optional)" placeholderTextColor={colors.muted}
        value={caption} onChangeText={setCaption} maxLength={280} multiline />
      <Text variant="label">Who sees it</Text>
      <View style={styles.chips}>
        {VISIBILITY.map((o) => <Chip key={o.v} label={o.label} on={visibility === o.v} onPress={() => setVisibility(o.v)} />)}
      </View>
      <Button title="Post" disabled={posting} onPress={post} />
    </View>
  );
}

function ResultView({ target, bucket, result, onContinue }: { target: Target; bucket: Bucket; result: RankResult; onContinue: () => void }) {
  const list = useQuery(api.rankings.listInBucket, { category: target.category, bucket });
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="label" center>Ranking updated</Text>
      <Text variant="heading" center>{target.name} is now {result.label}</Text>
      {list?.slice(0, 6).map((r) => (
        <View key={String(r.id)} style={[styles.row, r.id === target.id && styles.highlight]}>
          <Text style={{ width: 24, fontWeight: "700" }}>{r.position}</Text>
          <Text style={{ flex: 1 }}>{r.name}</Text>
          <Text style={{ fontWeight: "700" }}>{r.score.toFixed(1)}</Text>
        </View>
      ))}
      <Button title="Continue" onPress={onContinue} />
    </View>
  );
}

/** 3–4 quick multiple-choice questions about the visit. One per card, big targets, no typing. */
function Questions({ target, rankingId, onDone }: { target: Target; rankingId: Id<"rankings">; onDone: () => void }) {
  const questions = useQuery(api.insights.questionsFor, { kind: target.kind, id: String(target.id) });
  const submit = useMutation(api.insights.submit);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (questions && questions.length === 0) onDone();
  }, [questions]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!questions) return <Skeleton height={200} />;
  const q = questions[i];

  const finish = async (final: Record<string, string[]>) => {
    const payload: InsightAnswer[] = Object.entries(final)
      .filter(([, ids]) => ids.length)
      .map(([questionId, optionIds]) => ({ questionId, optionIds }));
    try {
      if (payload.length) await submit({ kind: target.kind, id: String(target.id), rankingId, answers: payload });
    } catch {
      // Answers are a bonus; the ranking is already saved.
    }
    onDone();
  };
  const advance = (next: Record<string, string[]>) => (i + 1 < questions.length ? setI(i + 1) : finish(next));
  if (!q) return null;
  const picked = answers[q.id] ?? [];

  return (
    <View style={{ gap: spacing.md }}>
      <Text muted>{i + 1} of {questions.length}</Text>
      <Text variant="heading">{q.text}</Text>
      {q.options.map((o) => {
        const on = picked.includes(o.id);
        return (
          <Pressable key={o.id} accessibilityRole="button" accessibilityLabel={o.label} style={[styles.bucket, on && styles.highlight]}
            onPress={() => {
              const ids = q.multi ? (on ? picked.filter((x) => x !== o.id) : [...picked, o.id]) : [o.id];
              const next = { ...answers, [q.id]: ids };
              setAnswers(next);
              if (!q.multi) advance(next);
            }}>
            <Text variant="title">{o.label}</Text>
          </Pressable>
        );
      })}
      <View style={styles.rowGap}>
        <Button title="Skip" variant="ghost" style={{ flex: 1, width: "auto" }} onPress={() => advance(answers)} />
        {q.multi && <Button title={i + 1 < questions.length ? "Next" : "Done"} style={{ flex: 1, width: "auto" }} onPress={() => advance(answers)} />}
      </View>
      <Button title="Skip all" variant="link" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.fg, borderRadius: radius.lg, padding: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowGap: { flexDirection: "row", gap: 10 },
  bucket: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line },
  vs: { flexDirection: "row", alignItems: "center", gap: 6 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.line },
  circles: { flexDirection: "row", justifyContent: "space-around" },
  circleCol: { alignItems: "center", gap: 6, width: 90 },
  circle: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  or: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center", marginHorizontal: -14, zIndex: 2 },
  vsFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 6 },
  tough: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: colors.line },
  vsCard: { flex: 1, minHeight: 140, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, alignItems: "center", justifyContent: "center", padding: 12, gap: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  highlight: { backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 8 },
});
