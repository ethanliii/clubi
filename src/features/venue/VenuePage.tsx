import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  ChipRow,
  EmptyState,
  Header,
  MatchBadge,
  ScoreBadge,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonRows,
  Text,
  goBack,
} from "../../components";
import { api, type Id, type Kind, type Source, type VenueDetail } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { useKeptQuery } from "../../lib/useKeptQuery";
import { categoryLabel, formatDistance, formatEventTime, formatPrice, formatScore, pluralize } from "../../lib/format";
import { directionsUrl, openUrl, ratePath } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { useNow } from "../../lib/useNow";
import { colors, radius, ratingColor, spacing } from "../../theme";
import { FriendsSection, InsightsSection, PerformersSection, SimilarSection, VenueHero } from "./sections";

/** "View on …" for the event sources that have a page worth opening (docs/UI-SPEC.md section 5). */
const SOURCE_LABELS: Partial<Record<Source, string>> = {
  luma: "View on Luma",
  partiful: "View on Partiful",
  ticketmaster: "View on Ticketmaster",
  eventbrite: "View on Eventbrite",
};

function NotListed() {
  return (
    <Screen>
      <Header />
      <EmptyState title="This place is no longer listed" actionLabel="Back" onAction={goBack} />
    </Screen>
  );
}

function LoadingVenue() {
  return (
    <Screen>
      <Header />
      <Skeleton height={240} round={radius.xl} />
      <Skeleton height={28} width="70%" />
      <Skeleton height={14} width="50%" />
      <Skeleton height={96} round={radius.xl} />
      <Skeleton height={48} round={radius.lg} />
      <SkeletonRows count={3} />
    </Screen>
  );
}

