import { useQuery } from "convex/react";
import { router, type Href } from "expo-router";
import { useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState, Icon, IconButton, Text } from "../../components";
import { CommentsSheet } from "../../features/feed/Comments";
import { CardRow, SectionLabel } from "../../features/home/CardRow";
import { HomePost, HomePostSkeleton } from "../../features/home/HomePost";
import { Pills } from "../../features/home/Pills";
import { SearchField } from "../../features/home/SearchField";
import { api } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { paths } from "../../lib/links";
import { useKeptQuery } from "../../lib/useKeptQuery";
import { useNow } from "../../lib/useNow";
import { useMe } from "../../state/session";
import { colors, fontWeight } from "../../theme";

/** The backend caps the count at 99; at the cap there may be more. */
const UNREAD_CAP = 99;
/** The screen's side padding. Carousels run through it to both edges. */
const GUTTER = 16;
const GROUP_MAP = "/group-map" as Href;
/** The wordmark's bold serif: Georgia on iOS and the web, the system serif on Android. */
const SERIF = Platform.select({ android: "serif", default: "Georgia" });

type SectionKey = "picks" | "friends" | "tonight" | "upcoming" | "feed";

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
  const mark = (key: SectionKey) => (event: LayoutChangeEvent) => {
    tops.current[key] = event.nativeEvent.layout.y;
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
  const openFeed = () => router.push(paths.feed);
  const has = (items: unknown[] | undefined) => items === undefined || items.length > 0;
  const commentsPostIsMine =
    me !== undefined && (feed ?? []).some((post) => post.postId === comments.postId && post.author.userId === me.userId);

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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              onPress={() => router.push(paths.settings)}
              style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
            >
              <View style={styles.bar} />
              <View style={styles.bar} />
              <View style={styles.bar} />
            </Pressable>
          </View>
        </View>

        <SearchField label="Search places, events, friends" onPress={openMap} />

        <View style={styles.pills}>
          <Pills
            gutter={GUTTER}
            pills={[
              { key: "tonight", label: "Tonight", icon: "navigate", onPress: () => jump("tonight", "picks") },
              { key: "upcoming", label: "Coming up", icon: "calendar", onPress: () => jump("upcoming", "tonight", "picks") },
              { key: "friends", label: "Friend picks", icon: "users", onPress: () => jump("friends", "feed") },
              { key: "group", label: "With friends", icon: "map", onPress: () => router.push(GROUP_MAP) },
            ]}
          />
        </View>

        {nothingNearby ? (
          <EmptyState icon="map" title="Nothing nearby yet. Try the map." actionLabel="Open map" onAction={openMap} />
        ) : (
          <>
            {has(tonight?.topPicks) ? (
              <View onLayout={mark("picks")} style={styles.section}>
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
            {tonight !== undefined && tonight.friendsGoing.length > 0 ? (
              <View onLayout={mark("friends")} style={styles.section}>
                <CardRow
                  title="Where friends go"
                  items={tonight.friendsGoing}
                  gutter={GUTTER}
                  now={now}
                  moreLabel="See where the group should go on the map"
                  onMore={() => router.push(GROUP_MAP)}
                />
              </View>
            ) : null}
            {tonight !== undefined && tonight.events.length > 0 ? (
              <View onLayout={mark("tonight")} style={styles.section}>
                <CardRow
                  title="Events tonight"
                  items={tonight.events}
                  gutter={GUTTER}
                  now={now}
                  moreLabel="See tonight's events on the map"
                  onMore={openMap}
                />
              </View>
            ) : null}
            {upcoming !== undefined && upcoming.length > 0 ? (
              <View onLayout={mark("upcoming")} style={styles.section}>
                <CardRow
                  title="Coming up"
                  items={upcoming}
                  gutter={GUTTER}
                  now={now}
                  moreLabel="See upcoming events on the map"
                  onMore={openMap}
                />
              </View>
            ) : null}
          </>
        )}

        <View onLayout={mark("feed")} style={styles.section}>
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
            feed.map((post, index) => (
              <View key={post.postId}>
                {index > 0 ? <View style={styles.hairline} /> : null}
                <HomePost post={post} now={now} onComments={() => setComments({ postId: post.postId, open: true })} />
              </View>
            ))
          )}
        </View>
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
  menu: { width: 44, height: 44, alignItems: "center", justifyContent: "center", gap: 5 },
  bar: { width: 22, height: 2, borderRadius: 1, backgroundColor: colors.fg },
  pressed: { opacity: 0.6 },
  pills: { marginTop: 6 },
  section: { marginTop: 8 },
  loading: { gap: 28, paddingTop: 4 },
  // The hairline between two posts runs to both edges of the screen.
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginHorizontal: -GUTTER, marginVertical: 16 },
});
