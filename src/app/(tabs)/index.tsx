import { useQuery } from "convex/react";
import { router, type Href } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState, IconButton, Text } from "../../components";
import { CommentsSheet } from "../../features/feed/Comments";
import { CardRow, SectionLabel } from "../../features/home/CardRow";
import { HomePost, HomePostSkeleton } from "../../features/home/HomePost";
import { Pills } from "../../features/home/Pills";
import { SearchField } from "../../features/home/SearchField";
import { api } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { paths, planPath } from "../../lib/links";
import { useKeptQuery } from "../../lib/useKeptQuery";
import { useNow } from "../../lib/useNow";
import { useMe } from "../../state/session";
import { colors, fontWeight } from "../../theme";

/** The backend caps the count at 99; at the cap there may be more. */
const UNREAD_CAP = 99;
/** The screen's side padding. Carousels run through it to both edges. */
const GUTTER = 16;
const GROUP_MAP = "/group-map" as Href;
/** How many friends' posts Home shows before "See all" opens the Feed tab. */
const HOME_POSTS = 5;
/** The wordmark's bold serif: Georgia on iOS and the web, the system serif on Android. */
const SERIF = Platform.select({ android: "serif", default: "Georgia" });

type SectionKey = "picks" | "friends" | "tonight" | "upcoming" | "feed";

/** One block of the page. It reports where it starts, so a pill can scroll to it. */
function Section({ name, onTop, children }: { name: SectionKey; onTop: (key: SectionKey, y: number) => void; children: ReactNode }) {
  return (
    <View onLayout={(event) => onTop(name, event.nativeEvent.layout.y)} style={styles.section}>
      {children}
    </View>
  );
}

