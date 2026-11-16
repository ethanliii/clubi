import { useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, EmptyState, Header, Icon, ScoreBadge, Screen, Skeleton, Text, goBack, type IconName } from "../../components";
import { api, type Id, type Kind, type Source, type VenueDetail } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { useKeptQuery } from "../../lib/useKeptQuery";
import { categoryLabel, formatClock, formatDistance, formatPrice, formatScore, pluralize } from "../../lib/format";
import { directionsUrl, openUrl, ratePath } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { useNow } from "../../lib/useNow";
import { colors, fontWeight, palette, spacing } from "../../theme";
import { DetailRow, GUTTER, Photo, SectionTitle, displayName, eventDateLine, hoursLines, streetAddress } from "./parts";
import { BreakdownSection, FriendsSection, InsightsSection, PerformersSection, PhotosSection, SimilarSection } from "./sections";

/** "View on …" for the event sources that have a page worth opening (docs/UI-SPEC.md section 5). */
const SOURCE_NAMES: Partial<Record<Source, string>> = {
  luma: "Luma",
  partiful: "Partiful",
  ticketmaster: "Ticketmaster",
  eventbrite: "Eventbrite",
};

/** The photo header: tall when there is a real photo to show, shorter for the category look. */
const HERO_WITH_PHOTO = 280;
const HERO_PLAIN = 220;
/** With no picture there is no hero: just the row the back and save buttons sit in. */
const BAR_ROW = 56;
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
          <Skeleton width={54} height={54} round={27} />
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

/** A round white button that floats over the photo: back on the left, save on the right. */
function RoundButton({
  icon,
  label,
  color = colors.fg,
  selected,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  color?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}
    >
      <Icon name={icon} size={20} color={color} />
    </Pressable>
  );
}

