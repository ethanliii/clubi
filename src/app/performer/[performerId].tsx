import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton, EmptyState, ErrorBoundary, goBack, Screen, Skeleton, Text } from "../../components";
import { FollowButton } from "../../features/performers/FollowButton";
import { hueOf, ShowPhoto } from "../../features/performers/ShowPhoto";
import { GUTTER, Page } from "../../features/trips/Page";
import { PlacePhoto } from "../../features/trips/PlacePhoto";
import { ScreenTop, SectionLabel } from "../../features/trips/ScreenTop";
import { api, type Id } from "../../lib/api";
import { formatEventTime, formatScore } from "../../lib/format";
import { venuePath } from "../../lib/links";
import { useNow } from "../../lib/useNow";
import { colors, fontWeight, radius, ratingColor, spacing } from "../../theme";

/** Tall when there is a real picture of the artist to show, short when it is only the colour wash. */
const HERO = 400;
const HERO_PLAIN = 232;
const THUMB = 72;

export default function PerformerScreen() {
  const { performerId } = useLocalSearchParams<{ performerId: string }>();
  const performer = useQuery(api.performers.get, { performerId: performerId as Id<"performers"> });
  const now = useNow();
  const insets = useSafeAreaInsets();

  if (performer === undefined) {
    return (
      <Screen>
        <ScreenTop title="" />
        <Skeleton height={220} round={radius.xl} />
        <Skeleton width="60%" height={28} />
        <Skeleton height={48} round={24} />
        <Skeleton height={THUMB} round={radius.lg} />
        <Skeleton height={THUMB} round={radius.lg} />
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

  const heroHeight = (performer.imageUrl ? HERO : HERO_PLAIN) + insets.top;
  const hero = (
    <View style={[styles.hero, { height: heroHeight }]}>
      <PlacePhoto uri={performer.imageUrl} hue={hueOf(performer.name)} height={heroHeight} round={0} />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(20,17,25,0.55)", "rgba(20,17,25,0)", "rgba(20,17,25,0.6)", colors.bg]}
        locations={[0, 0.28, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.back, { top: insets.top + spacing.xs }]}>
        <BackButton />
      </View>
      <View style={styles.heroText}>
        <Text accessibilityRole="header" numberOfLines={3} style={styles.name}>
          {performer.name}
        </Text>
        {performer.genres.length > 0 ? (
          <Text numberOfLines={1} style={styles.genres}>
            {performer.genres.join(" · ")}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <Page hero={hero}>
      <View style={styles.actions}>
        <FollowButton performerId={performer.performerId} following={performer.following} style={styles.follow} />
        {performer.affinity !== undefined ? (
          <View accessibilityLabel={`You rate them ${formatScore(performer.affinity)}`} style={styles.affinity}>
            <Text style={[styles.affinityScore, { color: ratingColor(performer.affinity) }]}>
              {formatScore(performer.affinity)}
            </Text>
            <Text variant="caption" muted>
              your score
            </Text>
          </View>
        ) : null}
      </View>
      {performer.affinity === undefined ? (
        <Text muted style={styles.hint}>
          Rank one of their shows to see your score for them.
        </Text>
      ) : null}

      <View style={styles.section}>
        <SectionLabel title="Upcoming shows" />
        {performer.upcoming.length === 0 ? (
          <Text muted>No dates nearby yet.</Text>
        ) : (
          <View>
            {performer.upcoming.map((event) => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={`${event.title}, ${formatEventTime(event.startsAt, now)}`}
                onPress={() => router.push(venuePath("event", event.id))}
                style={({ pressed }) => [styles.show, pressed && styles.pressed]}
              >
                {/* The show's own picture is a second read; without it the row keeps its category look. */}
                <ErrorBoundary fallback={() => <PlacePhoto category="live" height={THUMB} width={THUMB} round={radius.lg} />}>
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
                    <Text muted numberOfLines={1}>
                      {event.venueName}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: spacing.lg },
  back: { position: "absolute", left: GUTTER },
  heroText: { position: "absolute", left: GUTTER, right: GUTTER, bottom: 0, gap: spacing.xs },
  name: { fontSize: 36, lineHeight: 40, fontWeight: fontWeight.bold, letterSpacing: -0.8, color: colors.white },
  genres: { fontSize: 15, lineHeight: 20, color: colors.fg, opacity: 0.85 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  follow: { flex: 1, borderRadius: radius.pill },
  affinity: { alignItems: "center", minWidth: 64 },
  affinityScore: { fontSize: 26, lineHeight: 30, fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
  hint: { marginTop: -spacing.md },
  section: { gap: spacing.sm },
  show: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm + 2, minHeight: 44 },
  pressed: { opacity: 0.6 },
  showText: { flex: 1, gap: 2 },
  when: { fontSize: 13, lineHeight: 17, fontWeight: fontWeight.semibold, color: colors.mid },
  title: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.semibold },
});
