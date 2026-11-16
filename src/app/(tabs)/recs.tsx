import { router, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState, ScoreBadge, Text } from "../../components";
import { CardRow, SectionLabel } from "../../features/home/CardRow";
import { cardFacts, cardLabel, displayName, friendsLine } from "../../features/home/itemText";
import { Photo } from "../../features/home/Photo";
import { Pills } from "../../features/home/Pills";
import { SearchField } from "../../features/home/SearchField";
import { api, type NearbyItem } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { paths, planPath, venuePath } from "../../lib/links";
import { useKeptQuery } from "../../lib/useKeptQuery";
import { useNearby } from "../../lib/useNearby";
import { useNow } from "../../lib/useNow";
import { colors, fontWeight } from "../../theme";

/** The screen's side padding. Carousels run through it to both edges. */
const GUTTER = 16;
/** The most cards a sideways row holds, and the most rows a list holds. */
const ROW_MAX = 10;
const HERO_MAX = 4;
const LIST_MAX = 5;
/** How many places the "Places for you" list and each by-kind row recommend. */
const PLACES_MAX = 12;
const KIND_ROW_MAX = 14;
/** Asked of the backend per list: more than is shown, since a section leaves out what one above it has. */
const ASKED = 40;
const THUMB = 56;

const keyOf = (item: NearbyItem) => `${item.kind}:${item.id}`;

/**
 * The "For you" tab: everything the app recommends, each section in its own shape. A paged row of
 * wide cards for the top picks, a plain list of places, small carousels for tonight's events and
 * what is coming up, and a list of where friends go (`discover.tonight`, `discover.upcoming`).
 * Friends' posts are not here: they are the Feed, the first tab.
 */
