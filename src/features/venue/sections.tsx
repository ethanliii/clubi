import { router } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Avatar, Button, Icon, ScoreBadge, Skeleton, Text } from "../../components";
import { api, type NearbyItem, type PerformerCard, type VenueDetail, type VenueInsights } from "../../lib/api";
import { categoryLabel, formatDistance, formatEventTime, formatRelativeTime, formatScore } from "../../lib/format";
import { performerPath, userPath, venuePath } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, fontWeight, palette, spacing } from "../../theme";
import { GUTTER, Photo, Scrim, SectionTitle } from "./parts";

type FriendRanking = VenueDetail["friendRankings"][number];

function FriendRow({ friend, now, last }: { friend: FriendRanking; now: number; last: boolean }) {
  const when = formatRelativeTime(friend.when, now);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${friend.displayName}, ${formatScore(friend.score)}`}
      onPress={() => router.push(userPath(friend.userId))}
      style={({ pressed }) => [styles.friend, !last && styles.hairline, pressed && styles.pressed]}
    >
      <View style={styles.friendTop}>
        <Avatar name={friend.displayName} uri={friend.avatarUrl} size={48} />
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.rowTitle}>
            {friend.displayName}
            <Text style={styles.rowVerb}> ranked it</Text>
          </Text>
          <Text muted style={styles.rowSub}>
            {friend.isLocal ? `Local · ${when}` : when}
          </Text>
        </View>
        <ScoreBadge score={friend.score} />
      </View>
      {friend.caption ? (
        <Text style={styles.quote}>
          <Text style={styles.quoteLabel}>Notes: </Text>
          {friend.caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

const SHOT_WIDTH = 168;
const SHOT_HEIGHT = 210;

/** The photos friends took here, as a sideways row of tall cards with the photographer's name on each. */
export function PhotosSection({ venue }: { venue: VenueDetail }) {
  const shots = venue.friendRankings.filter((friend) => !!friend.photoUrl);
  if (shots.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionTitle>Photos</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.cards}>
        {shots.map((friend) => (
          <Pressable
            key={friend.userId}
            accessibilityRole="button"
            accessibilityLabel={`Photo by ${friend.displayName}`}
            onPress={() => router.push(userPath(friend.userId))}
            style={({ pressed }) => [styles.shot, shots.length === 1 && styles.shotWide, pressed && styles.cardPressed]}
          >
            <Image source={{ uri: friend.photoUrl }} resizeMode="cover" style={StyleSheet.absoluteFill} />
            <Scrim from="rgba(0, 0, 0, 0)" to="rgba(0, 0, 0, 0.62)" height="45%" />
            <View style={styles.shotBy}>
              <Avatar name={friend.displayName} uri={friend.avatarUrl} size={22} />
              <Text numberOfLines={1} style={styles.shotName}>
                {friend.displayName}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Friends who ranked it: who, their score, what they wrote, when, and their photo. */
export function FriendsSection({ venue, now }: { venue: VenueDetail; now: number }) {
  const friends = venue.friendRankings;
  if (friends.length === 0) {
    return (
      <View style={styles.section}>
        <SectionTitle>Friends who went</SectionTitle>
        <View style={styles.quiet}>
          <Icon name="users" size={18} color={colors.low} />
          <Text muted style={styles.quietText}>
            No friends have ranked this yet. Be the first.
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <SectionTitle note={friends.length > 1 ? `${friends.length} friends` : undefined}>Friends who went</SectionTitle>
      <View>
        {friends.map((friend, index) => (
          <FriendRow key={friend.userId} friend={friend} now={now} last={index === friends.length - 1} />
        ))}
      </View>
    </View>
  );
}

/**
 * How much of each thing the venue has, one slim bar each. One quiet colour: a low bar is a fact
 * about the place (not a dancing spot), not a bad score, so it does not get the rating colours.
 */
export function BreakdownSection({ breakdown }: { breakdown: VenueDetail["breakdown"] }) {
  if (!breakdown || breakdown.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionTitle>Why it fits you</SectionTitle>
      <View style={styles.bars}>
        {breakdown.map((row) => (
          <View key={row.label} accessibilityLabel={`${row.label} ${row.value.toFixed(1)}`} style={styles.barRow}>
            <Text numberOfLines={1} style={styles.barLabel}>
              {row.label}
            </Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.min(1, Math.max(0, row.value / 10)) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.barValue}>{row.value.toFixed(1)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** What visitors said after ranking it: the highlights, who it is best for, and how each question was answered. */
export function InsightsSection({ insights }: { insights: VenueInsights | null | undefined }) {
  if (!insights) return null;
  const asked = insights.distributions.filter((distribution) => distribution.total > 0);
  // With only a couple of answers the backend withholds the split (every share is 0): rows of "0%" would read as a result.
  const answered = asked.filter((distribution) => distribution.options.some((option) => option.pct > 0));
  const withheld = asked.length > 0 && answered.length === 0;
  if (insights.highlights.length === 0 && insights.bestFor.length === 0 && asked.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionTitle note={insights.confidence === "low" ? "Based on a few visits" : undefined}>What people say</SectionTitle>
      {insights.highlights.length > 0 ? (
        <View style={styles.highlights}>
          {insights.highlights.map((highlight) => (
            <View key={highlight} style={styles.highlight}>
              <Icon name="check" size={16} color={colors.ok} />
              <Text style={styles.highlightText}>{highlight}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {insights.bestFor.length > 0 ? (
        <View accessibilityLabel={`Best for ${insights.bestFor.join(", ")}`} style={styles.pills}>
          <Text muted style={styles.bestFor}>
            Best for
          </Text>
          {insights.bestFor.map((item) => (
            <View key={item} style={styles.pill}>
              <Text style={styles.pillText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {withheld ? (
        <Text muted style={styles.questionText}>
          A few people have answered. The breakdown shows once more have.
        </Text>
      ) : null}
      {answered.map((distribution) => (
        <View key={distribution.questionId} style={styles.question}>
          <Text muted style={styles.questionText}>
            {distribution.text}
          </Text>
          {distribution.options.map((option) => {
            const leading = option.label === distribution.top;
            return (
              <View key={option.id} accessibilityLabel={`${option.label} ${Math.round(option.pct)}%`} style={styles.answer}>
                <View style={styles.answerTop}>
                  <Text numberOfLines={1} style={[styles.answerLabel, !leading && styles.dim]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.answerPct, !leading && styles.dim]}>{`${Math.round(option.pct)}%`}</Text>
                </View>
                <View style={styles.thinTrack}>
                  <View
                    style={[
                      styles.fill,
                      { width: `${Math.min(100, Math.max(0, option.pct))}%`, backgroundColor: leading ? colors.fg : colors.low },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function PerformerRow({ performer, last }: { performer: PerformerCard; last: boolean }) {
  const { run, pending } = useMutationToast(api.performers.follow);
  const label = performer.following ? "Following" : "Follow";
  const facts = [
    performer.genres.slice(0, 3).join(", "),
    performer.affinity !== undefined ? `You rate them ${formatScore(performer.affinity)}` : "",
  ].filter((part) => part !== "");
  return (
    <View style={[styles.performer, !last && styles.hairline]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={performer.name}
        onPress={() => router.push(performerPath(performer.performerId))}
        style={({ pressed }) => [styles.performerMain, pressed && styles.pressed]}
      >
        <Avatar name={performer.name} uri={performer.imageUrl} size={48} />
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.rowTitle}>
            {performer.name}
          </Text>
          {facts.length > 0 ? (
            <Text muted numberOfLines={1} style={styles.rowSub}>
              {facts.join(" · ")}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Button
        title={label}
        accessibilityLabel={label}
        accessibilityState={{ selected: performer.following, disabled: pending }}
        size="sm"
        variant="secondary"
        disabled={pending}
        onPress={() => void run({ performerId: performer.performerId, follow: !performer.following })}
        style={styles.follow}
      />
    </View>
  );
}

/** Events only: who is playing, each with "Follow" / "Following". */
export function PerformersSection({
  performers,
  names,
}: {
  /** `api.performers.forEvent`. undefined while loading. */
  performers: PerformerCard[] | undefined;
  /** The plain names on the event, shown when it has no performer pages. */
  names: string[] | undefined;
}) {
  if (performers === undefined) {
    if (!names || names.length === 0) return null;
    return (
      <View style={styles.section}>
        <SectionTitle>Lineup</SectionTitle>
        <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.loadingRows}>
          {names.slice(0, 3).map((name) => (
            <View key={name} style={styles.performerMain}>
              <Skeleton width={48} height={48} round={24} />
              <Skeleton width="50%" height={14} />
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (performers.length === 0) {
    if (!names || names.length === 0) return null;
    return (
      <View style={styles.section}>
        <SectionTitle>Lineup</SectionTitle>
        <Text style={styles.names}>{names.join(", ")}</Text>
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <SectionTitle>Lineup</SectionTitle>
      <View>
        {performers.map((performer, index) => (
          <PerformerRow key={performer.performerId} performer={performer} last={index === performers.length - 1} />
        ))}
      </View>
    </View>
  );
}

const CARD_WIDTH = 168;
const CARD_HEIGHT = 210;

function SimilarCard({ item, now }: { item: NearbyItem; now: number }) {
  const facts =
    item.kind === "event" && item.startsAt !== undefined
      ? formatEventTime(item.startsAt, now)
      : [categoryLabel(item.category, item.subcategory), formatDistance(item.distanceMeters)].filter((part) => part !== "").join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${formatScore(item.score)} for you. ${item.why}`}
      onPress={() => router.push(venuePath(item.kind, item.id))}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Photo uri={item.imageUrl} category={item.category} height={CARD_HEIGHT} label={`Photo of ${item.name}`} deep />
      <Scrim from="rgba(0, 0, 0, 0)" to="rgba(0, 0, 0, 0.82)" height="70%" />
      <ScoreBadge score={item.score} size="sm" style={styles.cardScore} />
      <View style={styles.cardText}>
        <Text numberOfLines={2} style={styles.cardName}>
          {item.name}
        </Text>
        <Text numberOfLines={1} style={styles.cardFacts}>
          {facts}
        </Text>
      </View>
    </Pressable>
  );
}

