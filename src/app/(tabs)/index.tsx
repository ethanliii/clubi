import { router, type Href } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState, Loading, TabHeader, Text } from "../../components";
import { CommentsSheet } from "../../features/feed/Comments";
import { PostCard, PostSkeletons } from "../../features/feed/PostCard";
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

/**
 * The first tab and the screen the app opens on: the friends' feed.
 * The wordmark, the icons and the search field stay on top; under them one post per screen, and a
 * swipe left goes to the next one (`useFeed` loads more as you near the end).
 * Everything that recommends a place lives on the Search tab.
 */
export default function FeedTab() {
  const me = useMe();
  const now = useNow();
  const { width } = useWindowDimensions();
  const feed = useFeed({ fillsScreen: true });
  // Each sheet remembers its post while it slides away; `open` is what shows it.
  const [comments, setComments] = useState<{ postId: Id<"posts"> | null; open: boolean }>({ postId: null, open: false });
  const [menu, setMenu] = useState<{ postId: Id<"posts"> | null; open: boolean }>({ postId: null, open: false });
  // Swipe left / right between posts, one post per screen (Bryan's prototype). `page` is the one showing.
  const [page, setPage] = useState(0);
  const pager = useRef<FlatList>(null);

  // The Map tab's search field takes the keyboard each time this number changes.
  const openSearch = () => router.push(`/map?search=${Date.now()}` as Href);
  const isMine = (postId: Id<"posts"> | null) =>
    me !== undefined && feed.posts.some((post) => post.postId === postId && post.author.userId === me.userId);
  const menuPost = feed.posts.find((post) => post.postId === menu.postId) ?? null;
  const total = feed.posts.length;
  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(total, index));
    pager.current?.scrollToOffset({ offset: next * width, animated: true });
    setPage(next);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.head}>
        <TabHeader />
        <SearchField label="Search places and events" onPress={openSearch} />
        <View style={styles.feedLabel}>
          <SectionLabel title="Your feed" />
          {total > 0 ? (
            <Text variant="caption" muted accessibilityLabel={`Post ${Math.min(page + 1, total)} of ${total}`}>
              {page < total ? `${page + 1} / ${total}${feed.canLoadMore ? "+" : ""} · swipe for next` : "All caught up"}
            </Text>
          ) : null}
        </View>
      </View>

      {total === 0 ? (
        <View style={styles.emptyWrap}>
          {feed.loading ? (
            <PostSkeletons />
          ) : (
            <EmptyState
              icon="users"
              title="Your feed is quiet."
              body="Add friends to see what they rank."
              actionLabel="Find friends"
              onAction={() => router.push(paths.friends)}
            />
          )}
        </View>
      ) : (
        <FlatList
          ref={pager}
          data={[...feed.posts, null]}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(post, index) => (post ? post.postId : `end-${index}`)}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
          onEndReached={feed.more}
          onEndReachedThreshold={2}
          style={styles.list}
          renderItem={({ item }) =>
            item === null ? (
              <View style={[styles.page, styles.endPage, { width }]}>
                {feed.loadingMore ? (
                  <Loading compact label="Loading more" />
                ) : feed.canLoadMore ? (
                  <Button title="Load more" accessibilityLabel="Load more" variant="link" onPress={feed.more} style={styles.more} />
                ) : (
                  <>
                    <Text style={styles.caughtUp}>You&apos;re all caught up</Text>
                    <Button title="Back to the newest" accessibilityLabel="Back to the newest" variant="secondary" size="md" onPress={() => goTo(0)} />
                  </>
                )}
              </View>
            ) : (
              <ScrollView style={{ width }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                <PostCard
                  post={item}
                  mine={item.author.userId === me?.userId}
                  now={now}
                  onComments={() => setComments({ postId: item.postId, open: true })}
                  onMenu={item.author.userId === me?.userId ? () => setMenu({ postId: item.postId, open: true }) : undefined}
                  onOpenPost={() => router.push(postPath(item.postId))}
                />
              </ScrollView>
            )
          }
        />
      )}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  head: { paddingHorizontal: GUTTER, paddingTop: 2 },
  list: { flex: 1 },
  page: { paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 32 },
  endPage: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  emptyWrap: { flex: 1, paddingHorizontal: GUTTER },
  feedLabel: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  more: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 18 },
  caughtUp: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: colors.fg },
});
