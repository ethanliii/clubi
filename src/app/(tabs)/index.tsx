import { useQuery } from "convex/react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState, Icon, IconButton, Text } from "../../components";
import { CardRow } from "../../features/home/CardRow";
import { SearchField } from "../../features/home/SearchField";
import { Shortcuts } from "../../features/home/Shortcuts";
import { api } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { paths, planPath } from "../../lib/links";
import { useKeptQuery } from "../../lib/useKeptQuery";
import { useNow } from "../../lib/useNow";
import { colors, fontWeight } from "../../theme";

/** The backend caps the count at 99; at the cap there may be more. */
const UNREAD_CAP = 99;
/** The screen's side padding. Rows of cards run through it to both edges. */
const GUTTER = 16;

export default function Home() {
  const { lat, lng, ready } = useDemoLocation();
  const tonight = useKeptQuery(api.discover.tonight, ready ? { lat, lng } : "skip", "tonight");
  const upcoming = useKeptQuery(api.discover.upcoming, ready ? { lat, lng } : "skip", "upcoming");
  const unread = useQuery(api.notifications.unreadCount, {});
  const now = useNow();

  const today = new Date(now).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const badge = unread ? (unread >= UNREAD_CAP ? `${UNREAD_CAP}+` : String(unread)) : null;
  const nothing =
    tonight !== undefined &&
    upcoming !== undefined &&
    tonight.topPicks.length + tonight.friendsGoing.length + tonight.events.length + upcoming.length === 0;
  const openMap = () => router.push(paths.map);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Near you. Open the map"
            onPress={openMap}
            style={({ pressed }) => [styles.flex, styles.place, pressed && styles.pressed]}
          >
            <View style={styles.where}>
              <Icon name="navigate" size={15} color={colors.accent} />
              <Text numberOfLines={1} style={styles.heading}>
                Near you
              </Text>
              <Icon name="chevronDown" size={16} color={colors.fg} />
            </View>
            <Text numberOfLines={1} style={styles.date}>
              Tonight · {today}
            </Text>
          </Pressable>
          <IconButton
            icon="bell"
            size={44}
            accessibilityLabel="Notifications"
            badge={badge}
            onPress={() => router.push(paths.notifications)}
          />
        </View>

        <SearchField label="Search places and events" onPress={openMap} />

        <Shortcuts
          gutter={GUTTER}
          onPlan={() => router.push(planPath())}
          onSaved={() => router.push(paths.saved)}
          onTrips={() => router.push(paths.trips)}
          onRankings={() => router.push(paths.rankings)}
        />

        {nothing ? (
          <EmptyState
            icon="map"
            title="Nothing nearby yet. Try the map."
            actionLabel="Open map"
            onAction={openMap}
          />
        ) : (
          <View style={styles.rows}>
            <CardRow
              title="Top picks for you"
              items={tonight?.topPicks}
              shape="large"
              gutter={GUTTER}
              now={now}
              moreLabel="See top picks on the map"
              onMore={openMap}
            />
            <CardRow
              title="Where friends go"
              items={tonight?.friendsGoing}
              gutter={GUTTER}
              now={now}
              moreLabel="See what friends ranked in the feed"
              onMore={() => router.push(paths.feed)}
            />
            <CardRow
              title="Events tonight"
              items={tonight?.events}
              gutter={GUTTER}
              now={now}
              moreLabel="See tonight's events on the map"
              onMore={openMap}
            />
            <CardRow
              title="Coming up for you"
              items={upcoming}
              gutter={GUTTER}
              now={now}
              moreLabel="See upcoming events on the map"
              onMore={openMap}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 32, gap: 10 },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 },
  place: { minHeight: 44, justifyContent: "center" },
  pressed: { opacity: 0.6 },
  where: { flexDirection: "row", alignItems: "center", gap: 6 },
  date: { fontSize: 13, lineHeight: 18, color: colors.muted },
  heading: { flexShrink: 1, fontSize: 18, lineHeight: 24, fontWeight: fontWeight.bold, letterSpacing: -0.3, color: colors.fg },
  rows: { gap: 26, marginTop: 10 },
});
