import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, EmptyState, ErrorBoundary, goBack, Icon, Screen, ScoreBadge, Skeleton, Text } from "../../components";
import { FollowButton } from "../../features/performers/FollowButton";
import { ShowPhoto } from "../../features/performers/ShowPhoto";
import { PlacePhoto } from "../../features/trips/PlacePhoto";
import { ScreenTop, SectionLabel } from "../../features/trips/ScreenTop";
import { api, type Id } from "../../lib/api";
import { formatEventTime, formatScore, pluralize } from "../../lib/format";
import { venuePath } from "../../lib/links";
import { useNow } from "../../lib/useNow";
import { colors, fontWeight, radius, spacing } from "../../theme";

const FACE = 104;
const THUMB = 72;

export default function PerformerScreen() {
  const { performerId } = useLocalSearchParams<{ performerId: string }>();
  return (
    // A link with an id the backend does not recognise throws; show it as an artist we could not find.
    <ErrorBoundary
      key={performerId}
      fallback={() => (
        <Screen>
          <ScreenTop title="Artist" />
          <EmptyState title="We couldn't find this artist." icon="music" actionLabel="Back" onAction={goBack} />
        </Screen>
      )}
    >
      <PerformerLoader />
    </ErrorBoundary>
  );
}

function PerformerLoader() {
  const { performerId } = useLocalSearchParams<{ performerId: string }>();
  const performer = useQuery(api.performers.get, { performerId: performerId as Id<"performers"> });
  const now = useNow();

  if (performer === undefined) {
    return (
      <Screen>
        <ScreenTop title="" />
        <View style={styles.who}>
          <Skeleton width={FACE} height={FACE} round={FACE / 2} />
          <Skeleton width={180} height={24} />
          <Skeleton width={120} height={14} />
        </View>
        <Skeleton height={44} round={22} />
        <Skeleton height={THUMB} round={radius.md + 2} />
        <Skeleton height={THUMB} round={radius.md + 2} />
      </Screen>
    );
  }
  if (performer === null) {
    return (
      <Screen>
        <ScreenTop title="Artist" />
        <EmptyState title="We couldn't find this artist." icon="music" actionLabel="Back" onAction={goBack} />
      </Screen>
    );
  }

  const shows = performer.upcoming.length;

  return (
    <Screen>
      <ScreenTop title="" />

      <View style={styles.who}>
        <Avatar name={performer.name} uri={performer.imageUrl} size={FACE} style={styles.face} />
        <Text accessibilityRole="header" numberOfLines={3} style={styles.name}>
          {performer.name}
        </Text>
        {performer.genres.length > 0 ? (
          <Text muted numberOfLines={1} style={styles.genres}>
            {performer.genres.join(" · ")}
          </Text>
        ) : null}
      </View>

      <View style={styles.counts}>
        <View accessibilityLabel={pluralize(shows, "upcoming show", "upcoming shows")} style={styles.count}>
          <Text style={styles.countValue}>{shows}</Text>
          <Text variant="caption" muted>
            {shows === 1 ? "Upcoming show" : "Upcoming shows"}
          </Text>
        </View>
        <View style={styles.countRule} />
        <View
          accessibilityLabel={performer.affinity === undefined ? "No score yet" : `You rate them ${formatScore(performer.affinity)}`}
          style={styles.count}
        >
          {performer.affinity === undefined ? (
            <Text style={[styles.countValue, styles.countNone]}>–</Text>
          ) : (
            <ScoreBadge score={performer.affinity} style={styles.ring} />
          )}
          <Text variant="caption" muted>
            Your score
          </Text>
        </View>
      </View>

      <FollowButton performerId={performer.performerId} following={performer.following} style={styles.follow} />
      {performer.affinity === undefined ? (
        <Text variant="caption" muted style={styles.hint}>
          Rank one of their shows to see your score for them.
        </Text>
      ) : null}

      <View style={styles.section}>
        <SectionLabel title="Upcoming shows" />
        {shows === 0 ? (
          <Text muted>No dates nearby yet.</Text>
        ) : (
          <View>
            {performer.upcoming.map((event, index) => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={`${event.title}, ${formatEventTime(event.startsAt, now)}`}
                onPress={() => router.push(venuePath("event", event.id))}
                style={({ pressed }) => [styles.show, index > 0 && styles.divided, pressed && styles.pressed]}
              >
                {/* The show's own picture is a second read; without it the row keeps its category look. */}
                <ErrorBoundary fallback={() => <PlacePhoto category="live" height={THUMB} width={THUMB} round={radius.md + 2} />}>
                  <ShowPhoto eventId={event.id} size={THUMB} />
                </ErrorBoundary>
                <View style={styles.showText}>
                  <Text numberOfLines={1} style={styles.when}>
                    {formatEventTime(event.startsAt, now)}
                  </Text>
                  <Text numberOfLines={2} style={styles.title}>
                    {event.title}
                  </Text>
                  {event.venueName ? (
                    <Text muted numberOfLines={1} style={styles.venue}>
                      {event.venueName}
                    </Text>
                  ) : null}
                </View>
                <Icon name="chevron" size={16} color={colors.low} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  who: { alignItems: "center", gap: spacing.xs },
  face: { borderWidth: 0, marginBottom: spacing.sm },
  name: { fontSize: 24, lineHeight: 29, fontWeight: fontWeight.bold, letterSpacing: -0.4, textAlign: "center" },
  genres: { fontSize: 15, lineHeight: 20, textAlign: "center" },
  counts: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  count: { flex: 1, alignItems: "center", gap: 2 },
  countValue: { fontSize: 20, lineHeight: 40, fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
  countNone: { color: colors.low },
  countRule: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: colors.line },
  ring: { alignSelf: "center" },
  follow: { minHeight: 44 },
  hint: { textAlign: "center", marginTop: -spacing.sm },
  section: { gap: spacing.sm, marginTop: spacing.sm },
  show: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, minHeight: 44 },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  pressed: { opacity: 0.6 },
  showText: { flex: 1, gap: 2 },
  when: { fontSize: 13, lineHeight: 17, fontWeight: fontWeight.semibold, color: colors.accent },
  title: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  venue: { fontSize: 14, lineHeight: 19 },
});
