import { useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, EmptyState, Header, Icon, IconButton, Screen, Skeleton, Text, goBack } from "../../components";
import { api, type Id, type Kind, type Source, type VenueDetail } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { useKeptQuery } from "../../lib/useKeptQuery";
import { categoryLabel, formatDistance, formatEventTime, formatPrice, formatScore, pluralize } from "../../lib/format";
import { directionsUrl, openUrl, ratePath } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { useNow } from "../../lib/useNow";
import { colors, fontWeight, palette, spacing } from "../../theme";
import { DetailRow, GUTTER, Photo, ScoreTile, Scrim, SectionTitle, pageFade } from "./parts";
import { BreakdownSection, FriendsSection, InsightsSection, PerformersSection, SimilarSection } from "./sections";

/** "View on …" for the event sources that have a page worth opening (docs/UI-SPEC.md section 5). */
const SOURCE_LABELS: Partial<Record<Source, string>> = {
  luma: "View on Luma",
  partiful: "View on Partiful",
  ticketmaster: "View on Ticketmaster",
  eventbrite: "View on Eventbrite",
};

/** The photo header: tall when there is a real photo to show, shorter for the category look. */
const HERO_WITH_PHOTO = 440;
const HERO_PLAIN = 300;
/** How far above the name the photo starts to darken. */
const FADE_LEAD = 150;
/** The pinned action bar's buttons. */
const ACTION_HEIGHT = 52;

function NotListed() {
  return (
    <Screen>
      <Header />
      <EmptyState title="This place is no longer listed" actionLabel="Back" onAction={goBack} />
    </Screen>
  );
}

function LoadingVenue() {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.root}>
      <Skeleton height={HERO_PLAIN} round={0} />
      <View style={styles.loadingBody}>
        <Skeleton height={30} width="72%" />
        <View style={styles.loadingFact}>
          <Skeleton width={64} height={64} round={18} />
          <View style={styles.loadingLines}>
            <Skeleton height={18} width="80%" />
            <Skeleton height={13} width="50%" />
          </View>
        </View>
        <Skeleton height={14} />
        <Skeleton height={14} width="86%" />
        <Skeleton height={14} width="60%" />
      </View>
      <View style={[styles.loadingBack, { top: insets.top + 6 }]}>
        <FloatingBack />
      </View>
    </View>
  );
}

/**
 * Everything about one place or event, and the way into ranking it (docs/UI-SPEC.md section 5).
 * Every number and sentence here is drawn as the backend returned it.
 */
export function VenuePage({ kind, id }: { kind: Kind; id: string }) {
  const { lat, lng, ready } = useDemoLocation();
  // Opened before the phone knows where it is (a reload on this page): show the place right away,
  // and switch to the answer that includes the distance once the location arrives.
  const [startedReady] = useState(ready);
  // Kept while the location moves: a new fix must not swap the page for its loading state.
  const located = useKeptQuery(api.places.get, ready ? { kind, id, lat, lng } : "skip", `${kind}:${id}`);
  const unlocated = useQuery(api.places.get, startedReady ? "skip" : { kind, id });
  const venue = located !== undefined ? located : unlocated;
  const hasDistance = located !== undefined;

  // The typed calls below take the id the backend itself returned, never the raw text from the address.
  const venueId = venue?.id;
  const insights = useQuery(api.insights.venue, venueId ? { kind, id: venueId } : "skip");
  const performers = useQuery(
    api.performers.forEvent,
    venueId && kind === "event" ? { eventId: venueId as Id<"events"> } : "skip",
  );
  const similar = useKeptQuery(
    api.discover.similar,
    venueId && ready ? { kind, id: venueId, lat, lng } : "skip",
    `${kind}:${venueId ?? ""}`,
  );

  if (venue === undefined) return <LoadingVenue />;
  if (venue === null) return <NotListed />;
  return (
    <Loaded
      venue={venue}
      hasDistance={hasDistance}
      insights={insights}
      performers={kind === "event" ? performers : []}
      similar={similar}
    />
  );
}

/** The round back button that floats over the photo. */
function FloatingBack() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={6}
      onPress={goBack}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <Icon name="back" size={20} color={colors.white} />
    </Pressable>
  );
}

