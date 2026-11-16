import { useAuthActions } from "@convex-dev/auth/react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { VideoSource } from "expo-video";
import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, Text, useToast } from "../../components";
import { QUIZ_CARDS } from "../../features/onboarding/quizCards";
import { QuizOption } from "../../features/onboarding/QuizOption";
import { QuizProgress } from "../../features/onboarding/QuizProgress";
import { rememberQuizResult } from "../../features/onboarding/quizResult";
import { Rise } from "../../features/onboarding/Rise";
import { SpinnerButton } from "../../features/onboarding/SpinnerButton";
import { VideoBackground } from "../../features/onboarding/VideoBackground";
import { api } from "../../lib/api";
import { confirm } from "../../lib/confirm";
import { errorMessage } from "../../lib/errors";
import { paths } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, fontWeight, layout, palette } from "../../theme";

/** Bryan's full-screen video breaks between quiz sections (Pexels footage, assets/welcome/SOURCES.md). */
const VIBE_VIDEO: VideoSource = require("../../../assets/onboarding/vibe.mp4");
const LAST_VIDEO: VideoSource = require("../../../assets/onboarding/been-here.mp4");

type Stop = { card: number } | { video: VideoSource; title: string; sub: string };
/** The quiz in order: the six cards, with a video break after the first question and before the last. */
const STOPS: Stop[] = [
  { card: 0 },
  { video: VIBE_VIDEO, title: "Now let's figure out your vibe", sub: "A few quick ones. No wrong answers." },
  ...QUIZ_CARDS.slice(1, -1).map((_, index) => ({ card: index + 1 })),
  { video: LAST_VIDEO, title: "Last one. What else are you into?", sub: "Then your picks are ready." },
  { card: QUIZ_CARDS.length - 1 },
];

/**
 * Six cards (docs/UI-SPEC.md section 2), one question a screen. The answer for a card is the list
 * of picked option indexes; "See my taste" sends all six to `api.users.saveQuiz` and opens the
 * taste card.
 */