export default function ForYou() {
  const { lat, lng, ready } = useDemoLocation();
  const tonight = useKeptQuery(api.discover.tonight, ready ? { lat, lng } : "skip", "tonight");
  const upcoming = useKeptQuery(api.discover.upcoming, ready ? { lat, lng } : "skip", "upcoming");
  // The recommendations themselves, ranked for this person: everything nearby, then by kind.
  const forYou = useNearby("all", ASKED);
  const bars = useNearby("bars", ASKED);
  const food = useNearby("food", ASKED);
  const outdoors = useNearby("outdoors", ASKED);
  const now = useNow();

  const nothingNearby =
    tonight !== undefined &&
    upcoming !== undefined &&
    tonight.topPicks.length + tonight.friendsGoing.length + tonight.events.length + upcoming.length === 0;
  const openMap = () => router.push(paths.map);
  // The Map tab's search field takes the keyboard each time this number changes.
  const openSearch = () => router.push(`/map?search=${Date.now()}` as Href);

  // Each section leaves out what a section above it already shows, so no card appears twice.
  const seen = new Set<string>();
  const take = (items: NearbyItem[], max: number) => {
    const fresh: NearbyItem[] = [];
    for (const item of items) {
      if (fresh.length === max) break;
      if (seen.has(keyOf(item))) continue;
      seen.add(keyOf(item));
      fresh.push(item);
    }
    return fresh;
  };
  const hero = tonight ? take(tonight.topPicks, HERO_MAX) : undefined;
  const rest = tonight ? [...tonight.topPicks, ...tonight.events] : [];
  const placesOf = (list: { items: NearbyItem[] } | undefined) => (list?.items ?? []).filter((item) => item.kind === "place");
  const places = take([...rest.filter((item) => item.kind === "place"), ...placesOf(forYou)], PLACES_MAX);
  const barRow = take(placesOf(bars), KIND_ROW_MAX);
  const foodRow = take(placesOf(food), KIND_ROW_MAX);
  const outdoorRow = take(placesOf(outdoors), KIND_ROW_MAX);
  let eventsTonight = take(rest.filter((item) => item.kind === "event"), ROW_MAX);
  // One card is not a row: a lone event goes back in the pool, so "Coming up" can show it.
  if (eventsTonight.length === 1) {
    seen.delete(keyOf(eventsTonight[0]));
    eventsTonight = [];
  }
  const comingUp = take(upcoming ?? [], ROW_MAX);
  const friendsGo = (tonight?.friendsGoing ?? []).filter((item) => item.friends.length > 0).slice(0, LIST_MAX);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Search
          </Text>
        </View>

        <SearchField label="Search places and events" onPress={openSearch} />
        <View style={styles.pills}>
          <Pills
            gutter={GUTTER}
            pills={[
              { key: "plan", label: "Plan my night", icon: "navigate", onPress: () => router.push(planPath()) },
              { key: "trips", label: "With friends", icon: "users", onPress: () => router.push(paths.trips) },
              { key: "group", label: "Group map", icon: "map", onPress: () => router.push(paths.groupMap) },
              { key: "saved", label: "Saved", icon: "bookmark", onPress: () => router.push(paths.saved) },
            ]}
          />
        </View>

        {nothingNearby ? (
          <EmptyState icon="map" title="Nothing nearby yet. Try the map." actionLabel="Open map" onAction={openMap} />
        ) : (
          <>
            <CardRow large title="Top picks for you" items={hero} gutter={GUTTER} now={now} moreLabel="See top picks on the map" onMore={openMap} />

            {places.length > 0 ? (
              <View style={styles.section}>
                <SectionLabel title="Places for you" moreLabel="See places on the map" onMore={openMap} />
                {places.map((item, index) => (
                  <PlaceRow key={keyOf(item)} item={item} line={item.why} first={index === 0} now={now} />
                ))}
              </View>
            ) : null}

            {barRow.length > 1 ? (
              <View style={styles.section}>
                <CardRow title="Bars and clubs for you" items={barRow} gutter={GUTTER} now={now} moreLabel="See bars on the map" onMore={openMap} />
              </View>
            ) : null}

            {foodRow.length > 1 ? (
              <View style={styles.section}>
                <CardRow title="Food for you" items={foodRow} gutter={GUTTER} now={now} moreLabel="See food on the map" onMore={openMap} />
              </View>
            ) : null}

            {eventsTonight.length > 0 ? (
              <View style={styles.section}>
                <CardRow title="Events tonight" items={eventsTonight} gutter={GUTTER} now={now} moreLabel="See tonight's events on the map" onMore={openMap} />
              </View>
            ) : null}

            {friendsGo.length > 0 ? (
              <View style={styles.section}>
                <SectionLabel
                  title="Where friends go"
                  moreLabel="See where the group should go on the map"
                  onMore={() => router.push(paths.groupMap)}
                />
                {friendsGo.map((item, index) => (
                  <PlaceRow key={keyOf(item)} item={item} line={friendsLine(item)} first={index === 0} now={now} />
                ))}
              </View>
            ) : null}

            {outdoorRow.length > 1 ? (
              <View style={styles.section}>
                <CardRow title="Outdoors for you" items={outdoorRow} gutter={GUTTER} now={now} moreLabel="See outdoor spots on the map" onMore={openMap} />
              </View>
            ) : null}

            {comingUp.length > 0 ? (
              <View style={styles.section}>
                <CardRow title="Coming up" items={comingUp} gutter={GUTTER} now={now} moreLabel="See upcoming events on the map" onMore={openMap} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** One place in a list: a small photo, the name in bold, two grey lines and the score for you in a thin ring. */
function PlaceRow({ item, line, first, now }: { item: NearbyItem; line: string; first: boolean; now: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cardLabel(item)}
      onPress={() => router.push(venuePath(item.kind, item.id))}
      style={({ pressed }) => [styles.row, !first && styles.rowLine, pressed && styles.pressed]}
    >
      <Photo item={item} width={THUMB} height={THUMB} round={8} dark glyph={22} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={styles.rowName}>
          {displayName(item.name)}
        </Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {cardFacts(item, now)}
        </Text>
        {line !== "" ? (
          <Text numberOfLines={1} style={styles.rowMeta}>
            {line}
          </Text>
        ) : null}
      </View>
      <ScoreBadge score={item.score} size="md" style={styles.rowScore} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: GUTTER, paddingTop: 2, paddingBottom: 32 },
  header: { flexDirection: "row", alignItems: "center", height: 48 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: fontWeight.bold, letterSpacing: -0.5, color: colors.fg },
  pills: { marginTop: 6, marginBottom: 2 },
  section: { marginTop: 12 },
  pressed: { opacity: 0.6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowText: { flex: 1, gap: 1 },
  rowName: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: colors.fg },
  rowMeta: { fontSize: 13, lineHeight: 18, color: colors.muted },
  rowScore: { alignSelf: "center" },
});