export default function Home() {
  const { lat, lng, ready } = useDemoLocation();
  const tonight = useKeptQuery(api.discover.tonight, ready ? { lat, lng } : "skip", "tonight");
  const upcoming = useKeptQuery(api.discover.upcoming, ready ? { lat, lng } : "skip", "upcoming");
  const unread = useQuery(api.notifications.unreadCount, {});
  const feed = useQuery(api.posts.friendsFeed, {});
  const me = useMe();
  const now = useNow();
  const [comments, setComments] = useState<{ postId: Id<"posts"> | null; open: boolean }>({ postId: null, open: false });

  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  /** Where each section starts inside the scroll view, for the pills. */
  const tops = useRef<Partial<Record<SectionKey, number>>>({});
  const setTop = (key: SectionKey, y: number) => {
    tops.current[key] = y;
  };
  /** Scrolls to the first of these sections that is on the page. */
  const jump = (...keys: SectionKey[]) => {
    for (const key of keys) {
      const y = tops.current[key];
      if (y !== undefined) {
        scroll.current?.scrollTo({ y: Math.max(0, y - 4), animated: true });
        return;
      }
    }
  };

  const badge = unread ? (unread >= UNREAD_CAP ? `${UNREAD_CAP}+` : String(unread)) : null;
  const nothingNearby =
    tonight !== undefined &&
    upcoming !== undefined &&
    tonight.topPicks.length + tonight.friendsGoing.length + tonight.events.length + upcoming.length === 0;
  const openMap = () => router.push(paths.map);
  // The Map tab's search field takes the keyboard each time this number changes.
  const openSearch = () => router.push(`/map?search=${Date.now()}` as Href);
  const openFeed = () => router.push(paths.feed);
  const has = (items: unknown[] | undefined) => items === undefined || items.length > 0;
  // Friends' posts follow the first carousel, like the reference; with none yet, the invitation waits at the bottom.
  const feedFirst = feed !== undefined && feed.length > 0;
  const shown = (feed ?? []).slice(0, HOME_POSTS);
  // "Events tonight" leaves out what "Top picks" already shows, so the two rows are never the same cards.
  const picked = new Set((tonight?.topPicks ?? []).map((item) => `${item.kind}:${item.id}`));
  const eventsTonight = (tonight?.events ?? []).filter((item) => !picked.has(`${item.kind}:${item.id}`));
  const commentsPostIsMine =
    me !== undefined && (feed ?? []).some((post) => post.postId === comments.postId && post.author.userId === me.userId);

  const feedSection = (
    <Section name="feed" onTop={setTop}>
      <SectionLabel title="Your feed" moreLabel="See the whole feed" onMore={openFeed} />
      {feed === undefined ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.loading}>
          <HomePostSkeleton />
          <HomePostSkeleton />
        </View>
      ) : feed.length === 0 ? (
        <EmptyState
          icon="users"
          title="No posts from friends yet."
          actionLabel="Find friends"
          onAction={() => router.push(paths.friends)}
        />
      ) : (
        shown.map((post, index) => (
          <View key={post.postId}>
            {index > 0 ? <View style={styles.hairline} /> : null}
            <HomePost post={post} now={now} onComments={() => setComments({ postId: post.postId, open: true })} />
          </View>
        ))
      )}
    </Section>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.wordmark}>
            clubi
          </Text>
          <View style={styles.icons}>
            <IconButton icon="calendar" size={44} plain accessibilityLabel="Trips" onPress={() => router.push(paths.trips)} />
            <IconButton
              icon="bell"
              size={44}
              plain
              accessibilityLabel="Notifications"
              badge={badge}
              onPress={() => router.push(paths.notifications)}
            />
            <IconButton icon="menu" size={44} plain accessibilityLabel="Settings" onPress={() => router.push(paths.settings)} />
          </View>
        </View>

        <SearchField label="Search places and events" onPress={openSearch} />

        <View style={styles.pills}>
          <Pills
            gutter={GUTTER}
            pills={[
              { key: "tonight", label: "Tonight", icon: "navigate", onPress: () => jump("tonight", "picks") },
              { key: "upcoming", label: "Coming up", icon: "calendar", onPress: () => jump("upcoming", "tonight", "picks") },
              { key: "friends", label: "Friend picks", icon: "users", onPress: () => jump("friends", "feed") },
              { key: "group", label: "With friends", icon: "map", onPress: () => router.push(GROUP_MAP) },
              { key: "plan", label: "Plan my night", icon: "spark", onPress: () => router.push(planPath()) },
            ]}
          />
        </View>

        {nothingNearby ? (
          <EmptyState icon="map" title="Nothing nearby yet. Try the map." actionLabel="Open map" onAction={openMap} />
        ) : (
          <>
            {has(tonight?.topPicks) ? (
              <Section name="picks" onTop={setTop}>
                <CardRow
                  title="Top picks for you"
                  items={tonight?.topPicks}
                  gutter={GUTTER}
                  now={now}
                  moreLabel="See top picks on the map"
                  onMore={openMap}
                />
              </Section>
            ) : null}
            {feedFirst ? feedSection : null}
            {tonight !== undefined && tonight.friendsGoing.length > 0 ? (
              <Section name="friends" onTop={setTop}>
                <CardRow
                  title="Where friends go"
                  items={tonight.friendsGoing}
                  gutter={GUTTER}
                  now={now}
                  moreLabel="See where the group should go on the map"
                  onMore={() => router.push(GROUP_MAP)}
                />
              </Section>
            ) : null}
            {eventsTonight.length > 0 ? (
              <Section name="tonight" onTop={setTop}>
                <CardRow
                  title="Events tonight"
                  items={eventsTonight}
                  gutter={GUTTER}
                  now={now}
                  moreLabel="See tonight's events on the map"
                  onMore={openMap}
                />
              </Section>
            ) : null}
            {upcoming !== undefined && upcoming.length > 0 ? (
              <Section name="upcoming" onTop={setTop}>
                <CardRow
                  title="Coming up"
                  items={upcoming}
                  gutter={GUTTER}
                  now={now}
                  moreLabel="See upcoming events on the map"
                  onMore={openMap}
                />
              </Section>
            ) : null}
          </>
        )}

        {feedFirst && !nothingNearby ? null : feedSection}
      </ScrollView>
      <CommentsSheet
        postId={comments.postId}
        postIsMine={commentsPostIsMine}
        visible={comments.open}
        onClose={() => setComments((state) => ({ ...state, open: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: GUTTER, paddingTop: 2, paddingBottom: 32 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 52 },
  wordmark: { fontFamily: SERIF, fontSize: 32, lineHeight: 40, fontWeight: fontWeight.bold, letterSpacing: -0.8, color: colors.accent },
  // The three icons sit close together and the last one lines up with the page's right edge.
  icons: { flexDirection: "row", alignItems: "center", marginRight: -10 },
  pills: { marginTop: 6 },
  section: { marginTop: 8 },
  loading: { gap: 28, paddingTop: 4 },
  // The hairline between two posts runs to both edges of the screen.
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginHorizontal: -GUTTER, marginVertical: 16 },
});