export default function Quiz() {
  // Where the person is in STOPS; `step` is the card that stop shows (a break shows none).
  const [at, setAt] = useState(0);
  const stop = STOPS[at];
  const step = "card" in stop ? stop.card : 0;
  // Which way the next card slides in from: 1 after "Next", -1 after "Back".
  const [direction, setDirection] = useState<1 | -1>(1);
  const [answers, setAnswers] = useState<number[][]>(() => QUIZ_CARDS.map(() => []));
  const { run: saveQuiz, pending } = useMutationToast(api.users.saveQuiz);
  const { signOut } = useAuthActions();
  const toast = useToast();
  const [leaving, setLeaving] = useState(false);

  const card = QUIZ_CARDS[step];
  const picked = answers[step];
  const isLast = step === QUIZ_CARDS.length - 1;
  const busy = pending || leaving;

  const toggle = (option: number) =>
    setAnswers((current) =>
      current.map((picks, index) => {
        if (index !== step) return picks;
        if (!card.many) return [option];
        return picks.includes(option) ? picks.filter((value) => value !== option) : [...picks, option];
      }),
    );

  const go = (to: number) => {
    setDirection(to > at ? 1 : -1);
    setAt(to);
  };

  const next = async () => {
    if (picked.length === 0 || busy) return;
    if (!isLast) {
      go(at + 1);
      return;
    }
    // On failure the toast has shown the backend's sentence and we stay on card 6.
    const saved = await saveQuiz({ answers });
    if (saved === undefined) return;
    rememberQuizResult({ answers, tasteSummary: saved.tasteSummary });
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

  if ("video" in stop) {
    return (
      <View style={styles.breakRoot}>
        <VideoBackground clips={[stop.video]} />
        <StatusBar style="light" />
        <LinearGradient colors={BREAK_SCRIM} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <SafeAreaView style={styles.breakContent} edges={["top", "bottom"]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={() => go(at - 1)} style={styles.breakBack}>
            <Icon name="back" size={24} color={palette.onPhoto} />
          </Pressable>
          <View style={styles.breakText}>
            <Text accessibilityRole="header" style={styles.breakTitle}>
              {stop.title}
            </Text>
            <Text style={styles.breakSub}>{stop.sub}</Text>
          </View>
          <View style={styles.flex} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue"
            onPress={() => go(at + 1)}
            style={({ pressed }) => [styles.breakButton, pressed && styles.dimmed]}
          >
            <Text style={styles.breakButtonText}>Continue</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.top}>
        <View style={styles.bar}>
          {at > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              disabled={busy}
              onPress={() => go(at - 1)}
              style={({ pressed }) => [styles.back, (pressed || busy) && styles.dimmed]}
            >
              <Icon name="back" size={24} color={colors.fg} />
            </Pressable>
          ) : (
            <View style={styles.back} />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            disabled={busy}
            onPress={() => void leave()}
            style={({ pressed }) => [styles.signOut, (pressed || busy) && styles.dimmed]}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
        <QuizProgress step={step} total={QUIZ_CARDS.length} />
      </View>
      <ScrollView
        key={step}
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Rise axis="x" from={direction * 28} style={styles.question}>
          <Text style={styles.count} accessibilityLabel={`Quiz, ${step + 1} of ${QUIZ_CARDS.length}`}>
            Question {step + 1} of {QUIZ_CARDS.length}
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            {card.question}
          </Text>
          <Text style={styles.hint}>{card.many ? "Select all that apply" : "Choose one"}</Text>
        </Rise>
        <View accessibilityRole={card.many ? undefined : "radiogroup"} style={card.many ? styles.chips : styles.options}>
          {card.options.map((option, index) => (
            <Rise key={option} delay={index * 30} from={10} duration={260}>
              <QuizOption
                label={option}
                many={card.many}
                selected={picked.includes(index)}
                disabled={busy}
                onPress={() => toggle(index)}
              />
            </Rise>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {/* On a short phone the answers scroll; they fade out under the button instead of being cut. */}
        <LinearGradient colors={[FADE_FROM, colors.bg]} style={styles.fade} />
        <SpinnerButton
          title={isLast ? "See my taste" : "Next"}
          accessibilityLabel={isLast ? "See my taste" : "Next"}
          busy={pending}
          disabled={picked.length === 0 || leaving}
          buttonStyle={styles.next}
          onPress={() => void next()}
        />
        <Text variant="caption" muted center>
          Shapes your matches, not your profile
        </Text>
      </View>
    </SafeAreaView>
  );
}

const SIDE = layout.gutter;
/** The page colour with no opacity (8-digit hex), so the fade above the button has no grey in it. */
const FADE_FROM = `${colors.bg}00`;

/** The footage is a photo surface: shade at the top for the words, clear in the middle, shade under the button. */
const BREAK_SCRIM = ["rgba(0,0,0,0.55)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.65)"] as const;
const SERIF = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, 'Times New Roman', serif" });

const styles = StyleSheet.create({
  breakRoot: { flex: 1, backgroundColor: colors.black },
  breakContent: { flex: 1, paddingHorizontal: 22, paddingBottom: 18 },
  breakBack: { width: 44, height: 44, marginLeft: -10, alignItems: "center", justifyContent: "center" },
  breakText: { gap: 10, marginTop: 24 },
  breakTitle: { fontFamily: SERIF, fontSize: 34, lineHeight: 39, color: palette.onPhoto },
  breakSub: { fontSize: 15, lineHeight: 21, color: palette.onPhotoMuted },
  breakButton: { alignSelf: "center", backgroundColor: palette.onPhoto, borderRadius: 99, paddingHorizontal: 40, paddingVertical: 14 },
  breakButtonText: { fontSize: 16, lineHeight: 20, fontWeight: fontWeight.bold, color: "#16151a" },
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  top: { paddingHorizontal: SIDE, paddingTop: 4, gap: 8 },
  bar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 48 },
  back: { width: 76, height: 44, marginLeft: -10, paddingLeft: 10, justifyContent: "center" },
  // The small bold uppercase label the rest of the app uses above a section.
  count: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
    fontVariant: ["tabular-nums"],
  },
  signOut: { width: 76, height: 44, alignItems: "flex-end", justifyContent: "center" },
  signOutText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  dimmed: { opacity: 0.5 },
  // The question, then the answers straight under it; a short screen scrolls.
  content: { flexGrow: 1, paddingHorizontal: SIDE, paddingTop: 30, paddingBottom: 30, gap: 26 },
  question: { gap: 8 },
  title: { fontSize: 34, lineHeight: 39, fontWeight: "800", letterSpacing: -0.8, color: colors.fg },
  hint: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  options: { gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  footer: { paddingHorizontal: SIDE, paddingTop: 8, paddingBottom: 14, gap: 10 },
  fade: { position: "absolute", left: 0, right: 0, top: -28, height: 28, pointerEvents: "none" },
  next: { minHeight: 54 },
});
