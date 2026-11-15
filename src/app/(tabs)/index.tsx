import { useQuery } from "convex/react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState, IconButton, Text } from "../../components";
import { CardRow } from "../../features/home/CardRow";
import { Hero, HeroSkeleton } from "../../features/home/Hero";
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
const GUTTER = 20;

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
  // The backend's first pick leads the screen; the rest of its list follows as a row, in its order.
  const lead = tonight?.topPicks[0];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.date}>{today}</Text>
            <Text accessibilityRole="header" style={styles.heading}>
              Tonight
            </Text>
          </View>
          <IconButton
            icon="bell"
            size={44}
            accessibilityLabel="Notifications"
            badge={badge}
            onPress={() => router.push(paths.notifications)}
          />
        </View>

        {tonight === undefined ? <HeroSkeleton /> : lead ? <Hero item={lead} now={now} /> : null}

        <Shortcuts
          onPlan={() => router.push(planPath())}
          onTrips={() => router.push(paths.trips)}
          onSaved={() => router.push(paths.saved)}
        />

        {nothing ? (
          <EmptyState
            icon="map"
            title="Nothing nearby yet. Try the map."
            actionLabel="Open map"
            onAction={() => router.push(paths.map)}
          />
        ) : (
          <View style={styles.rows}>
            <CardRow title="More for you" items={tonight?.topPicks.slice(1)} gutter={GUTTER} now={now} />
            <CardRow title="Where friends go" items={tonight?.friendsGoing} shape="wide" gutter={GUTTER} now={now} />
            <CardRow title="Events tonight" items={tonight?.events} shape="wide" gutter={GUTTER} now={now} />
            <CardRow title="Coming up" items={upcoming} gutter={GUTTER} now={now} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 40, gap: 16 },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 4 },
  date: { fontSize: 14, lineHeight: 19, color: colors.muted },
  heading: { fontSize: 36, lineHeight: 42, fontWeight: fontWeight.bold, letterSpacing: -1, color: colors.fg },
  rows: { gap: 36, marginTop: 20 },
});
