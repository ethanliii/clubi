import { useMutation, useQuery } from "convex/react";
import { router, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, EmptyState, Skeleton, goBack, useToast } from "../../components";
import { api, type Bucket, type InsightAnswer, type InsightQuestion, type Kind, type RankResult } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { paths } from "../../lib/links";
import { radius, spacing } from "../../theme";
import { DetailsStep, EMPTY_DRAFT, type Draft } from "./DetailsStep";
import { FlowScreen } from "./FlowScreen";
import { QuestionsStep } from "./QuestionsStep";
import { answer, positionOf, startSearch, stopEarly, type Search } from "./search";
import { CompareStep, HowStep, ResultStep } from "./steps";
import { createTapGuard } from "./tapGuard";
import { usePhotoDraft } from "./usePhotoDraft";

type Step = "how" | "compare" | "details" | "result" | "questions";

/** The flow is over: back to the tabs, on the Feed, where the new post is. */
function goToFeed() {
  if (router.canDismiss()) router.dismissAll();
  router.replace(paths.feed);
}

/**
 * The rank flow for one place or event (docs/UI-SPEC.md section 6, steps 2 to 6):
 * how was it → which was better → tags, photo, caption → `rankings.rank` → result → quick questions → Feed.
 *
 * Everything the user has entered lives here until "Post", so leaving mid-flow saves nothing and a
 * failed "Post" keeps every field. The bucket list and the questions are copied once when their
 * step starts, so a live update from the backend can never move a comparison or a card under the
 * user's thumb.
 */
