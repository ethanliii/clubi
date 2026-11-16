import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  Avatar,
  BackButton,
  Button,
  EmptyState,
  ScoreBadge,
  Screen,
  Skeleton,
  SkeletonRows,
  Text,
  goBack,
} from "../../components";
import { FriendButton } from "../../features/friends";
import { PhotoCard, PlacePhoto, SectionLabel, TasteCompare } from "../../features/profile";
import { api, type CompareResult, type Id } from "../../lib/api";
import { categoryLabel } from "../../lib/format";
import { userPath, venuePath } from "../../lib/links";
import { colors, fontWeight, spacing } from "../../theme";

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const SCORE_COLUMN = 46;
/** A score out of ten as a bar width. */
const tenth = (score: number) => Math.min(100, Math.max(0, score * 10));

function SharedRow({
  item,
  imageUrl,
  divider,
}: {
  item: CompareResult["shared"][number];
  imageUrl?: string;
  divider: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      onPress={() => router.push(venuePath(item.kind, item.id))}
      style={({ pressed }) => [styles.sharedRow, pressed && styles.pressed]}
    >
      <PlacePhoto uri={item.imageUrl ?? imageUrl} category={item.category} width={56} height={56} round={10} />
      <View style={[styles.sharedRest, divider && styles.divider]}>
        <View style={styles.sharedText}>
          <Text numberOfLines={2} style={styles.sharedName}>
            {item.name}
          </Text>
          <Text variant="caption" muted numberOfLines={1}>
            {categoryLabel(item.category)}
          </Text>
          <View style={styles.pair}>
            <View style={styles.pairTrack}>
              <View style={[styles.pairFill, { width: `${tenth(item.myScore)}%`, backgroundColor: colors.accent }]} />
            </View>
            <View style={styles.pairTrack}>
              <View style={[styles.pairFill, { width: `${tenth(item.theirScore)}%`, backgroundColor: colors.fg }]} />
            </View>
          </View>
        </View>
        <View style={styles.scoreColumn}>
          <ScoreBadge score={item.myScore} size="md" />
        </View>
        <View style={styles.scoreColumn}>
          <ScoreBadge score={item.theirScore} size="md" />
        </View>
      </View>
    </Pressable>
  );
}

/** Why there is nothing to compare: the person is gone, it is me, or we are not friends yet. */
function NoCompare({ userId }: { userId: Id<"users"> }) {
  const profile = useQuery(api.profile.get, { userId });
  if (profile === undefined) return <SkeletonRows count={4} avatar={false} />;
  if (profile === null) {
    return <EmptyState icon="user" title="This person isn't on clubi anymore" actionLabel="Back" onAction={goBack} />;
  }
  if (profile.user.isMe) {
    return <EmptyState icon="user" title="That's you" body="Open a friend's profile to compare tastes." actionLabel="Back" onAction={goBack} />;
  }
  const { user } = profile;
  return (
    <View style={styles.noCompare}>
      <Avatar name={user.displayName} uri={user.avatarUrl} size={72} />
      <View style={styles.noCompareText}>
        <Text style={styles.title}>{`Compare with ${firstName(user.displayName)}`}</Text>
        <Text muted style={styles.lead}>
          Comparing shows each other&apos;s scores, so it&apos;s for friends.
        </Text>
      </View>
      <FriendButton userId={user.userId} displayName={user.displayName} status={user.status} requestId={user.requestId} />
      <Button
        title="View profile"
        accessibilityLabel="View profile"
        variant="ghost"
        onPress={() => router.replace(userPath(user.userId))}
      />
    </View>
  );
}

