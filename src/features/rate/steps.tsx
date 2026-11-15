import { Pressable, StyleSheet, View } from "react-native";
import { Button, ScoreBadge, Skeleton, SkeletonRows, Text } from "../../components";
import type { Bucket, RankResult, RankedListItem, VenueDetail } from "../../lib/api";
import { categoryLabel, formatScore } from "../../lib/format";
import { colors, fontWeight, radius, spacing } from "../../theme";
import { BusyButton, FlowScreen } from "./FlowScreen";
import { opponentOf, totalRounds, type Search } from "./search";

/** The three answers to "Would you go back?", with the exact labels from docs/UI-SPEC.md. */
const BUCKETS: { bucket: Bucket; label: string; color: string }[] = [
  { bucket: "loved", label: "Absolutely", color: "#7fd8a4" },
  { bucket: "fine", label: "Depends", color: "#f5d27a" },
  { bucket: "didnt", label: "Nope", color: "#f28b9b" },
];

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <Text variant="caption" muted center accessibilityLabel={`${current} of ${total}`}>
      {current} of {total}
    </Text>
  );
}

/** Step 2. A card with three big colored circles. */
export function HowStep({
  venue,
  onPick,
  onBack,
}: {
  venue: VenueDetail;
  onPick: (bucket: Bucket) => void;
  onBack: () => void;
}) {
  const mine = venue.myRanking;
  return (
    <FlowScreen title="" onBack={onBack}>
      <View style={styles.intro}>
        <Text variant="heading">{venue.name}</Text>
        <Text muted>{categoryLabel(venue.category, venue.subcategory)}</Text>
        {mine ? (
          <Text muted>
            {`You ranked it #${mine.position} of ${mine.outOf} · ${formatScore(mine.score)}. Ranking it again replaces that.`}
          </Text>
        ) : null}
      </View>
      <View style={styles.card}>
        <Text variant="title" center accessibilityRole="header">
          Would you go back?
        </Text>
        <View style={styles.circles}>
          {BUCKETS.map(({ bucket, label, color }) => (
            <Pressable
              key={bucket}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => onPick(bucket)}
              style={({ pressed }) => [styles.circleCol, pressed && styles.pressed]}
            >
              <View style={[styles.circle, { backgroundColor: color }]} />
              <Text variant="caption" center>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </FlowScreen>
  );
}

function Contender({ name, note, onPress }: { name: string; note: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityHint="Tap if this one was better"
      onPress={onPress}
      style={({ pressed }) => [styles.contender, pressed && styles.contenderPressed]}
    >
      <Text variant="title" center numberOfLines={4}>
        {name}
      </Text>
      <Text variant="caption" muted center>
        {note}
      </Text>
    </Pressable>
  );
}

/** Step 3. One round of "Which was better?" at a time. `search` is null while the bucket loads. */
export function CompareStep({
  venue,
  search,
  onAnswer,
  onTooClose,
  onBack,
}: {
  venue: VenueDetail;
  search: Search | null;
  onAnswer: (newWon: boolean) => void;
  onTooClose: () => void;
  onBack: () => void;
}) {
  const opponent = search === null ? null : opponentOf(search);
  if (search === null || opponent === null) {
    return (
      <FlowScreen title="" onBack={onBack}>
        <View style={styles.card}>
          <Text variant="title" center accessibilityRole="header">
            Which was better?
          </Text>
          <Skeleton height={12} width="20%" style={styles.centered} />
          <View style={styles.versus}>
            <Skeleton height={140} round={radius.xl} style={styles.flex} />
            <Skeleton height={140} round={radius.xl} style={styles.flex} />
          </View>
        </View>
      </FlowScreen>
    );
  }
  const total = Math.max(totalRounds(search.list.length), search.rounds + 1);
  return (
    <FlowScreen
      title=""
      onBack={onBack}
      footer={<Button title="Too close to call" accessibilityLabel="Too close to call" variant="ghost" onPress={onTooClose} />}
    >
      <View style={styles.card}>
        <Text variant="title" center accessibilityRole="header">
          Which was better?
        </Text>
        <Progress current={search.rounds + 1} total={total} />
        <View style={styles.versus}>
          <Contender name={venue.name} note="New" onPress={() => onAnswer(true)} />
          <View style={styles.vs}>
            <Text variant="label" style={styles.vsText}>
              VS
            </Text>
          </View>
          <Contender
            key={opponent.id}
            name={opponent.name}
            note={`You gave it ${formatScore(opponent.score)}`}
            onPress={() => onAnswer(false)}
          />
        </View>
        <Text variant="caption" muted center>
          Tap the one you liked more.
        </Text>
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

/** Step 5. The label comes from `rankings.rank`; the list under it from `rankings.mine`. */
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
      title="Ranked"
      center
      back={false}
      footer={<BusyButton title={continueLabel} accessibilityLabel={continueLabel} busy={busy} onPress={onContinue} />}
    >
      <View style={styles.result}>
        <View style={styles.centered}>
          <ScoreBadge score={result.score} size="lg" />
        </View>
        <Text variant="heading" center accessibilityRole="header">
          {`${venue.name} is now ${result.label}`}
        </Text>
      </View>
      {list === undefined ? (
        <SkeletonRows count={4} avatar={false} />
      ) : (
        <View>
          {from > 0 ? (
            <Text variant="caption" muted style={styles.more}>
              {`${from} above`}
            </Text>
          ) : null}
          {shown.map((row) => {
            const isNew = row.rankingId === result.rankingId;
            return (
              <View
                key={row.rankingId}
                accessibilityLabel={`${row.position}. ${row.name}, ${formatScore(row.score)}${isNew ? ", new" : ""}`}
                style={[styles.row, isNew && styles.rowNew]}
              >
                <Text style={styles.rowRank} muted={!isNew}>
                  {row.position}
                </Text>
                <Text numberOfLines={1} style={[styles.rowName, isNew && styles.rowNameNew]}>
                  {row.name}
                </Text>
                {isNew ? (
                  <Text variant="label" style={styles.newMark}>
                    New
                  </Text>
                ) : null}
                {/* The badge pins itself to the top of a row; the wrapper centers it. */}
                <View style={styles.centered}>
                  <ScoreBadge score={row.score} size="sm" />
                </View>
              </View>
            );
          })}
          {hiddenAfter > 0 ? (
            <Text variant="caption" muted style={styles.more}>
              {`${hiddenAfter} more below`}
            </Text>
          ) : null}
        </View>
      )}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { alignSelf: "center" },
  pressed: { opacity: 0.7 },
  intro: { gap: spacing.xs },
  // The card from the placeholder screens: filled, thin border, big radius.
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  circles: { flexDirection: "row", justifyContent: "space-around" },
  circleCol: { flex: 1, alignItems: "center", gap: 6 },
  circle: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },

  versus: { flexDirection: "row", alignItems: "center", gap: 6 },
  vs: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.raised,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: -14,
    zIndex: 2,
  },
  vsText: { color: colors.fg },
  contender: {
    flex: 1,
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  contenderPressed: { borderColor: colors.accent, backgroundColor: colors.accentSoft },

  result: { gap: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowNew: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md },
  rowRank: { width: 24, fontWeight: fontWeight.bold },
  rowName: { flex: 1 },
  rowNameNew: { fontWeight: fontWeight.semibold },
  newMark: { color: colors.accent },
  more: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
});
