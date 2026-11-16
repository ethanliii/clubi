import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, ScoreBadge, Skeleton, Text, type IconName } from "../../components";
import type { Bucket, RankResult, RankedListItem, VenueDetail } from "../../lib/api";
import { categoryLabel, formatDistance, formatEventTime, formatPrice, formatScore } from "../../lib/format";
import { colors, elevation, fontWeight, palette, radius, spacing } from "../../theme";
import { BusyButton, FlowScreen } from "./FlowScreen";
import { opponentOf, totalRounds, type Search } from "./search";
import { BigScore, BUCKET_LOOK, PlacePhoto, Pop, PressScale, Rise, type } from "./ui";

/** The three answers to "How was it?", in the order they are drawn. */
const BUCKETS: { bucket: Bucket; icon: IconName }[] = [
  { bucket: "loved", icon: "thumbUp" },
  { bucket: "fine", icon: "minus" },
  { bucket: "didnt", icon: "thumbDown" },
];

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** "Cocktail bar · $$ · 350 m", or for an event "Sat Dec 5 · 9:30 PM · 350 m". */
function venueLine(venue: VenueDetail): string {
  return [
    venue.startsAt !== undefined ? formatEventTime(venue.startsAt) : categoryLabel(venue.category, venue.subcategory),
    formatPrice(venue.priceLevel),
    formatDistance(venue.distanceMeters),
  ]
    .filter((part) => part !== "")
    .join(" · ");
}

/** Step 2. The place, then "How was it?" and three round answers within reach of a thumb. */
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
  // The photo takes what the top row, the name, the question and the circles leave over.
  const photoHeight = clamp(height - insets.top - insets.bottom - (mine ? 590 : 530), 140, 300);
  return (
    <FlowScreen title="Rank it" onBack={onBack}>
      <View style={styles.place}>
        <PlacePhoto uri={venue.imageUrl} category={venue.category} height={photoHeight} round={PHOTO_ROUND} />
        <View style={styles.placeText}>
          <Text numberOfLines={2} style={styles.placeName}>
            {venue.name}
          </Text>
          <Text numberOfLines={1} style={type.meta}>
            {venueLine(venue)}
          </Text>
        </View>
      </View>
      <View style={styles.ask}>
        <Text accessibilityRole="header" style={[type.question, styles.center]}>
          How was it?
        </Text>
        <View style={styles.circles}>
          {BUCKETS.map(({ bucket, icon }) => {
            const look = BUCKET_LOOK[bucket];
            return (
              <PressScale
                key={bucket}
                accessibilityLabel={look.label}
                onPress={() => onPick(bucket)}
                to={0.92}
                style={styles.circleCol}
                contentStyle={styles.circleInner}
              >
                <View style={[styles.circle, { backgroundColor: look.color }]}>
                  <Icon name={icon} size={32} color={palette.onPhoto} />
                </View>
                <Text style={styles.circleLabel}>{look.label}</Text>
              </PressScale>
            );
          })}
        </View>
        {mine ? (
          <View style={styles.already}>
            <ScoreBadge score={mine.score} size="sm" />
            <Text style={[type.meta, styles.alreadyText]}>
              {`You ranked it #${mine.position} of ${mine.outOf}. Ranking again replaces it.`}
            </Text>
          </View>
        ) : null}
      </View>
    </FlowScreen>
  );
}

/** One of the two cards on "Which do you prefer?": the photo, the name, one grey line. */
function Contender({
  name,
  note,
  photo,
  category,
  photoHeight,
  onPress,
}: {
  name: string;
  note: string;
  photo?: string;
  category: VenueDetail["category"];
  photoHeight: number;
  onPress: () => void;
}) {
  return (
    <PressScale
      testID="contender"
      accessibilityLabel={name}
      accessibilityHint="Tap if you prefer this one"
      onPress={onPress}
      to={0.96}
      contentStyle={styles.card}
      pressedStyle={styles.cardPressed}
    >
      <View style={styles.cardClip}>
        <PlacePhoto uri={photo} category={category} height={photoHeight} round={0} />
        <View style={styles.cardText}>
          <Text numberOfLines={2} style={[type.strong, styles.cardName]}>
            {name}
          </Text>
          <Text numberOfLines={1} style={type.meta}>
            {note}
          </Text>
        </View>
      </View>
    </PressScale>
  );
}

