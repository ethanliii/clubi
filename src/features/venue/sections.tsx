import { router } from "expo-router";
import { useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import {
  Avatar,
  Button,
  Chip,
  ChipRow,
  ItemCard,
  ListRow,
  Meter,
  ScoreBadge,
  SectionHeader,
  SkeletonCards,
  SkeletonRows,
  Text,
  VenuePhoto,
} from "../../components";
import { api, type NearbyItem, type PerformerCard, type VenueDetail, type VenueInsights } from "../../lib/api";
import { categoryHue, formatRelativeTime, formatScore } from "../../lib/format";
import { performerPath, userPath } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, radius, spacing } from "../../theme";

/** The venue's own picture, or the app's category-colored placeholder when it has none or it fails to load. */
export function VenueHero({ venue, height = 210 }: { venue: VenueDetail; height?: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = venue.imageUrl && venue.imageUrl !== failedUrl ? venue.imageUrl : null;
  if (url === null) return <VenuePhoto hue={categoryHue(venue.category)} height={height} />;
  return (
    <Image
      source={{ uri: url }}
      resizeMode="cover"
      accessibilityLabel={`Photo of ${venue.name}`}
      onError={() => setFailedUrl(url)}
      style={[styles.hero, { height }]}
    />
  );
}

/** What visitors said after ranking it: highlights, "best for", and one bar per answered question. */
export function InsightsSection({ insights }: { insights: VenueInsights | null | undefined }) {
  if (!insights) return null;
  const answered = insights.distributions.filter((distribution) => distribution.total > 0);
  if (insights.highlights.length === 0 && insights.bestFor.length === 0 && answered.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionHeader title="What people say" />
      {insights.highlights.length > 0 ? (
        <ChipRow>
          {insights.highlights.map((highlight) => (
            <Chip key={highlight} label={highlight} size="sm" />
          ))}
        </ChipRow>
      ) : null}
      {insights.bestFor.length > 0 ? (
        <View style={styles.bestFor}>
          <Text muted>Best for:</Text>
          <ChipRow style={styles.flex}>
            {insights.bestFor.map((label) => (
              <Chip key={label} label={label} size="sm" accessibilityLabel={`Best for ${label}`} />
            ))}
          </ChipRow>
        </View>
      ) : null}
      {insights.confidence === "low" ? (
        <Text variant="caption" muted>
          Based on a few visits
        </Text>
      ) : null}
      {answered.map((distribution) => (
        <View key={distribution.questionId} style={styles.distribution}>
          <Text style={styles.strong}>{distribution.text}</Text>
          {distribution.options.map((option) => (
            <Meter key={option.id} label={option.label} value={option.pct} />
          ))}
        </View>
      ))}
    </View>
  );
}

function PerformerRow({ performer }: { performer: PerformerCard }) {
  const { run, pending } = useMutationToast(api.performers.follow);
  const label = performer.following ? "Following" : "Follow";
  const facts = [
    performer.genres.slice(0, 3).join(", "),
    performer.affinity !== undefined ? `You rate them ${formatScore(performer.affinity)}` : "",
  ].filter((part) => part !== "");
  return (
    <ListRow
      title={performer.name}
      subtitle={facts.join(" · ") || undefined}
      left={<Avatar name={performer.name} uri={performer.imageUrl} size={44} />}
      onPress={() => router.push(performerPath(performer.performerId))}
      right={
        <Button
          title={label}
          accessibilityLabel={label}
          variant={performer.following ? "ghost" : "primary"}
          disabled={pending}
          onPress={() => void run({ performerId: performer.performerId, follow: !performer.following })}
          style={styles.smallButton}
        />
      }
    />
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
        <SectionHeader title="Playing" />
        <SkeletonRows count={Math.min(names.length, 3)} />
      </View>
    );
  }
  if (performers.length === 0) {
    if (!names || names.length === 0) return null;
    return (
      <View style={styles.section}>
        <SectionHeader title="Playing" />
        <Text>{names.join(", ")}</Text>
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <SectionHeader title="Playing" />
      <View>
        {performers.map((performer) => (
          <PerformerRow key={performer.performerId} performer={performer} />
        ))}
      </View>
    </View>
  );
}

/** Friends who ranked it: name, their score, what they wrote, when, and their photo. */
export function FriendsSection({ venue, now }: { venue: VenueDetail; now: number }) {
  return (
    <View style={styles.section}>
      <SectionHeader title="Friends who went" count={venue.friendRankings.length > 0 ? venue.friendRankings.length : undefined} />
      {venue.friendRankings.length === 0 ? (
        <Text muted>None of your friends have ranked this yet. Be the first.</Text>
      ) : (
        <View>
          {venue.friendRankings.map((friend) => (
            <ListRow
              key={friend.userId}
              title={friend.displayName}
              subtitle={formatRelativeTime(friend.when, now)}
              accessibilityLabel={`${friend.displayName}, ${formatScore(friend.score)}`}
              left={<Avatar name={friend.displayName} uri={friend.avatarUrl} size={44} />}
              right={
                <View style={styles.center}>
                  <ScoreBadge score={friend.score} />
                </View>
              }
              onPress={() => router.push(userPath(friend.userId))}
            >
              {friend.isLocal ? <Chip label="Local" size="sm" style={styles.start} /> : null}
              {friend.caption ? <Text>{`“${friend.caption}”`}</Text> : null}
              {friend.photoUrl ? (
                <Image
                  source={{ uri: friend.photoUrl }}
                  resizeMode="cover"
                  accessibilityLabel={`Photo by ${friend.displayName}`}
                  style={styles.friendPhoto}
                />
              ) : null}
            </ListRow>
          ))}
        </View>
      )}
    </View>
  );
}

/** "More like this": a sideways row of cards, hidden when the backend has none. */
export function SimilarSection({ items }: { items: NearbyItem[] | undefined }) {
  if (items !== undefined && items.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionHeader title="More like this" />
      {items === undefined ? (
        <SkeletonCards />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
          {items.map((item) => (
            <ItemCard key={`${item.kind}:${item.id}`} item={item} variant="card" width={220} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  start: { alignSelf: "flex-start" },
  center: { alignSelf: "center" },
  strong: { fontWeight: "600" },
  hero: { width: "100%", borderRadius: radius.xl, backgroundColor: colors.raised },
  section: { gap: spacing.md },
  bestFor: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  distribution: { gap: spacing.sm },
  smallButton: { width: "auto", paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg, minHeight: 40 },
  friendPhoto: { width: "100%", height: 170, borderRadius: radius.lg, marginTop: spacing.xs, backgroundColor: colors.raised },
  cards: { gap: spacing.md, paddingRight: spacing.lg },
});
