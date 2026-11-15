import { Pressable, StyleSheet, View } from "react-native";
import { Button, Icon, ScoreBadge, Skeleton, SkeletonRows, Text, type IconName } from "../../components";
import type { Bucket, RankResult, RankedListItem, VenueDetail } from "../../lib/api";
import { categoryLabel, formatScore } from "../../lib/format";
import { colors, fontWeight, radius, spacing } from "../../theme";
import { BusyButton, FlowScreen } from "./FlowScreen";
import { opponentOf, totalRounds, type Search } from "./search";

/** The three answers to "How was it?", with the exact labels from docs/UI-SPEC.md. */
const BUCKETS: { bucket: Bucket; label: string; icon: IconName; color: string }[] = [
  { bucket: "loved", label: "Loved it", icon: "heartFilled", color: colors.accent },
  { bucket: "fine", label: "It was fine", icon: "thumbUp", color: colors.mid },
  { bucket: "didnt", label: "Didn't like it", icon: "thumbDown", color: colors.muted },
];

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.progressWrap}>
      <Text muted center accessibilityLabel={`${current} of ${total}`}>
        {current} of {total}
      </Text>
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${(current / Math.max(1, total)) * 100}%` }]} />
      </View>
    </View>
  );
}

/** Step 2. Three big buttons. */
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
    <FlowScreen title="How was it?" onBack={onBack}>
      <View style={styles.intro}>
        <Text variant="heading">{venue.name}</Text>
        <Text muted>{categoryLabel(venue.category, venue.subcategory)}</Text>
        {mine ? (
          <Text muted>
            {`You ranked it #${mine.position} of ${mine.outOf} · ${formatScore(mine.score)}. Ranking it again replaces that.`}
          </Text>
        ) : null}
      </View>
      <View style={styles.choices}>
        {BUCKETS.map(({ bucket, label, icon, color }) => (
          <Pressable
            key={bucket}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => onPick(bucket)}
            style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
          >
            <View style={styles.choiceIcon}>
              <Icon name={icon} size={22} color={color} />
            </View>
            <Text style={styles.choiceLabel}>{label}</Text>
          </Pressable>
        ))}
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
      <FlowScreen title="Which was better?" onBack={onBack}>
        <Skeleton height={14} width="30%" style={styles.centered} />
        <View style={styles.versus}>
          <Skeleton height={170} round={radius.xl} style={styles.flex} />
          <Skeleton height={170} round={radius.xl} style={styles.flex} />
        </View>
      </FlowScreen>
    );
  }
  const total = Math.max(totalRounds(search.list.length), search.rounds + 1);
  return (
    <FlowScreen
      title="Which was better?"
      onBack={onBack}
      footer={<Button title="Too close to call" accessibilityLabel="Too close to call" variant="ghost" onPress={onTooClose} />}
    >
      <Progress current={search.rounds + 1} total={total} />
      <View style={styles.versus}>
        <Contender name={venue.name} note="New" onPress={() => onAnswer(true)} />
        <Text variant="label" style={styles.vs}>
          VS
        </Text>
        <Contender
          key={opponent.id}
          name={opponent.name}
          note={`You gave it ${formatScore(opponent.score)}`}
          onPress={() => onAnswer(false)}
        />
      </View>
      <Text muted center>
        Tap the one you liked more.
      </Text>
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
      back={false}
      footer={<BusyButton title={continueLabel} accessibilityLabel={continueLabel} busy={busy} onPress={onContinue} />}
    >
      <View style={styles.resultCard}>
        <ScoreBadge score={result.score} size="lg" />
        <Text variant="heading" accessibilityRole="header">
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
                  <ScoreBadge score={row.score} />
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
  choices: { gap: spacing.md },
  choice: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  choiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.raised,
  },
  choiceLabel: { fontSize: 17, lineHeight: 22, fontWeight: fontWeight.semibold },

  progressWrap: { gap: spacing.sm },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.raised, overflow: "hidden" },
  trackFill: { height: "100%", borderRadius: 2, backgroundColor: colors.accent },

  versus: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  vs: { color: colors.muted },
  contender: {
    flex: 1,
    minHeight: 170,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  contenderPressed: { borderColor: colors.accent, backgroundColor: colors.accentSoft },

  resultCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  rowNew: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  rowRank: { width: 26, textAlign: "center", fontWeight: fontWeight.bold },
  rowName: { flex: 1, fontSize: 15 },
  rowNameNew: { fontWeight: fontWeight.semibold },
  newMark: { color: colors.accent },
  more: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