/** One line of the details card: a muted name, then the value. */
function Fact({ label, text }: { label: string; text: string }) {
  return (
    <Text variant="caption">
      <Text variant="caption" muted>
        {`${label}  `}
      </Text>
      {text}
    </Text>
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
  const { run: toggleSave, pending: saving } = useMutationToast(api.saves.toggle);
  const { run: toggleGoing, pending: goingPending } = useMutationToast(api.saves.toggle);
  const isEvent = venue.kind === "event";

  const meta = [
    categoryLabel(venue.category, venue.subcategory),
    formatPrice(venue.priceLevel),
    isEvent ? "" : venue.openNow === true ? "Open now" : venue.openNow === false ? "Closed now" : "",
    hasDistance ? formatDistance(venue.distanceMeters) : "",
  ].filter((part) => part !== "");

  const rankLabel = venue.myRanking ? "Rank again" : isEvent ? "Rank this event" : "Rank this place";
  const saveLabel = venue.saved ? "Saved" : "Save";
  const goingLabel = venue.going ? "Going" : "I'm going";
  const sourceLabel = venue.source ? SOURCE_LABELS[venue.source] : undefined;
  const { ticketUrl, sourceUrl, website } = venue;

  const links: { label: string; onPress: () => void }[] = [
    ...(ticketUrl ? [{ label: "Get tickets", onPress: () => void openUrl(ticketUrl) }] : []),
    ...(sourceUrl && sourceLabel ? [{ label: sourceLabel, onPress: () => void openUrl(sourceUrl) }] : []),
    ...(website ? [{ label: "Website", onPress: () => void openUrl(website) }] : []),
    { label: "Directions", onPress: () => void openUrl(directionsUrl(venue.lat, venue.lng, venue.name)) },
  ];

  return (
    <Screen edges={["top", "bottom"]}>
      <Header
        right={
          <Button
            title={saveLabel}
            accessibilityLabel={saveLabel}
            accessibilityState={{ selected: !!venue.saved, disabled: saving }}
            variant="ghost"
            disabled={saving}
            onPress={() => void toggleSave({ kind: venue.kind, id: venue.id, type: "want" })}
            style={styles.saveButton}
          />
        }
      />
      <VenueHero venue={venue} />

      <View style={styles.titles}>
        <Text variant="heading" accessibilityRole="header">
          {venue.name}
        </Text>
        <Text muted>{meta.join(" · ")}</Text>
        {isEvent && venue.startsAt !== undefined ? (
          <Text style={styles.when}>{formatEventTime(venue.startsAt, now)}</Text>
        ) : null}
      </View>

      <View style={styles.scorebox}>
        <ScoreBadge score={venue.score} size="lg" />
        <View style={styles.scoreText}>
          <View style={styles.row}>
            <Text variant="label">for you</Text>
            <MatchBadge match={venue.matchPct} size="sm" />
            <Text variant="label">match</Text>
          </View>
          <Text>{venue.why}</Text>
          {venue.myRanking ? (
            <Text variant="caption" muted>
              {`You ranked it #${venue.myRanking.position} of ${venue.myRanking.outOf} · ${formatScore(venue.myRanking.score)}`}
            </Text>
          ) : null}
          {venue.ratingCount !== undefined && venue.ratingCount > 0 ? (
            <Text variant="caption" muted>
              {`${pluralize(venue.ratingCount, "ranking")} on clubi`}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.block}>
        <Button
          title={rankLabel}
          accessibilityLabel={rankLabel}
          onPress={() => router.push(ratePath(venue.kind, venue.id))}
        />
        {isEvent ? (
          <Button
            title={goingLabel}
            accessibilityLabel={goingLabel}
            accessibilityState={{ selected: !!venue.going, disabled: goingPending }}
            variant="ghost"
            disabled={goingPending}
            onPress={() => void toggleGoing({ kind: venue.kind, id: venue.id, type: "going" })}
          />
        ) : null}
        <View style={styles.links}>
          {links.map((link) => (
            <Button
              key={link.label}
              title={link.label}
              accessibilityLabel={link.label}
              variant="ghost"
              onPress={link.onPress}
              style={styles.link}
            />
          ))}
        </View>
      </View>

      {venue.blurb ? <Text>{venue.blurb}</Text> : null}

      {venue.breakdown && venue.breakdown.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Why it fits you" />
          <View style={styles.card}>
            {venue.breakdown.map((row) => (
              <View key={row.label} accessibilityLabel={`${row.label} ${row.value.toFixed(1)}`} style={styles.row}>
                <Text variant="caption" numberOfLines={1} style={styles.barLabel}>
                  {row.label}
                </Text>
                <View style={styles.bar}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.min(1, Math.max(0, row.value / 10)) * 100}%`, backgroundColor: ratingColor(row.value) },
                    ]}
                  />
                </View>
                <Text variant="caption" style={styles.barValue}>
                  {row.value.toFixed(1)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <InsightsSection insights={insights} />

      {isEvent ? <PerformersSection performers={performers} names={venue.performers} /> : null}

      <FriendsSection venue={venue} now={now} />

      {venue.address || venue.hours || venue.phone || venue.tags.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Details" />
          {venue.tags.length > 0 ? (
            <ChipRow style={styles.chips}>
              {venue.tags.map((tag) => (
                <Chip key={tag} label={tag} size="sm" />
              ))}
            </ChipRow>
          ) : null}
          {venue.address || venue.hours || venue.phone ? (
            <View style={styles.card}>
              {venue.address ? <Fact label="Address" text={venue.address} /> : null}
              {venue.hours ? <Fact label="Hours" text={venue.hours} /> : null}
              {venue.phone ? <Fact label="Phone" text={venue.phone} /> : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <SimilarSection items={similar} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titles: { gap: spacing.xs },
  block: { gap: spacing.sm },
  section: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  when: { color: colors.mid, fontWeight: "600" },
  saveButton: { width: "auto", paddingVertical: spacing.sm, paddingHorizontal: 14 },
  scorebox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  scoreText: { flex: 1, gap: spacing.xs },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  // Wide enough for the longest backend label ("Electronic music") at caption size.
  barLabel: { width: 104 },
  bar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.raised, overflow: "hidden" },
  barFill: { height: "100%" },
  barValue: { width: 28, textAlign: "right" },
  chips: { gap: 6 },
  links: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  link: { width: "auto", flexGrow: 1, flexBasis: "45%" },
});