/** How my taste lines up with a friend's, from `api.profile.compare`. Every number here is the backend's. */
export default function CompareScreen() {
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = params.userId as Id<"users">;
  const result = useQuery(api.profile.compare, { userId });
  // Photos for the places we both ranked: `compare` sends none, but my own ranked list has them.
  const mine = useQuery(api.rankings.mine, result ? {} : "skip");

  if (result === undefined) {
    return (
      <Screen>
        <BackButton />
        <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.loading}>
          <Skeleton width="55%" height={30} />
          <Skeleton width={150} height={72} />
          <Skeleton width="80%" height={14} />
          <Skeleton height={150} />
        </View>
        <SkeletonRows count={3} avatar={false} />
      </Screen>
    );
  }
  if (result === null) {
    return (
      <Screen>
        <BackButton />
        <NoCompare userId={userId} />
      </Screen>
    );
  }

  const { me, them } = result;
  const theirName = firstName(them.displayName);
  // The backend's sentence opens with the match it already gave as a number; the big number says that part.
  const opening = `${result.tasteMatchPct}% taste match · `;
  const rest = result.summary.startsWith(opening) ? result.summary.slice(opening.length) : result.summary;
  const summary = rest.charAt(0).toUpperCase() + rest.slice(1);
  const photoOf = new Map<string, string>();
  for (const item of mine ?? []) if (item.imageUrl) photoOf.set(`${item.kind}-${item.id}`, item.imageUrl);

  return (
    <Screen>
      <BackButton />

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text accessibilityRole="header" numberOfLines={2} style={[styles.title, styles.grow]}>
            {`You and ${theirName}`}
          </Text>
          <View style={styles.faces}>
            <Avatar name={me.displayName} uri={me.avatarUrl} size={48} />
            <Avatar name={them.displayName} uri={them.avatarUrl} size={48} style={styles.overlap} />
          </View>
        </View>
        <View accessibilityLabel={`${result.tasteMatchPct}% taste match`} style={styles.match}>
          <Text style={styles.pct}>{`${result.tasteMatchPct}%`}</Text>
          <Text muted style={styles.pctLabel}>
            taste match
          </Text>
        </View>
        <Text style={styles.lead}>{summary}</Text>
      </View>

      {result.dims.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel title="Your tastes" />
          <TasteCompare dims={result.dims} theirName={theirName} />
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionLabel title="Both ranked" />
        {result.shared.length === 0 ? (
          <Text muted style={styles.lead}>
            No places in common yet.
          </Text>
        ) : (
          <View>
            <View style={styles.columns}>
              <Text muted style={styles.agree}>
                {result.agreePct !== undefined ? `You agree on ${result.agreePct}%` : ""}
              </Text>
              <Text variant="caption" numberOfLines={1} style={[styles.columnHead, styles.mineHead]}>
                You
              </Text>
              <Text variant="caption" muted numberOfLines={1} style={styles.columnHead}>
                {theirName}
              </Text>
            </View>
            {result.shared.map((item, index) => (
              <SharedRow
                key={`${item.kind}-${item.id}`}
                item={item}
                imageUrl={photoOf.get(`${item.kind}-${item.id}`)}
                divider={index < result.shared.length - 1}
              />
            ))}
          </View>
        )}
      </View>

      {result.theirTopNewToMe.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel title={`${theirName}'s picks you haven't ranked`} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}
          >
            {result.theirTopNewToMe.map((item) => (
              <PhotoCard key={item.rankingId} item={item} />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { gap: spacing.lg },
  hero: { gap: spacing.xs },
  heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grow: { flex: 1 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: fontWeight.bold, letterSpacing: -0.5 },
  faces: { flexDirection: "row", alignItems: "center" },
  overlap: { marginLeft: -8 },
  match: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, paddingTop: spacing.sm },
  pct: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: fontWeight.bold,
    letterSpacing: -2,
    color: colors.accent,
    fontVariant: ["tabular-nums"],
  },
  pctLabel: { fontSize: 17, lineHeight: 22 },
  lead: { fontSize: 15, lineHeight: 21, color: colors.muted },
  section: { gap: spacing.md, paddingTop: spacing.md },
  columns: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingBottom: spacing.xs },
  agree: { flex: 1, fontSize: 13, lineHeight: 17 },
  columnHead: { width: SCORE_COLUMN, textAlign: "center" },
  mineHead: { color: colors.accent, fontWeight: fontWeight.bold },
  sharedRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  sharedRest: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 80, paddingVertical: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  pressed: { opacity: 0.6 },
  sharedText: { flex: 1, gap: spacing.xxs },
  sharedName: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  pair: { gap: 3, paddingTop: 4 },
  pairTrack: { height: 4, borderRadius: 2, backgroundColor: colors.raised, overflow: "hidden" },
  pairFill: { height: "100%", borderRadius: 2 },
  scoreColumn: { width: SCORE_COLUMN, alignItems: "center" },
  // Bleeds to the screen edges so the cards scroll under them.
  carousel: { flexGrow: 0, marginHorizontal: -spacing.lg },
  carouselContent: { paddingHorizontal: spacing.lg, gap: spacing.md },
  noCompare: { gap: spacing.md, paddingTop: spacing.sm },
  noCompareText: { gap: spacing.xs, paddingBottom: spacing.sm },
});
