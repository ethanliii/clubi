import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import { Button, EmptyState, Header, IconButton, Loading, Screen, Text } from "../../components";
import { CommentsSheet } from "../../features/feed/Comments";
import { PostCard, PostSkeletons } from "../../features/feed/PostCard";
import { PostMenu } from "../../features/feed/PostMenu";
import { useFeed } from "../../features/feed/useFeed";
import { api, type Id } from "../../lib/api";
import { formatCount } from "../../lib/format";
import { paths, postPath } from "../../lib/links";
import { useNow } from "../../lib/useNow";
import { useMe } from "../../state/session";
import { spacing } from "../../theme";

export default function FeedScreen() {
  const me = useMe();
  const now = useNow();
  // The list's height and its content's height: while the posts do not fill the screen, the feed reads on.
  const [size, setSize] = useState({ list: 0, content: 0 });
  const feed = useFeed({ fillsScreen: size.list === 0 || size.content > size.list });
  const unread = useQuery(api.notifications.unreadCount, {});
  // Each sheet remembers its post while it slides away; `open` is what shows it.
  const [comments, setComments] = useState<{ postId: Id<"posts"> | null; open: boolean }>({ postId: null, open: false });
  const [menu, setMenu] = useState<{ postId: Id<"posts"> | null; open: boolean }>({ postId: null, open: false });

  const isMine = (postId: Id<"posts"> | null) =>
    me !== undefined && feed.posts.some((post) => post.postId === postId && post.author.userId === me.userId);
  const menuPost = feed.posts.find((post) => post.postId === menu.postId) ?? null;

  return (
    <Screen scroll={false}>
      <Header
        title="Feed"
        back={false}
        right={
          <IconButton
            icon="bell"
            accessibilityLabel="Notifications"
            badge={unread ? formatCount(unread) : null}
            onPress={() => router.push(paths.notifications)}
          />
        }
      />
      <FlatList
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
            <Button title="Load more" accessibilityLabel="Load more" variant="ghost" onPress={feed.more} />
          ) : feed.exhausted ? (
            <Text muted center style={styles.caughtUp}>
              You&apos;re all caught up
            </Text>
          ) : undefined
        }
        onLayout={(event) => {
          const list = event.nativeEvent.layout.height;
          setSize((now) => (now.list === list ? now : { ...now, list }));
        }}
        onContentSizeChange={(_width, content) => setSize((now) => (now.content === content ? now : { ...now, content }))}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The list runs edge to edge and down to the tab bar; `Screen` pads the header.
  list: { flex: 1, marginHorizontal: -spacing.lg, marginBottom: -spacing.xl },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  caughtUp: { paddingVertical: spacing.md },
});
