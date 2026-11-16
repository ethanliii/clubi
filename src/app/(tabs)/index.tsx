import { router, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState, Loading, TabHeader, Text } from "../../components";
import { CommentsSheet } from "../../features/feed/Comments";
import { PostCard, PostDivider, PostSkeletons } from "../../features/feed/PostCard";
import { PostMenu } from "../../features/feed/PostMenu";
import { useFeed } from "../../features/feed/useFeed";
import { SectionLabel } from "../../features/home/CardRow";
import { SearchField } from "../../features/home/SearchField";
import type { Id } from "../../lib/api";
import { paths, postPath } from "../../lib/links";
import { useNow } from "../../lib/useNow";
import { useMe } from "../../state/session";
import { colors } from "../../theme";

/** The screen's side padding. The hairlines between posts run through it to both edges. */
const GUTTER = 16;
/** A post of mine this fresh was just posted: the feed scrolls to it. */
const JUST_POSTED_MS = 60_000;

/**
 * The first tab and the screen the app opens on: the friends' feed.
 * The wordmark, the icons and the search field sit on top and scroll away; right under them the
 * whole feed, page by page (`useFeed`), down to its end.
 * Everything that recommends a place lives on the Search tab.
 */
export default function FeedTab() {
  const me = useMe();
  const now = useNow();
  // The list's height and its content's height: while the posts do not fill the screen, the feed reads on.
  const [size, setSize] = useState({ list: 0, content: 0 });
  const feed = useFeed({ fillsScreen: size.list === 0 || size.content > size.list });
  // Each sheet remembers its post while it slides away; `open` is what shows it.
  const [comments, setComments] = useState<{ postId: Id<"posts"> | null; open: boolean }>({ postId: null, open: false });
  const [menu, setMenu] = useState<{ postId: Id<"posts"> | null; open: boolean }>({ postId: null, open: false });

  const list = useRef<FlatList>(null);
  /** Where "YOUR FEED" starts inside the list, under everything that sits on top. */
  const feedTop = useRef(0);
  /** The list's and its content's heights again, for a timer to read: how far the list can scroll. */
  const heights = useRef({ list: 0, content: 0 });
  /** The post of mine the list last scrolled to, so it happens once per post. */
  const shownPost = useRef<string | null>(null);

  // After posting a ranking the flow ends here: bring the new post, the first in the feed, into view.
  const first = feed.posts[0];
  const mineOnTop = first !== undefined && me !== undefined && first.author.userId === me.userId;
  const firstId = first?.postId;
  const firstAt = first?.createdAt;
  useEffect(() => {
    if (!mineOnTop || firstId === undefined || firstAt === undefined) return;
    if (shownPost.current === firstId || Date.now() - firstAt > JUST_POSTED_MS) return;
    shownPost.current = firstId;
    // A beat later, once the list has laid out what sits on top. A feed too short to bring
    // "YOUR FEED" to the top stays where it is: the post is on screen, and a half-scroll would only clip the wordmark.
    setTimeout(() => {
      const offset = Math.max(0, feedTop.current - 4);
      if (heights.current.content - heights.current.list >= offset) list.current?.scrollToOffset({ offset, animated: false });
    }, 250);
  }, [mineOnTop, firstId, firstAt]);

  // The Map tab's search field takes the keyboard each time this number changes.
  const openSearch = () => router.push(`/map?search=${Date.now()}` as Href);
  const isMine = (postId: Id<"posts"> | null) =>
    me !== undefined && feed.posts.some((post) => post.postId === postId && post.author.userId === me.userId);
  const menuPost = feed.posts.find((post) => post.postId === menu.postId) ?? null;

  const top = (
    <View>
      <TabHeader />

      <SearchField label="Search places and events" onPress={openSearch} />

      <View onLayout={(event) => (feedTop.current = event.nativeEvent.layout.y)} style={styles.feedLabel}>
        <SectionLabel title="Your feed" />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        ref={list}
        data={feed.posts}
        keyExtractor={(post) => post.postId}
        renderItem={({ item }) => {
          const mine = item.author.userId === me?.userId;
          return (
            <PostCard
              post={item}
              mine={mine}
              now={now}
              onComments={() => setComments({ postId: item.postId, open: true })}
              onMenu={mine ? () => setMenu({ postId: item.postId, open: true }) : undefined}
              onOpenPost={() => router.push(postPath(item.postId))}
            />
          );
        }}
        ListHeaderComponent={top}
        ItemSeparatorComponent={Divider}
        ListEmptyComponent={
          feed.loading ? (
            <PostSkeletons />
          ) : (
            <EmptyState
              icon="users"
              title="Your feed is quiet."
              body="Add friends to see what they rank."
              actionLabel="Find friends"
              onAction={() => router.push(paths.friends)}
            />
          )
        }
        ListFooterComponent={
          feed.posts.length === 0 ? undefined : feed.loadingMore ? (
            <Loading compact label="Loading more" />
          ) : feed.canLoadMore ? (
            <Button title="Load more" accessibilityLabel="Load more" variant="link" onPress={feed.more} style={styles.more} />
          ) : feed.exhausted ? (
            <Text muted center style={styles.caughtUp}>
              You&apos;re all caught up
            </Text>
          ) : undefined
        }
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          heights.current.list = height;
          setSize((was) => (was.list === height ? was : { ...was, list: height }));
        }}
        onContentSizeChange={(_width, content) => {
          heights.current.content = content;
          setSize((was) => (was.content === content ? was : { ...was, content }));
        }}
        onEndReached={feed.more}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={styles.content}
      />
      <CommentsSheet
        postId={comments.postId}
        postIsMine={isMine(comments.postId)}
        visible={comments.open}
        onClose={() => setComments((state) => ({ ...state, open: false }))}
      />
      <PostMenu post={menuPost} visible={menu.open} onClose={() => setMenu((state) => ({ ...state, open: false }))} />
    </SafeAreaView>
  );
}

/** The hairline between two posts, running to both edges of the screen. */
function Divider() {
  return (
    <View style={styles.divider}>
      <PostDivider />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: 2, paddingBottom: 32 },
  feedLabel: { marginTop: 10 },
  divider: { marginHorizontal: -GUTTER },
  more: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 18 },
  caughtUp: { fontSize: 13, lineHeight: 18, paddingVertical: 12 },
});
