import { useQuery } from "convex/react";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { EmptyState, Icon, IconButton, Screen, Text } from "../../components";
import { CardRow } from "../../features/home/CardRow";
import { QuickLink } from "../../features/home/QuickLink";
import { api } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { useKeptQuery } from "../../lib/useKeptQuery";
import { paths, planPath } from "../../lib/links";
import { useNow } from "../../lib/useNow";
import { colors, radius, spacing } from "../../theme";

/** The backend caps the count at 99; at the cap there may be more. */
const UNREAD_CAP = 99;

export default function Home() {
  const { lat, lng, ready } = useDemoLocation();
  const tonight = useKeptQuery(api.discover.tonight, ready ? { lat, lng } : "skip", "tonight");
  const upcoming = useKeptQuery(api.discover.upcoming, ready ? { lat, lng } : "skip", "upcoming");
  const unread = useQuery(api.notifications.unreadCount, {});
  const now = useNow();

  const today = new Date(now).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const badge = unread ? (unread >= UNREAD_CAP ? `${UNREAD_CAP}+` : String(unread)) : null;
  const nothing =
    tonight !== undefined &&
    upcoming !== undefined &&
    tonight.topPicks.length + tonight.friendsGoing.length + tonight.events.length + upcoming.length === 0;

  return (
    <Screen>
      <View style={styles.between}>
        <View style={styles.flex}>
          <Text variant="label">{today}</Text>
          <Text variant="heading" accessibilityRole="header">
            Tonight
          </Text>
        </View>
        <IconButton
          icon="bell"
          accessibilityLabel="Notifications"
          badge={badge}
          onPress={() => router.push(paths.notifications)}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Plan my night"
        onPress={() => router.push(planPath())}
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
      >
        <View style={styles.flex}>
          <Text variant="title">Plan my night</Text>
          <Text variant="caption" muted>
            Tell us the vibe, get a full plan
          </Text>
        </View>
        <View style={styles.bannerIcon}>
          <Icon name="spark" size={18} color={colors.white} />
        </View>
      </Pressable>

      <View style={styles.links}>
        <QuickLink label="Trips" icon="users" onPress={() => router.push(paths.trips)} />
        <QuickLink label="Saved" icon="bookmark" onPress={() => router.push(paths.saved)} />
      </View>

      {nothing ? (
        <EmptyState
          icon="map"
          title="Nothing nearby yet. Try the map."
          actionLabel="Open map"
          onAction={() => router.push(paths.map)}
        />
      ) : (
        <>
          <CardRow title="Top picks for you" items={tonight?.topPicks} cardWidth={270} />
          <CardRow title="Friends went here" items={tonight?.friendsGoing} />
          <CardRow title="Events tonight" items={tonight?.events} />
          <CardRow title="Coming up for you" items={upcoming} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  pressed: { opacity: 0.8 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.accentSoft,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  links: { flexDirection: "row", gap: spacing.md },
});