/** "More like this": a sideways row of photo cards, hidden when the backend has none. */
export function SimilarSection({ items, now }: { items: NearbyItem[] | undefined; now: number }) {
  if (items !== undefined && items.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionTitle>More like this</SectionTitle>
      {items === undefined ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.loadingCards}>
          <Skeleton width={CARD_WIDTH} height={CARD_HEIGHT} round={10} />
          <Skeleton width={CARD_WIDTH} height={CARD_HEIGHT} round={10} />
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.cards}>
          {items.map((item) => (
            <SimilarCard key={`${item.kind}:${item.id}`} item={item} now={now} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: spacing.md + 2 },
  hairline: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.hairline },
  pressed: { opacity: 0.55 },
  dim: { color: colors.muted },

  rowTitle: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold },
  rowSub: { fontSize: 13, lineHeight: 18 },

  quiet: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  quietText: { flex: 1, fontSize: 14, lineHeight: 20 },

  friend: { gap: spacing.md, paddingVertical: 14 },
  friendTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  quote: { color: colors.fg, fontSize: 15, lineHeight: 22 },
  quoteLabel: { fontSize: 15, lineHeight: 22, fontWeight: fontWeight.bold },
  shot: { width: SHOT_WIDTH, height: SHOT_HEIGHT, borderRadius: 10, overflow: "hidden", backgroundColor: colors.surface },
  shotWide: { width: 280 },
  shotBy: { position: "absolute", left: 10, right: 10, bottom: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  shotName: { flex: 1, color: palette.onPhoto, fontSize: 13, lineHeight: 17, fontWeight: fontWeight.semibold },

  bars: { gap: 14 },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  // Wide enough for the longest backend label ("Electronic music") at this size.
  barLabel: { width: 124, fontSize: 15, lineHeight: 20 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.raised, overflow: "hidden" },
  thinTrack: { height: 4, borderRadius: 2, backgroundColor: colors.raised, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3, backgroundColor: colors.fg },
  barValue: { width: 30, textAlign: "right", fontSize: 15, lineHeight: 20, fontWeight: fontWeight.semibold, fontVariant: ["tabular-nums"] },

  highlights: { gap: spacing.md - 2 },
  highlight: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  highlightText: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: fontWeight.medium },
  bestFor: { fontSize: 15, lineHeight: 21 },
  question: { gap: spacing.md - 2, paddingTop: spacing.sm },
  questionText: { fontSize: 14, lineHeight: 19 },
  answer: { gap: 6 },
  answerTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.md },
  answerLabel: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: fontWeight.medium },
  answerPct: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.semibold, fontVariant: ["tabular-nums"] },

  performer: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  performerMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 48 },
  follow: { width: "auto", minWidth: 96 },
  names: { fontSize: 16, lineHeight: 24 },
  loadingRows: { gap: spacing.md },

  // The row runs to both edges of the screen; the first card lines up with the headings.
  bleed: { marginHorizontal: -GUTTER, flexGrow: 0 },
  cards: { gap: spacing.md, paddingHorizontal: GUTTER },
  loadingCards: { flexDirection: "row", gap: spacing.md },
  card: { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 10, overflow: "hidden", backgroundColor: colors.surface },
  cardPressed: { opacity: 0.8 },
  cardScore: { position: "absolute", top: 8, right: 8 },
  cardText: { position: "absolute", left: 12, right: 12, bottom: 12, gap: 2 },
  cardName: { color: palette.onPhoto, fontSize: 16, lineHeight: 20, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  cardFacts: { color: palette.onPhoto, fontSize: 12.5, lineHeight: 17, opacity: 0.9 },

  rowVerb: { color: colors.muted, fontWeight: fontWeight.regular },
  pills: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  pill: { height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: "center", backgroundColor: palette.field },
  pillText: { fontSize: 13, lineHeight: 17, fontWeight: fontWeight.medium },
});
