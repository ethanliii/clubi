import { useQuery } from "convex/react";
import { router, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { useDemoLocation } from "../lib/demoLocation";
import {
  comparePath, paths, performerPath, planPath, postPath, ratePath, signInPath, tripPath, userPath, venuePath,
} from "../lib/links";
import { setOverlord, useOverlord } from "../lib/overlord";
import { colors } from "../theme";

type Row = { label: string; href?: Href; note?: string };

/** Every page in the app on one list, with real ids filled in from the backend. Testing only. */
export default function OverlordScreen() {
  const insets = useSafeAreaInsets();
  const overlord = useOverlord();
  const { lat, lng } = useDemoLocation();
  const me = useQuery(api.users.me);
  const signedIn = me !== undefined && me !== null;
  const nearby = useQuery(api.discover.nearby, { lat, lng, limit: 40 });
  const feed = useQuery(api.posts.friendsFeed, signedIn ? {} : "skip");
  const friends = useQuery(api.friends.list, signedIn ? {} : "skip");
  const trips = useQuery(api.trips.list, signedIn ? {} : "skip");
  const performers = useQuery(api.performers.search, { text: "the" });

  const place = nearby?.items.find((item) => item.kind === "place");
  const event = nearby?.items.find((item) => item.kind === "event");
  const friend = friends?.friends[0];
  const post = feed?.[0];
  const trip = trips?.[0];
  const performer = performers?.[0];
  const missing = (what: string) => (signedIn ? `no ${what} yet` : "sign in first");

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: "Tabs",
      rows: [
        { label: "Home / Tonight", href: paths.home },
        { label: "Map", href: paths.map },
        { label: "Rate: pick a spot", href: paths.rate },
        { label: "Feed", href: paths.feed },
        { label: "Profile", href: paths.profile },
      ],
    },
    {
      title: "Places and ranking",
      rows: [
        { label: `Place page${place ? `: ${place.name}` : ""}`, href: place && venuePath("place", place.id), note: "loading a place" },
        { label: `Event page${event ? `: ${event.name}` : ""}`, href: event && venuePath("event", event.id), note: "no event nearby" },
        { label: `Rank flow${place ? `: ${place.name}` : ""}`, href: place && ratePath("place", place.id), note: "loading a place" },
        { label: "My rankings", href: paths.rankings },
        { label: "Saved", href: paths.saved },
      ],
    },
    {
      title: "People",
      rows: [
        { label: "Friends", href: paths.friends },
        { label: `Friend profile${friend ? `: ${friend.displayName}` : ""}`, href: friend && userPath(friend.userId), note: missing("friends") },
        { label: `Compare tastes${friend ? `: ${friend.displayName}` : ""}`, href: friend && comparePath(friend.userId), note: missing("friends") },
        { label: `Post page${post ? `: ${post.target.name}` : ""}`, href: post && postPath(post.postId), note: missing("posts") },
        { label: "Notifications", href: paths.notifications },
      ],
    },
    {
      title: "Groups and artists",
      rows: [
        { label: "Trips", href: paths.trips },
        { label: `Trip page${trip ? `: ${trip.name}` : ""}`, href: trip && tripPath(trip.tripId), note: missing("trips") },
        { label: "Plan my night", href: planPath() },
        { label: `Plan the night for a trip${trip ? `: ${trip.name}` : ""}`, href: trip && planPath(trip.tripId), note: missing("trips") },
        { label: "Following", href: paths.following },
        { label: `Performer page${performer ? `: ${performer.name}` : ""}`, href: performer && performerPath(performer.performerId), note: "no performer found" },
      ],
    },
    {
      title: "Account and onboarding",
      rows: [
        { label: "Settings", href: paths.settings },
        { label: "Welcome", href: paths.welcome },
        { label: "Sign up", href: signInPath("signup") },
        { label: "Sign in", href: signInPath("signin") },
        { label: "Taste quiz", href: paths.quiz },
        { label: "Taste card", href: paths.tasteCard },
        { label: "Page not found", href: "/this-page-does-not-exist" as Href },
      ],
    },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
    >
      <Text style={styles.title}>Overlord</Text>
      <Text style={styles.sub}>
        Every page in the app. {signedIn ? `Signed in as ${me.username}.` : "Not signed in: pages that need an account will be empty."}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={overlord ? "Lock screens again" : "Unlock every screen"}
        onPress={() => setOverlord(!overlord)}
        style={[styles.toggle, overlord && styles.toggleOn]}
      >
        <Text style={styles.toggleText}>{overlord ? "Every screen is unlocked · tap to lock again" : "Unlock every screen"}</Text>
      </Pressable>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.rows.map((row) => {
            const href = row.href;
            return (
              <Pressable
                key={row.label}
                accessibilityRole="button"
                accessibilityLabel={`Open ${row.label}`}
                disabled={href === undefined}
                onPress={() => {
                  setOverlord(true);
                  if (href !== undefined) router.push(href);
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed, href === undefined && styles.rowOff]}
              >
                <Text style={styles.rowText} numberOfLines={1}>{row.label}</Text>
                <Text style={styles.rowNote}>{href === undefined ? (row.note ?? "") : "›"}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.fg, fontSize: 30, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  toggle: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  toggleOn: { borderColor: colors.accent },
  toggleText: { color: colors.fg, fontSize: 15, fontWeight: "600", textAlign: "center" },
  section: { marginTop: 26 },
  sectionTitle: { color: colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
    paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  rowPressed: { opacity: 0.6 },
  rowOff: { opacity: 0.45 },
  rowText: { color: colors.fg, fontSize: 16, flexShrink: 1 },
  rowNote: { color: colors.muted, fontSize: 14 },
});