function FloatingBack() {
  return <RoundButton icon="back" label="Back" onPress={goBack} />;
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
  const { width } = useWindowDimensions();
  const [scrollY] = useState(() => new Animated.Value(0));
  const { run: toggleSave, pending: saving } = useMutationToast(api.saves.toggle);
  const { run: toggleGoing, pending: goingPending } = useMutationToast(api.saves.toggle);
  const isEvent = venue.kind === "event";

  const hasPhoto = !!venue.imageUrl;
  // An event's picture is a 2:1 flyer: the hero takes that shape so its lettering is not cropped.
  const heroHeight = !hasPhoto ? insets.top + BAR_ROW : isEvent ? Math.round(Math.min(width, 520) / 2) + insets.top : HERO_WITH_PHOTO;
  // The bar under the back button fades in once the name has scrolled away beneath it.
  const barOpacity = scrollY.interpolate({
    inputRange: hasPhoto ? [heroHeight - insets.top - 90, heroHeight - insets.top - 40] : [8, 48],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const kindLine = [categoryLabel(venue.category, venue.subcategory), formatPrice(venue.priceLevel)]
    .filter((part) => part !== "")
    .join(" · ");
  const distance = hasDistance ? formatDistance(venue.distanceMeters) : "";
  const openLabel = isEvent ? "" : venue.openNow === true ? "Open now" : venue.openNow === false ? "Closed now" : "";
  const when = isEvent && venue.startsAt !== undefined ? `${eventDateLine(venue.startsAt, now)} · ${formatClock(venue.startsAt)}` : "";
  const started = isEvent && venue.startsAt !== undefined && venue.startsAt <= now;
  // "On now" is the backend's word: it is lifted from the reason line up to the date so it is said once.
  const onNow = isEvent && /·\s*On now\s*$/i.test(venue.why);
  const name = displayName(venue.name);
  const nameSize = name.length > 34 ? styles.nameSmall : name.length > 20 ? styles.nameMedium : null;

  const rankLabel = venue.myRanking ? "Rank again" : isEvent ? "Rank this event" : "Rank this place";
  // Before an event starts, going is the thing to do; once it has started, ranking is.
  const goingFirst = isEvent && !started;
  const saveLabel = venue.saved ? "Saved" : "Save";
  const goingLabel = venue.going ? "Going" : "I'm going";
  const sourceName = venue.source ? SOURCE_NAMES[venue.source] : undefined;
  const ticketLabel = sourceName ? `Tickets on ${sourceName}` : "Get tickets";
  const sourceLabel = sourceName ? `View on ${sourceName}` : undefined;
  const hours = venue.hours ? hoursLines(venue.hours) : [];
  const { ticketUrl, sourceUrl, website } = venue;
  // The heading already says whether it is open, so the reason line does not repeat it.
  const why =
    openLabel === "Open now" || onNow ? venue.why.replace(/\s*·\s*(Open|On) now\s*$/i, "") || venue.why : venue.why;
  // The tags the heading and the blurb have not already said ("Bakery" under a bakery's name adds nothing).
  // An imported blurb that is only the date ("Sunday, November 15") repeats the line under the name.
  const blurb = venue.blurb && !/^\s*(mon|tues|wednes|thurs|fri|satur|sun)day,?\s+[a-z]+\.?\s+\d{1,2}(,?\s+\d{4})?\s*$/i.test(venue.blurb) ? venue.blurb : undefined;
  const blurbText = (blurb ?? "").toLowerCase();
  const kindWords = [venue.category, venue.subcategory ?? ""].map((word) => word.replace(/_/g, " ").toLowerCase());
  const tags = venue.tags
    .map((tag) => tag.replace(/_/g, " "))
    .filter((tag) => !kindWords.includes(tag.toLowerCase()) && !blurbText.includes(tag.toLowerCase()))
    .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1));
  const socialProof = [
    `${venue.matchPct}% match for you`,
    venue.ratingCount !== undefined && venue.ratingCount > 0 ? `${pluralize(venue.ratingCount, "ranking")} on Vioma` : "",
  ].filter((part) => part !== "");

  // The details list, top to bottom. Built first so the last line can drop its divider.
  const details: React.ComponentProps<typeof DetailRow>[] = [
    {
      icon: "navigate" as const,
      title: venue.address ? streetAddress(venue.address) : "Directions",
      subtitle: distance ? `${distance} away` : undefined,
      accessibilityLabel: "Directions",
      onPress: () => void openUrl(directionsUrl(venue.lat, venue.lng, venue.name)),
    },
    ...(venue.hours
      ? [{ icon: "clock" as const, title: hours[0] ?? venue.hours, subtitle: hours.slice(1).join("\n") || undefined }]
      : []),
    ...(ticketUrl
      ? [{ icon: "ticket" as const, title: ticketLabel, accessibilityLabel: ticketLabel, onPress: () => void openUrl(ticketUrl) }]
      : []),
    ...(!ticketUrl && sourceUrl && sourceLabel
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

  const metaParts = [kindLine, distance].filter((part) => part !== "");
  const save = (
    <RoundButton
      icon={venue.saved ? "bookmarkFilled" : "bookmark"}
      label={saveLabel}
      selected={!!venue.saved}
      disabled={saving}
      color={venue.saved ? colors.accent : colors.fg}
      onPress={() => void toggleSave({ kind: venue.kind, id: venue.id, type: "want" })}
    />
  );

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: Platform.OS !== "web",
        })}
        contentContainerStyle={{ paddingBottom: ACTION_HEIGHT + Math.max(insets.bottom, 14) + 40 }}
      >
        {hasPhoto ? (
          <View style={{ height: heroHeight }}>
            <Photo uri={venue.imageUrl} category={venue.category} height={heroHeight} label={`Photo of ${name}`} />
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(0, 0, 0, 0.45)", "rgba(0, 0, 0, 0)"]}
              style={[styles.topShade, { height: insets.top + 72 }]}
            />
          </View>
        ) : (
          <View style={{ height: heroHeight }} />
        )}

        <View style={[styles.body, !hasPhoto && styles.bodyPlain]}>
          <View style={styles.top}>
            <View style={styles.titleRow}>
              <View style={styles.heading}>
                <Text accessibilityRole="header" numberOfLines={2} style={[styles.name, nameSize]}>
                  {name}
                </Text>
                {metaParts.length > 0 || openLabel ? (
                  <Text style={styles.meta}>
                    {metaParts.join(" · ")}
                    {openLabel ? (
                      <Text style={[styles.meta, venue.openNow ? styles.metaOpen : null]}>
                        {metaParts.length > 0 ? ` · ${openLabel}` : openLabel}
                      </Text>
                    ) : null}
                  </Text>
                ) : null}
                {when ? (
                  <Text style={styles.when}>
                    {when}
                    {onNow ? <Text style={[styles.when, styles.metaOpen]}> · On now</Text> : null}
                  </Text>
                ) : null}
              </View>
              <View style={styles.scoreCol}>
                <ScoreBadge score={venue.score} size="lg" />
                <Text style={styles.scoreCaption}>for you</Text>
              </View>
            </View>
            <View style={styles.reason}>
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
              <View style={styles.factText}>
                <Text style={styles.mineText}>{`Your rank: #${venue.myRanking.position} of ${venue.myRanking.outOf}`}</Text>
                <Text muted style={styles.proof}>
                  Your score
                </Text>
              </View>
              <ScoreBadge score={venue.myRanking.score} />
            </View>
          ) : null}

          {blurb || tags.length > 0 ? (
            <View style={styles.about}>
              {blurb ? <Text style={styles.blurb}>{blurb}</Text> : null}
              {tags.length > 0 ? (
                <View style={styles.pills}>
                  {tags.slice(0, 8).map((tag) => (
                    <View key={tag} style={styles.pill}>
                      <Text style={styles.pillText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          <FriendsSection venue={venue} now={now} />

          <PhotosSection venue={venue} />

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

          <SimilarSection items={similar} now={now} eventsFirst={isEvent} />

          {hasPhoto && venue.imageAttribution ? (
            <Text numberOfLines={1} style={styles.creditText}>
              {venue.imageAttribution}
            </Text>
          ) : null}
        </View>
      </Animated.ScrollView>

      <View pointerEvents="box-none" style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Animated.View pointerEvents="none" style={[styles.topBarFill, { opacity: barOpacity }]} />
        <FloatingBack />
        <Animated.Text numberOfLines={1} style={[styles.topTitle, { opacity: barOpacity }]}>
          {name}
        </Animated.Text>
        {save}
      </View>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {isEvent ? (
          <Button
            title={goingLabel}
            accessibilityLabel={goingLabel}
            accessibilityState={{ selected: !!venue.going, disabled: goingPending }}
            variant={goingFirst ? "primary" : "secondary"}
            icon={venue.going ? "check" : undefined}
            disabled={goingPending}
            onPress={() => void toggleGoing({ kind: venue.kind, id: venue.id, type: "going" })}
            style={goingFirst ? styles.rank : styles.going}
          />
        ) : null}
        <Button
          title={goingFirst ? "Rank" : rankLabel}
          accessibilityLabel={rankLabel}
          variant={goingFirst ? "secondary" : "primary"}
          onPress={() => router.push(ratePath(venue.kind, venue.id))}
          style={goingFirst ? styles.side : styles.rank}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.6 },

  topShade: { position: "absolute", top: 0, left: 0, right: 0 },
  // The photographer's credit, a quiet last line of the page.
  creditText: { color: colors.low, fontSize: 11, lineHeight: 15, marginTop: -8 },

  body: { paddingHorizontal: GUTTER, paddingTop: 18, gap: 28 },
  bodyPlain: { paddingTop: 8 },
  top: { gap: 14 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  heading: { flex: 1, gap: 5 },
  reason: { gap: 2, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.hairline },
  name: { color: colors.fg, fontSize: 28, lineHeight: 33, fontWeight: "800", letterSpacing: -0.6 },
  nameMedium: { fontSize: 24, lineHeight: 29, letterSpacing: -0.4 },
  nameSmall: { fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  meta: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  metaOpen: { color: colors.ok, fontWeight: fontWeight.semibold },
  when: { color: colors.fg, fontSize: 16, lineHeight: 22, fontWeight: fontWeight.bold },

  scoreCol: { alignItems: "center", gap: 4, width: 58, paddingTop: 2 },
  scoreCaption: { color: colors.muted, fontSize: 11, lineHeight: 14, fontWeight: fontWeight.semibold },
  factText: { flex: 1, gap: 3 },
  why: { fontSize: 15, lineHeight: 21, fontWeight: fontWeight.semibold },
  proof: { fontSize: 13, lineHeight: 18 },
  mine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: -14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: palette.hairline,
  },
  mineText: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.semibold },
  about: { gap: 14, marginTop: -8 },
  blurb: { color: palette.soft, fontSize: 15, lineHeight: 23 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: "center", backgroundColor: palette.field },
  pillText: { fontSize: 13, lineHeight: 17, fontWeight: fontWeight.medium },
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
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  topTitle: { flex: 1, color: colors.fg, fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold, textAlign: "center" },

  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.hairline,
  },
  going: { width: "auto", minHeight: ACTION_HEIGHT, paddingHorizontal: spacing.lg },
  rank: { flex: 1, width: "auto", minHeight: ACTION_HEIGHT },
  side: { width: 110, minHeight: ACTION_HEIGHT },

  loadingBody: { paddingHorizontal: GUTTER, paddingTop: spacing.xl, gap: spacing.lg },
  loadingFact: { flexDirection: "row", alignItems: "center", gap: 14 },
  loadingLines: { flex: 1, gap: spacing.sm },
  loadingBack: { position: "absolute", left: 14 },
});
