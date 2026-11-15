import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Icon, ScoreBadge, Skeleton, Text, type IconName } from "../../components";
import type { Bucket, RankResult, RankedListItem, VenueDetail } from "../../lib/api";
import { categoryLabel, formatScore } from "../../lib/format";
import { colors, fontWeight, radius, ratingColor, ratingColors, spacing } from "../../theme";
import { BusyButton, FlowScreen } from "./FlowScreen";
import { opponentOf, totalRounds, type Search } from "./search";
import { PlacePhoto, Pop, PressScale, Rise, type } from "./ui";

/** The three answers to "How was it?", with the exact labels from docs/UI-SPEC.md. */
const BUCKETS: { bucket: Bucket; label: string; icon: IconName; color: string }[] = [
  { bucket: "loved", label: "Loved it", icon: "heartFilled", color: ratingColors.great },
  { bucket: "fine", label: "It was fine", icon: "minus", color: ratingColors.okay },
  { bucket: "didnt", label: "Didn't like it", icon: "thumbDown", color: ratingColors.bad },
];

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Step 2. The place's photo, then three big circles within reach of a thumb. */
export function HowStep({
  venue,
  onPick,
  onBack,
}: {
  venue: VenueDetail;
  onPick: (bucket: Bucket) => void;
  onBack: () => void;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const mine = venue.myRanking;
  // The photo takes what the back row, the question and the circles leave over.
  const photoHeight = clamp(height - insets.top - insets.bottom - (mine ? 470 : 410), 180, 460);
  return (
    <FlowScreen onBack={onBack}>
      <PlacePhoto uri={venue.imageUrl} category={venue.category} height={photoHeight} scrim>
        <View style={styles.onPhoto}>
          <Text style={type.onPhotoNote}>{categoryLabel(venue.category, venue.subcategory)}</Text>
          <Text numberOfLines={3} style={styles.heroName}>
            {venue.name}
          </Text>
        </View>
      </PlacePhoto>
      <View style={styles.ask}>
        <View style={styles.askText}>
          <Text accessibilityRole="header" style={[type.question, styles.center]}>
            How was it?
          </Text>
          {mine ? (
            <Text muted center>
              {`You ranked it #${mine.position} of ${mine.outOf} · ${formatScore(mine.score)}. Ranking it again replaces that.`}
            </Text>
          ) : null}
        </View>
        <View style={styles.circles}>
          {BUCKETS.map(({ bucket, label, icon, color }) => (
            <PressScale
              key={bucket}
              accessibilityLabel={label}
              onPress={() => onPick(bucket)}
              to={0.9}
              style={styles.circleCol}
              contentStyle={styles.circleInner}
            >
              <View style={[styles.circle, { backgroundColor: color }]}>
                <Icon name={icon} size={34} color={INK} />
              </View>
              <Text center style={type.strong}>
                {label}
              </Text>
            </PressScale>
          ))}
        </View>
      </View>
    </FlowScreen>
  );
}

function Contender({
  name,
  note,
  score,
  photo,
  category,
  height,
  onPress,
}: {
  name: string;
  note: string;
  /** The score the user already gave it. Left out for the place being ranked. */
  score?: number;
  photo?: string;
  category: VenueDetail["category"];
  height: number;
  onPress: () => void;
}) {
  return (
    <PressScale
      testID="contender"
      accessibilityLabel={name}
      accessibilityHint="Tap if this one was better"
      onPress={onPress}
      contentStyle={styles.contender}
      pressedStyle={styles.contenderPressed}
    >
      <PlacePhoto uri={photo} category={category} height={height} round={radius.xxl - 2} scrim>
        {score !== undefined ? (
          <View style={styles.contenderScore}>
            <ScoreBadge score={score} />
          </View>
        ) : null}
        <View style={styles.onPhoto}>
          <Text numberOfLines={2} style={type.onPhoto}>
            {name}
          </Text>
          <Text style={type.onPhotoNote}>{note}</Text>
        </View>
      </PlacePhoto>
    </PressScale>
  );
}

/** Step 3. One round of "Which was better?" at a time. `search` is null while the bucket loads. */
export function CompareStep({
  venue,
  search,
  photos,
  onAnswer,
  onTooClose,
  onBack,
}: {
  venue: VenueDetail;
  search: Search | null;
  /** The user's ranked places in this category, for the photo of the one already ranked. */
  photos: RankedListItem[] | undefined;
  onAnswer: (newWon: boolean) => void;
  onTooClose: () => void;
  onBack: () => void;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Two photos share what the top row, the question and "Too close to call" leave over.
  const cardHeight = clamp(Math.floor((height - insets.top - insets.bottom - 270) / 2), 140, 300);
  const opponent = search === null ? null : opponentOf(search);
  if (search === null || opponent === null) {
    return (
      <FlowScreen title={venue.name} heading="Which was better?" onBack={onBack}>
        <View style={styles.versus}>
          <Skeleton height={cardHeight} round={radius.xxl} />
          <Skeleton height={cardHeight} round={radius.xxl} />
        </View>
      </FlowScreen>
    );
  }
  const total = Math.max(totalRounds(search.list.length), search.rounds + 1);
  return (
    <FlowScreen
      title={venue.name}
      heading="Which was better?"
      progress={total > 1 ? { current: search.rounds + 1, total } : undefined}
      onBack={onBack}
      footer={<Button title="Too close to call" accessibilityLabel="Too close to call" variant="ghost" onPress={onTooClose} />}
    >
      <View style={styles.versus}>
        <Contender
          name={venue.name}
          note="The new one"
          photo={venue.imageUrl}
          category={venue.category}
          height={cardHeight}
          onPress={() => onAnswer(true)}
        />
        {/* The key replays the entrance for every new opponent. */}
        <Rise key={opponent.id}>
          <Contender
            name={opponent.name}
            note={`You gave it ${formatScore(opponent.score)}`}
            score={opponent.score}
            photo={photos?.find((row) => row.id === opponent.id)?.imageUrl}
            category={venue.category}
            height={cardHeight}
            onPress={() => onAnswer(false)}
          />
        </Rise>
        <View style={[styles.or, { top: cardHeight + VERSUS_GAP / 2 - OR_SIZE / 2 }]}>
          <Text style={styles.orText}>or</Text>
        </View>
      </View>
    </FlowScreen>
  );
}

/** How many rows to show on each side of the new one when the list is long. */
const WINDOW = 5;

/** The rows to draw: the whole list when it is short, else the ones around index `at`. Order is untouched. */
function windowAround<T>(list: T[], at: number): { from: number; rows: T[] } {
  const size = WINDOW * 2 + 1;
  if (list.length <= size || at < 0) return { from: 0, rows: list.slice(0, size) };
  const from = Math.min(Math.max(0, at - WINDOW), list.length - size);
  return { from, rows: list.slice(from, from + size) };
}

/** Step 5. The score and the label come from `rankings.rank`; the list under them from `rankings.mine`. */
export function ResultStep({
  venue,
  result,
  list,
  continueLabel,
  busy,
  onContinue,
}: {
  venue: VenueDetail;
  result: RankResult;
  /** The user's ranked list for this category, best first. undefined while loading. */
  list: RankedListItem[] | undefined;
  continueLabel: "Continue" | "Done";
  busy: boolean;
  onContinue: () => void;
}) {
  const at = list?.findIndex((row) => row.rankingId === result.rankingId) ?? -1;
  const { from, rows: shown } = windowAround(list ?? [], at);
  const hiddenAfter = (list?.length ?? 0) - (from + shown.length);
  const scoreColor = ratingColor(result.score);

  return (
    <FlowScreen
      back={false}
      footer={<BusyButton title={continueLabel} accessibilityLabel={continueLabel} busy={busy} onPress={onContinue} />}
    >
      <View style={styles.result}>
        <PlacePhoto uri={venue.imageUrl} category={venue.category} height={210} scrim />
        <Pop style={styles.ringWrap}>
          <View accessibilityLabel={`Score ${formatScore(result.score)}`} style={[styles.ring, { borderColor: scoreColor }]}>
            <Text style={[styles.ringText, { color: scoreColor }]}>{formatScore(result.score)}</Text>
          </View>
        </Pop>
        <Rise delay={120} style={styles.resultText}>
          <Text accessibilityRole="header" style={styles.resultHeading}>
            {venue.name}
            <Text style={[styles.resultHeading, styles.resultRest]}>{` is now ${result.label}`}</Text>
          </Text>
        </Rise>
      </View>
      {list === undefined ? (
        <View style={styles.rows}>
          <Skeleton height={52} round={radius.lg} />
          <Skeleton height={52} round={radius.lg} />
          <Skeleton height={52} round={radius.lg} />
        </View>
      ) : shown.length > 1 ? (
        <Rise delay={220}>
          {from > 0 ? <Text style={[type.meta, styles.more]}>{`${from} above`}</Text> : null}
          {shown.map((row) => {
            const isNew = row.rankingId === result.rankingId;
            return (
              <View
                key={row.rankingId}
                accessibilityLabel={`${row.position}. ${row.name}, ${formatScore(row.score)}${isNew ? ", new" : ""}`}
                style={[styles.row, isNew && styles.rowNew]}
              >
                <Text style={[styles.rowRank, isNew && styles.rowRankNew]}>{row.position}</Text>
                <PlacePhoto uri={row.imageUrl} category={row.category} height={40} width={40} round={radius.md} />
                <Text numberOfLines={1} style={[styles.rowName, isNew && styles.rowNameNew]}>
                  {row.name}
                </Text>
                <Text style={[styles.rowScore, { color: ratingColor(row.score) }]}>{formatScore(row.score)}</Text>
              </View>
            );
          })}
          {hiddenAfter > 0 ? <Text style={[type.meta, styles.more]}>{`${hiddenAfter} more below`}</Text> : null}
        </Rise>
      ) : null}
    </FlowScreen>
  );
}

/** Icons on the bright circles are drawn in the page's darkest colour. */
const INK = "#0b0a0f";
const VERSUS_GAP = 8;
const OR_SIZE = 40;
const RING = 84;

const styles = StyleSheet.create({
  center: { textAlign: "center" },
  onPhoto: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: 2 },
  heroName: { fontSize: 28, lineHeight: 33, fontWeight: fontWeight.bold, letterSpacing: -0.5, color: colors.white },

  ask: { flex: 1, justifyContent: "center", gap: spacing.xl + 2 },
  askText: { gap: spacing.sm },
  circles: { flexDirection: "row" },
  circleCol: { flex: 1 },
  circleInner: { alignItems: "center", gap: spacing.md },
  circle: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center" },

  versus: { gap: VERSUS_GAP },
  contender: { borderRadius: radius.xxl, borderWidth: 2, borderColor: "transparent" },
  contenderPressed: { borderColor: colors.accent },
  contenderScore: { position: "absolute", top: spacing.md, right: spacing.md },
  or: {
    position: "absolute",
    alignSelf: "center",
    width: OR_SIZE,
    height: OR_SIZE,
    borderRadius: OR_SIZE / 2,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  orText: { fontSize: 13, lineHeight: 16, fontWeight: fontWeight.semibold, color: colors.muted },

  result: { paddingTop: spacing.sm },
  ringWrap: { marginTop: -RING / 2, marginLeft: spacing.lg, alignSelf: "flex-start" },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 4,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  ringText: { fontSize: 30, lineHeight: 36, fontWeight: fontWeight.bold, letterSpacing: -0.8, fontVariant: ["tabular-nums"] },
  resultText: { marginTop: spacing.md },
  resultHeading: { fontSize: 26, lineHeight: 32, fontWeight: fontWeight.bold, letterSpacing: -0.4, color: colors.fg },
  resultRest: { color: colors.muted },

  rows: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  rowNew: { backgroundColor: colors.accentSoft },
  rowRank: { width: 22, fontSize: 15, fontWeight: fontWeight.semibold, color: colors.muted, fontVariant: ["tabular-nums"] },
  rowRankNew: { color: colors.accent },
  rowName: { flex: 1, fontSize: 15, lineHeight: 20, color: colors.fg },
  rowNameNew: { fontWeight: fontWeight.semibold },
  rowScore: { fontSize: 15, fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
  more: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