function Loaded({
  venue,
  hasDistance,
  insights,
  performers,
  similar,
}: {
  venue: VenueDetail;
  hasDistance: boolean;
  insights: React.ComponentProps<typeof InsightsSection>["insights"];
  performers: React.ComponentProps<typeof PerformersSection>["performers"];
  similar: React.ComponentProps<typeof SimilarSection>["items"];
}) {
  const now = useNow();
  const insets = useSafeAreaInsets();
  const [scrollY] = useState(() => new Animated.Value(0));
  const { run: toggleSave, pending: saving } = useMutationToast(api.saves.toggle);
  const { run: toggleGoing, pending: goingPending } = useMutationToast(api.saves.toggle);
  const isEvent = venue.kind === "event";

  const heroHeight = venue.imageUrl ? HERO_WITH_PHOTO : HERO_PLAIN;
  // The fade into the page is as tall as the words on the photo need: a short name leaves more
  // of the picture clear, a four-line event title still reads over a busy poster.
  const [textHeight, setTextHeight] = useState(120);
  const fadeHeight = Math.min(heroHeight, textHeight + FADE_LEAD + 8);
  // The bar under the back button fades in once the name has scrolled away beneath it.
  const barOpacity = scrollY.interpolate({
    inputRange: [heroHeight - insets.top - 130, heroHeight - insets.top - 70],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const kindLine = [categoryLabel(venue.category, venue.subcategory), formatPrice(venue.priceLevel)]
    .filter((part) => part !== "")
    .join(" · ");
  const distance = hasDistance ? formatDistance(venue.distanceMeters) : "";
  const openLabel = isEvent ? "" : venue.openNow === true ? "Open now" : venue.openNow === false ? "Closed now" : "";
  const when = isEvent && venue.startsAt !== undefined ? formatEventTime(venue.startsAt, now) : "";
  const nameSize = venue.name.length > 44 ? styles.nameSmall : venue.name.length > 22 ? styles.nameMedium : null;

  const rankLabel = venue.myRanking ? "Rank again" : isEvent ? "Rank this event" : "Rank this place";
  const saveLabel = venue.saved ? "Saved" : "Save";
  const goingLabel = venue.going ? "Going" : "I'm going";
  const sourceLabel = venue.source ? SOURCE_LABELS[venue.source] : undefined;
  const { ticketUrl, sourceUrl, website } = venue;
  // The heading already says whether it is open, so the reason line does not repeat it.
  const why = openLabel === "Open now" ? venue.why.replace(/\s*·\s*Open now\s*$/i, "") || venue.why : venue.why;
  // The tags the heading and the blurb have not already said ("Bakery" under a bakery's name adds nothing).
  const blurbText = (venue.blurb ?? "").toLowerCase();
  const kindWords = [venue.category, venue.subcategory ?? ""].map((word) => word.replace(/_/g, " ").toLowerCase());
  const tags = venue.tags
    .map((tag) => tag.replace(/_/g, " "))
    .filter((tag) => !kindWords.includes(tag.toLowerCase()) && !blurbText.includes(tag.toLowerCase()))
    .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1));
  const socialProof = [
    `${venue.matchPct}% match for you`,
    venue.ratingCount !== undefined && venue.ratingCount > 0 ? `${pluralize(venue.ratingCount, "ranking")} on clubi` : "",
  ].filter((part) => part !== "");

  // The details list, top to bottom. Built first so the last line can drop its divider.
  const details: React.ComponentProps<typeof DetailRow>[] = [
    ...(when ? [{ icon: "calendar" as const, title: when }] : []),
    {
      icon: "navigate" as const,
      title: venue.address ?? "Directions",
      subtitle: distance ? `${distance} away` : undefined,
      action: venue.address ? "Directions" : undefined,
      accessibilityLabel: "Directions",
      onPress: () => void openUrl(directionsUrl(venue.lat, venue.lng, venue.name)),
    },
    ...(venue.hours ? [{ icon: "clock" as const, title: venue.hours, subtitle: openLabel || undefined }] : []),
    ...(venue.priceLevel ? [{ icon: "price" as const, title: formatPrice(venue.priceLevel) }] : []),
    ...(ticketUrl
      ? [{ icon: "ticket" as const, title: "Get tickets", accessibilityLabel: "Get tickets", onPress: () => void openUrl(ticketUrl) }]
      : []),
    ...(sourceUrl && sourceLabel
      ? [{ icon: "external" as const, title: sourceLabel, accessibilityLabel: sourceLabel, onPress: () => void openUrl(sourceUrl) }]
      : []),
    ...(website
      ? [
          {
            icon: "globe" as const,
            title: website.replace(/^https?:\/\/(www\.)?/i, "").replace(/[/?#].*$/, ""),
            accessibilityLabel: "Website",
            onPress: () => void openUrl(website),
          },
        ]
      : []),
    ...(venue.phone ? [{ icon: "phone" as const, title: venue.phone }] : []),
  ];

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: Platform.OS !== "web",
        })}
        contentContainerStyle={{ paddingBottom: ACTION_HEIGHT + Math.max(insets.bottom, 14) + 44 }}
      >
        <View style={{ height: heroHeight }}>
          <Photo
            uri={venue.imageUrl}
            category={venue.category}
            height={heroHeight}
            label={`Photo of ${venue.name}`}
          />
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(0, 0, 0, 0.5)", "rgba(0, 0, 0, 0)"]}
            style={[styles.topShade, { height: insets.top + 96 }]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[pageFade(0), pageFade(0.5), pageFade(0.9), pageFade(0.97), pageFade(1)]}
            locations={[
              0,
              (FADE_LEAD * 0.45) / fadeHeight,
              FADE_LEAD / fadeHeight,
              (FADE_LEAD + textHeight * 0.4) / fadeHeight,
              1,
            ]}
            style={[styles.heroFade, { height: fadeHeight }]}
          />
          {venue.imageUrl && venue.imageAttribution ? (
            <Text numberOfLines={1} style={[styles.credit, { top: insets.top + 18 }]}>
              {venue.imageAttribution}
            </Text>
          ) : null}
          <View onLayout={(event) => setTextHeight(Math.round(event.nativeEvent.layout.height))} style={styles.heroText}>
            <Text style={styles.kindLine}>{kindLine}</Text>
            <Text accessibilityRole="header" numberOfLines={4} style={[styles.name, nameSize]}>
              {venue.name}
            </Text>
            {when ? (
              <Text style={styles.when}>{distance ? `${when} · ${distance}` : when}</Text>
            ) : openLabel || distance ? (
              <View style={styles.statusRow}>
                {openLabel ? (
                  <>
                    <View style={[styles.statusDot, venue.openNow ? styles.statusOpen : null]} />
                    <Text style={[styles.status, venue.openNow ? styles.statusOpenText : null]}>{openLabel}</Text>
                  </>
                ) : null}
                {distance ? <Text style={styles.status}>{openLabel ? `·  ${distance}` : distance}</Text> : null}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.lead}>
            <View style={styles.fact}>
              <ScoreTile score={venue.score} size={64} />
              <View style={styles.factText}>
                <Text style={styles.why}>{why}</Text>
                <Text muted style={styles.proof}>
                  {socialProof.join(" · ")}
                </Text>
              </View>
            </View>
            {venue.myRanking ? (
              <View
                accessibilityLabel={`You ranked it #${venue.myRanking.position} of ${venue.myRanking.outOf}, ${formatScore(venue.myRanking.score)}`}
                style={styles.mine}
              >
                <Text style={styles.mineText}>
                  {`You ranked it #${venue.myRanking.position} of ${venue.myRanking.outOf}`}
                </Text>
                <Text style={styles.mineScore}>{formatScore(venue.myRanking.score)}</Text>
              </View>
            ) : null}
            {venue.blurb ? <Text style={styles.blurb}>{venue.blurb}</Text> : null}
            {tags.length > 0 ? (
              <Text muted style={styles.tags}>
                {tags.join(" · ")}
              </Text>
            ) : null}
          </View>

          <FriendsSection venue={venue} now={now} />

          {isEvent ? <PerformersSection performers={performers} names={venue.performers} /> : null}

          <InsightsSection insights={insights} />

          <BreakdownSection breakdown={venue.breakdown} />

          <View>
            <SectionTitle>Details</SectionTitle>
            <View style={styles.details}>
              {details.map((row, index) => (
                <DetailRow key={`${row.icon}:${row.title}`} {...row} last={index === details.length - 1} />
              ))}
            </View>
          </View>

          <SimilarSection items={similar} now={now} />
        </View>
      </Animated.ScrollView>

      <View pointerEvents="box-none" style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Animated.View pointerEvents="none" style={[styles.topBarFill, { opacity: barOpacity }]} />
        <FloatingBack />
        <Animated.Text numberOfLines={1} style={[styles.topTitle, { opacity: barOpacity }]}>
          {venue.name}
        </Animated.Text>
        <View style={styles.topSpacer} />
      </View>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Scrim from={pageFade(0)} to={pageFade(1)} height={28} style={styles.actionsFade} />
        <IconButton
          icon={venue.saved ? "bookmarkFilled" : "bookmark"}
          accessibilityLabel={saveLabel}
          selected={!!venue.saved}
          disabled={saving}
          color={venue.saved ? colors.accent : colors.fg}
          size={ACTION_HEIGHT}
          onPress={() => void toggleSave({ kind: venue.kind, id: venue.id, type: "want" })}
        />
        {isEvent ? (
          <Button
            title={goingLabel}
            accessibilityLabel={goingLabel}
            accessibilityState={{ selected: !!venue.going, disabled: goingPending }}
            variant="secondary"
            icon={venue.going ? "check" : undefined}
            disabled={goingPending}
            onPress={() => void toggleGoing({ kind: venue.kind, id: venue.id, type: "going" })}
            style={styles.going}
          />
        ) : null}
        <Button
          title={rankLabel}
          accessibilityLabel={rankLabel}
          onPress={() => router.push(ratePath(venue.kind, venue.id))}
          style={styles.rank}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.6 },

  topShade: { position: "absolute", top: 0, left: 0, right: 0 },
  heroFade: { position: "absolute", left: 0, right: 0, bottom: 0 },
  // The photographer's credit, level with the back button, clear of the name.
  credit: { position: "absolute", right: 16, maxWidth: "62%", color: "rgba(255, 255, 255, 0.72)", fontSize: 11, lineHeight: 15 },
  heroText: { position: "absolute", left: GUTTER, right: GUTTER, bottom: 4, gap: 6 },
  kindLine: { color: palette.onPhotoMuted, fontSize: 14, lineHeight: 19, fontWeight: fontWeight.semibold },
  name: {
    color: colors.white,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -1,
    // Holds the name together over a busy poster.
    textShadowColor: "rgba(0, 0, 0, 0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 14,
  },
  nameMedium: { fontSize: 30, lineHeight: 34, letterSpacing: -0.7 },
  nameSmall: { fontSize: 24, lineHeight: 29, letterSpacing: -0.4 },
  when: { color: colors.white, fontSize: 15, lineHeight: 21, fontWeight: fontWeight.semibold, marginTop: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.low },
  statusOpen: { backgroundColor: colors.ok },
  status: { color: colors.muted, fontSize: 15, lineHeight: 21, fontWeight: fontWeight.medium },
  statusOpenText: { color: colors.fg },

  body: { paddingHorizontal: GUTTER, paddingTop: spacing.xl, gap: 36 },
  lead: { gap: spacing.lg },
  fact: { flexDirection: "row", alignItems: "center", gap: 14 },
  factText: { flex: 1, gap: 3 },
  why: { fontSize: 18, lineHeight: 24, fontWeight: fontWeight.semibold, letterSpacing: -0.2 },
  proof: { fontSize: 14, lineHeight: 19 },
  mine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.hairline,
  },
  mineText: { flex: 1, fontSize: 15, lineHeight: 21 },
  mineScore: { color: colors.accent, fontSize: 20, lineHeight: 24, fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
  blurb: { fontSize: 16, lineHeight: 25 },
  tags: { fontSize: 14, lineHeight: 20, marginTop: -spacing.sm },
  details: { marginTop: spacing.xs },

  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  topBarFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.glass,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: { flex: 1, color: colors.fg, fontSize: 16, lineHeight: 21, fontWeight: fontWeight.semibold, textAlign: "center" },
  topSpacer: { width: 40 },

  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 6,
    backgroundColor: colors.bg,
  },
  actionsFade: { top: -28, bottom: undefined },
  going: { width: "auto", minHeight: ACTION_HEIGHT, paddingHorizontal: spacing.lg },
  rank: { flex: 1, width: "auto", minHeight: ACTION_HEIGHT },

  loadingBody: { paddingHorizontal: GUTTER, paddingTop: spacing.xl, gap: spacing.lg },
  loadingFact: { flexDirection: "row", alignItems: "center", gap: 14 },
  loadingLines: { flex: 1, gap: spacing.sm },
  loadingBack: { position: "absolute", left: 14 },
});