/** One of the three small buttons under the cards. */
function SmallAction({
  label,
  icon,
  disabled = false,
  onPress,
}: {
  label: string;
  icon?: IconName;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed, disabled && styles.actionOff]}
    >
      {icon ? <Icon name={icon} size={16} color={colors.fg} /> : null}
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

/** Step 3. One round of "Which do you prefer?" at a time. `search` is null while the bucket loads. */
export function CompareStep({
  venue,
  search,
  photos,
  canUndo,
  onAnswer,
  onTooClose,
  onUndo,
  onSkip,
  onBack,
}: {
  venue: VenueDetail;
  search: Search | null;
  /** The user's ranked places in this category, for the photo of the one already ranked. */
  photos: RankedListItem[] | undefined;
  /** At least one answer has been given in this run of comparisons. */
  canUndo: boolean;
  onAnswer: (newWon: boolean) => void;
  /** "Too tough": these two are too close to call. */
  onTooClose: () => void;
  /** Take back the last answer and ask it again. */
  onUndo: () => void;
  /** Stop comparing and carry on with what has been answered. */
  onSkip: () => void;
  onBack: () => void;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const photoHeight = clamp(Math.round((height - insets.top - insets.bottom) * 0.27), 130, 240);
  const opponent = search === null ? null : opponentOf(search);
  if (search === null || opponent === null) {
    return (
      <FlowScreen title={venue.name} heading="Which do you prefer?" sub="Tap the one you liked more." center onBack={onBack}>
        <View style={styles.versus}>
          <View style={styles.cardCol}>
            <Skeleton height={photoHeight + CARD_TEXT} round={CARD_ROUND} />
          </View>
          <View style={styles.cardCol}>
            <Skeleton height={photoHeight + CARD_TEXT} round={CARD_ROUND} />
          </View>
        </View>
      </FlowScreen>
    );
  }
  const total = Math.max(totalRounds(search.list.length), search.rounds + 1);
  return (
    <FlowScreen
      title={venue.name}
      heading="Which do you prefer?"
      sub="Tap the one you liked more."
      center
      progress={{ current: search.rounds + 1, total }}
      onBack={onBack}
    >
      <View style={styles.compare}>
        <View style={styles.versus}>
          <View style={styles.cardCol}>
            <Contender
              name={venue.name}
              note={venueLine(venue)}
              photo={venue.imageUrl}
              category={venue.category}
              photoHeight={photoHeight}
              onPress={() => onAnswer(true)}
            />
          </View>
          {/* The key replays the entrance for every new opponent. */}
          <Rise key={opponent.id} style={styles.cardCol}>
            <Contender
              name={opponent.name}
              note={`You gave it ${formatScore(opponent.score)}`}
              photo={photos?.find((row) => row.id === opponent.id)?.imageUrl}
              category={venue.category}
              photoHeight={photoHeight}
              onPress={() => onAnswer(false)}
            />
          </Rise>
          <View style={[styles.or, { top: photoHeight / 2 - OR_SIZE / 2 }]}>
            <Text style={styles.orText}>OR</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <SmallAction label="Too tough" onPress={onTooClose} />
          <SmallAction label="Undo" icon="undo" disabled={!canUndo} onPress={onUndo} />
          <SmallAction label="Skip" onPress={onSkip} />
        </View>
        <Text style={[type.meta, styles.center]}>{`Comparison ${search.rounds + 1} of ${total}`}</Text>
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

  return (
    <FlowScreen
      back={false}
      title="Ranked"
      footer={<BusyButton title={continueLabel} accessibilityLabel={continueLabel} busy={busy} onPress={onContinue} />}
    >
      <View style={styles.result}>
        <Rise style={styles.resultName}>
          <View accessible accessibilityRole="header" accessibilityLabel={`${venue.name} is now ${result.label}`}>
            <Text numberOfLines={2} style={styles.resultHeading}>
              {venue.name}
            </Text>
          </View>
          <Text numberOfLines={1} style={[type.meta, styles.center]}>
            {categoryLabel(venue.category, venue.subcategory)}
          </Text>
        </Rise>
        <Pop>
          <BigScore score={result.score} />
        </Pop>
        <Rise delay={120}>
          <View style={styles.place_pill}>
            <Text style={styles.placePillText}>{result.label.split(" · ")[0]}</Text>
          </View>
        </Rise>
      </View>
      {list === undefined ? (
        <View style={styles.rowsLoading}>
          <Skeleton height={56} round={radius.lg} />
          <Skeleton height={56} round={radius.lg} />
          <Skeleton height={56} round={radius.lg} />
        </View>
      ) : shown.length > 1 ? (
        <Rise delay={220}>
          <Text accessibilityRole="header" style={styles.listTitle}>
            Your list
          </Text>
          {from > 0 ? <Text style={[type.meta, styles.more]}>{`${from} above`}</Text> : null}
          {shown.map((row, index) => {
            const isNew = row.rankingId === result.rankingId;
            const nextIsNew = shown[index + 1]?.rankingId === result.rankingId;
            return (
              <View
                key={row.rankingId}
                accessibilityLabel={`${row.position}. ${row.name}, ${formatScore(row.score)} out of 10${isNew ? ", new" : ""}`}
                style={[styles.row, isNew && styles.rowNew, (isNew || nextIsNew || index === shown.length - 1) && styles.rowNoLine]}
              >
                <View style={styles.rowText}>
                  <Text numberOfLines={1} style={type.strong}>
                    {`${row.position}. ${row.name}`}
                  </Text>
                  <Text numberOfLines={1} style={[type.meta, isNew && styles.rowMetaNew]}>
                    {isNew ? `${categoryLabel(row.category)} · Just ranked` : categoryLabel(row.category)}
                  </Text>
                </View>
                <ScoreBadge score={row.score} />
              </View>
            );
          })}
          {hiddenAfter > 0 ? <Text style={[type.meta, styles.more]}>{`${hiddenAfter} more below`}</Text> : null}
        </Rise>
      ) : null}
    </FlowScreen>
  );
}

const PHOTO_ROUND = 16;
const CARD_ROUND = 16;
/** The room under a card's photo: two lines of name, one grey line, the padding around them. */
const CARD_TEXT = 92;
const OR_SIZE = 38;
const CIRCLE = 88;

const styles = StyleSheet.create({
  center: { textAlign: "center" },

  place: { gap: spacing.md },
  placeText: { gap: 3 },
  placeName: { fontSize: 22, lineHeight: 27, fontWeight: "800", letterSpacing: -0.4, color: colors.fg },

  ask: { flex: 1, justifyContent: "center", gap: spacing.xl },
  circles: { flexDirection: "row" },
  circleCol: { flex: 1 },
  circleInner: { alignItems: "center", gap: spacing.md },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: "center", justifyContent: "center" },
  circleLabel: { fontSize: 14, lineHeight: 18, fontWeight: fontWeight.semibold, color: colors.fg, textAlign: "center" },
  already: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm + 2 },
  alreadyText: { flexShrink: 1 },

  compare: { gap: spacing.lg },
  versus: { flexDirection: "row", gap: spacing.md },
  cardCol: { flex: 1 },
  // The shadow sits on the outer box; the inner one clips the photo to the corners.
  card: { borderRadius: CARD_ROUND, backgroundColor: colors.bg, ...elevation.card },
  cardPressed: { opacity: 0.9 },
  cardClip: {
    borderRadius: CARD_ROUND,
    overflow: "hidden",
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardText: { minHeight: CARD_TEXT, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md + 2, gap: 4 },
  cardName: { minHeight: 42 },
  or: {
    position: "absolute",
    left: "50%",
    marginLeft: -OR_SIZE / 2,
    width: OR_SIZE,
    height: OR_SIZE,
    borderRadius: OR_SIZE / 2,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  orText: { fontSize: 11, lineHeight: 14, fontWeight: "800", letterSpacing: 0.4, color: colors.muted },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.pill,
  },
  actionPressed: { backgroundColor: palette.field },
  actionOff: { opacity: 0.38 },
  actionText: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.semibold, color: colors.fg, textDecorationLine: "underline" },

  result: { alignItems: "center", gap: spacing.lg, paddingTop: spacing.sm },
  resultName: { alignSelf: "stretch", gap: 3 },
  resultHeading: { fontSize: 24, lineHeight: 29, fontWeight: "800", letterSpacing: -0.5, color: colors.fg, textAlign: "center" },
  place_pill: {
    minHeight: 34,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  placePillText: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.bold, color: colors.accent },

  listTitle: { fontSize: 18, lineHeight: 23, fontWeight: "800", letterSpacing: -0.3, color: colors.fg, paddingBottom: spacing.sm },
  rowsLoading: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowNoLine: { borderBottomColor: "transparent" },
  rowNew: { backgroundColor: colors.accentSoft, borderRadius: radius.lg },
  rowText: { flex: 1, gap: 2 },
  rowMetaNew: { color: colors.accent, fontWeight: fontWeight.semibold },
  more: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
