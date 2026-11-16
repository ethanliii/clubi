import { router, type Href } from "expo-router";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState, Icon, Text, type IconName } from "../../components";
import { CardRow, SectionLabel } from "../../features/home/CardRow";
import { SearchField } from "../../features/home/SearchField";
import { api } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { paths, planPath } from "../../lib/links";
import { useKeptQuery } from "../../lib/useKeptQuery";
import { useNow } from "../../lib/useNow";
import { colors, fontWeight, palette } from "../../theme";

/** The screen's side padding. Carousels run through it to both edges. */
const GUTTER = 16;
/** The title's bold serif, the same face as the wordmark on the Feed tab. */
const SERIF = Platform.select({ android: "serif", default: "Georgia" });

type Way = { key: string; icon: IconName; title: string; body: string; href: Href };

/** The ways in to planning: each opens its own screen. */
const WAYS: Way[] = [
  { key: "plan", icon: "navigate", title: "Plan my night", body: "A route for tonight, built from your taste", href: planPath() },
  { key: "trips", icon: "calendar", title: "Plans with friends", body: "Pick a night and a place together", href: paths.trips },
  { key: "group", icon: "map", title: "Group map", body: "Where your friends would all like to go", href: paths.groupMap },
  { key: "saved", icon: "bookmark", title: "Saved", body: "Places and events you kept for later", href: paths.saved },
];

/**
 * The "For you" tab: everything the app recommends. Photo carousels of what suits you tonight,
 * tonight's events, what is coming up and where friends go (`discover.tonight`, `discover.upcoming`),
 * then the ways in to Plan my night, Plans with friends, the group map and Saved.
 * Friends' posts are not here: they are the Feed, the first tab.
 */
export default function ForYou() {
  const { lat, lng, ready } = useDemoLocation();
  const tonight = useKeptQuery(api.discover.tonight, ready ? { lat, lng } : "skip", "tonight");
  const upcoming = useKeptQuery(api.discover.upcoming, ready ? { lat, lng } : "skip", "upcoming");
  const now = useNow();

  const nothingNearby =
    tonight !== undefined &&
    upcoming !== undefined &&
    tonight.topPicks.length + tonight.friendsGoing.length + tonight.events.length + upcoming.length === 0;
  const openMap = () => router.push(paths.map);
  // The Map tab's search field takes the keyboard each time this number changes.
  const openSearch = () => router.push(`/map?search=${Date.now()}` as Href);
  // "Events tonight" leaves out what "Top picks" already shows, so the two rows are never the same cards.
  const picked = new Set((tonight?.topPicks ?? []).map((item) => `${item.kind}:${item.id}`));
  const eventsTonight = (tonight?.events ?? []).filter((item) => !picked.has(`${item.kind}:${item.id}`));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            For you
          </Text>
        </View>

        <SearchField label="Search places and events" onPress={openSearch} />

        {nothingNearby ? (
          <EmptyState icon="map" title="Nothing nearby yet. Try the map." actionLabel="Open map" onAction={openMap} />
        ) : (
          <>
            {tonight === undefined || tonight.topPicks.length > 0 ? (
              <View style={styles.section}>
                <CardRow
                  title="Top picks for you"
                  items={tonight?.topPicks}
                  gutter={GUTTER}
                  now={now}
                  moreLabel="See top picks on the map"
                  onMore={openMap}
                />
              </View>
            ) : null}
            {eventsTonight.length > 0 ? (
              <View style={styles.section}>
                <CardRow
                  title="Events tonight"
                  items={eventsTonight}
                  gutter={GUTTER}
                  now={now}
                  moreLabel="See tonight's events on the map"
                  onMore={openMap}
                />
              </View>
            ) : null}
            {upcoming !== undefined && upcoming.length > 0 ? (
              <View style={styles.section}>
                <CardRow
                  title="Coming up for you"
                  items={upcoming}
                  gutter={GUTTER}
                  now={now}
                  moreLabel="See upcoming events on the map"
                  onMore={openMap}
                />
              </View>
            ) : null}
            {tonight !== undefined && tonight.friendsGoing.length > 0 ? (
              <View style={styles.section}>
                <CardRow
                  title="Where friends go"
                  items={tonight.friendsGoing}
                  gutter={GUTTER}
                  now={now}
                  moreLabel="See where the group should go on the map"
                  onMore={() => router.push(paths.groupMap)}
                />
              </View>
            ) : null}
          </>
        )}

        <View style={styles.section}>
          <SectionLabel title="Make a plan" />
          {WAYS.map((way, index) => (
            <Pressable
              key={way.key}
              accessibilityRole="button"
              accessibilityLabel={way.title}
              onPress={() => router.push(way.href)}
              style={({ pressed }) => [styles.way, index > 0 && styles.wayLine, pressed && styles.pressed]}
            >
              <View style={styles.wayIcon}>
                <Icon name={way.icon} size={18} color={colors.fg} />
              </View>
              <View style={styles.wayText}>
                <Text numberOfLines={1} style={styles.wayTitle}>
                  {way.title}
                </Text>
                <Text numberOfLines={1} style={styles.wayBody}>
                  {way.body}
                </Text>
              </View>
              <Icon name="chevron" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: GUTTER, paddingTop: 2, paddingBottom: 32 },
  header: { flexDirection: "row", alignItems: "center", height: 52 },
  title: { fontFamily: SERIF, fontSize: 28, lineHeight: 36, fontWeight: fontWeight.bold, letterSpacing: -0.6, color: colors.fg },
  section: { marginTop: 8 },
  pressed: { opacity: 0.6 },
  way: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  wayLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  wayIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.field, alignItems: "center", justifyContent: "center" },
  wayText: { flex: 1, gap: 2 },
  wayTitle: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold, color: colors.fg },
  wayBody: { fontSize: 13, lineHeight: 18, color: colors.muted },
});