export function RateFlow({ kind, id }: { kind: Kind; id: string }) {
  const toast = useToast();
  const venue = useQuery(api.places.get, { kind, id });
  const settings = useQuery(api.settings.get, {});

  const [step, setStep] = useState<Step>("how");
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [search, setSearch] = useState<Search | null>(null);
  // The searches before each answer of this run, newest last, so "Undo" can step back one.
  const [history, setHistory] = useState<Search[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<RankResult | null>(null);
  const [questions, setQuestions] = useState<InsightQuestion[] | null>(null);
  const [sending, setSending] = useState(false);
  // Whether the ranking just posted replaced an earlier one. Noted at "Post": afterwards
  // `venue.myRanking` is set for a first ranking too.
  const [reranked, setReranked] = useState(false);
  // A second tap right after a round changed is the same tap landing twice.
  const [guard] = useState(createTapGuard);
  const { photo, add: addPhoto, remove: removePhoto } = usePhotoDraft();

  const rank = useMutation(api.rankings.rank);
  const submitAnswers = useMutation(api.insights.submit);

  const category = venue?.category;
  // All three buckets are asked for while the user is still choosing, so "Which was better?" opens at once.
  const comparing = (step === "how" || step === "compare") && category !== undefined;
  const loved = useQuery(api.rankings.listInBucket, comparing ? { category, bucket: "loved" } : "skip");
  const fine = useQuery(api.rankings.listInBucket, comparing ? { category, bucket: "fine" } : "skip");
  const didnt = useQuery(api.rankings.listInBucket, comparing ? { category, bucket: "didnt" } : "skip");
  const bucketList = bucket === null ? undefined : { loved, fine, didnt }[bucket];
  // The user's ranked list for this category: the photos on "Which was better?" and the list on
  // the result step. Asked for from the start so neither waits.
  const ranked = useQuery(api.rankings.mine, step !== "questions" && category !== undefined ? { category } : "skip");
  const liveQuestions = useQuery(
    api.insights.questionsFor,
    (step === "result" || step === "questions") && !reranked ? { kind, id } : "skip",
  );

  // The steps are one route, so the iOS swipe from the left edge would leave the whole flow: past
  // "How was it?" that throws away the draft, or skips the questions once the ranking is posted.
  // Only the first step, where on-screen Back leaves too, keeps the swipe.
  const navigation = useNavigation();
  const canSwipeBack = step === "how";
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: canSwipeBack });
  }, [navigation, canSwipeBack]);

  // Step 3 starts the moment the bucket arrives. With nothing to compare against it is skipped:
  // position 1, no comparisons.
  if (step === "compare" && search === null && bucketList !== undefined) {
    // The id the backend returned for this place, so its own row is left out when re-ranking.
    const started = startSearch(bucketList, venue?.id ?? id);
    setSearch(started);
    if (started.done) setStep("details");
  }
  // Step 6 keeps the questions it started with.
  if (step === "questions" && questions === null && liveQuestions !== undefined) {
    setQuestions(liveQuestions);
  }

  // No questions for this place: straight to the Feed.
  const nothingToAsk = step === "questions" && questions !== null && questions.length === 0;
  useEffect(() => {
    if (nothingToAsk) goToFeed();
  }, [nothingToAsk]);

  if (venue === undefined) {
    return (
      <FlowScreen onBack={goBack}>
        <Skeleton height={300} round={radius.xxl} />
        <Skeleton height={34} width="50%" style={styles.centered} />
      </FlowScreen>
    );
  }
  if (venue === null) {
    return (
      <FlowScreen onBack={goBack}>
        <EmptyState title="This place is no longer listed" actionLabel="Back" onAction={goBack} />
      </FlowScreen>
    );
  }

  const isRerank = venue.myRanking !== undefined;

  const pickBucket = (picked: Bucket) => {
    // A double tap on "Loved it" must not also answer the first "Which was better?".
    guard.mark();
    setBucket(picked);
    setSearch(null);
    setHistory([]);
    setStep("compare");
  };

  const settle = (next: Search) => {
    setSearch(next);
    if (next.done) setStep("details");
  };

  const onAnswer = (newWon: boolean) => {
    if (search === null || guard.justMoved()) return;
    guard.mark();
    setHistory([...history, search]);
    settle(answer(search, venue.id, newWon));
  };

  const undo = () => {
    const before = history[history.length - 1];
    if (before === undefined || guard.justMoved()) return;
    guard.mark();
    setHistory(history.slice(0, -1));
    setSearch(before);
  };

  // "Too tough" and "Skip" both stop asking and keep the comparisons made so far.
  const stop = () => {
    if (search !== null) settle(stopEarly(search));
  };

  const backToHow = () => {
    setSearch(null);
    setHistory([]);
    setStep("how");
  };

  // What "Who sees it" shows. A first ranking starts on the user's default ("Friends" until it loads).
  // A re-rank the user leaves alone sends nothing, so the post keeps the setting it already has.
  const shownVisibility = draft.visibility ?? (isRerank ? null : (settings?.defaultVisibility ?? "friends"));

  const post = async () => {
    if (posting || bucket === null || search === null) return;
    setPosting(true);
    setReranked(isRerank);
    try {
      const caption = draft.caption.trim();
      const ranking = await rank({
        kind: venue.kind,
        id: venue.id,
        bucket,
        position: positionOf(search),
        comparisons: search.comparisons,
        tags: draft.tags,
        ...(caption === "" ? {} : { caption }),
        ...(photo?.storageId ? { photoStorageId: photo.storageId } : {}),
        ...(shownVisibility === null ? {} : { visibility: shownVisibility }),
      });
      setResult(ranking);
      setStep("result");
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setPosting(false);
    }
  };

  // After a re-rank the quick questions are not asked again: `insights.submit` replaces everything
  // the user said about this place before, so answering one question (or a different set of
  // questions) would erase the earlier answers, which the app has no way to read back and merge.
  const continueFromResult = () => {
    if (reranked || (liveQuestions !== undefined && liveQuestions.length === 0)) {
      goToFeed();
      return;
    }
    setStep("questions");
  };

  const finishQuestions = async (answers: InsightAnswer[]) => {
    if (sending) return;
    // Sending an empty list would wipe what the user said about this place on an earlier visit.
    if (answers.length === 0 || result === null) {
      goToFeed();
      return;
    }
    setSending(true);
    try {
      const { highlights } = await submitAnswers({ kind, id, rankingId: result.rankingId, answers });
      toast(highlights.length > 0 ? `Thanks! ${highlights.slice(0, 3).join(" · ")}` : "Thanks! That helps everyone.", "success");
      goToFeed();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setSending(false);
    }
  };

  if (step === "how") return <HowStep venue={venue} onPick={pickBucket} onBack={goBack} />;

  if (step === "compare") {
    return (
      <CompareStep
        venue={venue}
        search={search}
        photos={ranked}
        canUndo={history.length > 0}
        onAnswer={onAnswer}
        onTooClose={stop}
        onUndo={undo}
        onSkip={stop}
        onBack={backToHow}
      />
    );
  }

  if (step === "details" || result === null) {
    return (
      <DetailsStep
        venue={venue}
        draft={draft}
        onChange={setDraft}
        photo={photo}
        onAddPhoto={() => void addPhoto()}
        onRemovePhoto={removePhoto}
        shownVisibility={shownVisibility}
        keepsVisibility={isRerank}
        posting={posting}
        onPost={() => void post()}
        onBack={backToHow}
      />
    );
  }

  if (step === "result") {
    // "Done" when it is already known there is nothing to ask; "Continue" otherwise.
    const nothingMore = reranked || (liveQuestions !== undefined && liveQuestions.length === 0);
    return (
      <ResultStep
        venue={venue}
        result={result}
        list={ranked}
        continueLabel={nothingMore ? "Done" : "Continue"}
        busy={false}
        onContinue={continueFromResult}
      />
    );
  }

  if (questions === null || questions.length === 0) {
    return (
      <FlowScreen
        title="Quick questions"
        back={false}
        right={<Button title="Skip all" accessibilityLabel="Skip all" variant="link" onPress={goToFeed} />}
      >
        <Skeleton height={34} width="80%" />
        <View style={styles.options}>
          <Skeleton height={64} round={radius.xl} />
          <Skeleton height={64} round={radius.xl} />
          <Skeleton height={64} round={radius.xl} />
        </View>
      </FlowScreen>
    );
  }

  return (
    <QuestionsStep
      questions={questions}
      sending={sending}
      onDone={(answers) => void finishQuestions(answers)}
      onSkipAll={goToFeed}
    />
  );
}

const styles = StyleSheet.create({
  centered: { alignSelf: "center" },
  options: { gap: spacing.sm + 2 },
});
