import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { EmptyState, ErrorBoundary, goBack, Header, Screen, SkeletonRows, Text } from "../../components";
import { CommentComposer, CommentRow, NoComments, type CommentComposerHandle } from "../../features/feed/Comments";
import { PostCard, PostSkeletons } from "../../features/feed/PostCard";
import { PostMenu } from "../../features/feed/PostMenu";
import { api, type Id } from "../../lib/api";
import { useNow } from "../../lib/useNow";
import { useMe } from "../../state/session";
import { colors, fontWeight, spacing } from "../../theme";

/** One post with its comments: `/post/<postId>`. */
export default function PostScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
      <Screen scroll={false} edges={["top", "bottom"]}>
        <Header />
        {/* A link with an id the backend does not recognise throws; show it as a post that is gone. */}
        <ErrorBoundary key={postId} fallback={() => <Gone />}>
          <Post postId={postId as Id<"posts">} />
        </ErrorBoundary>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Gone() {
  return (
    <EmptyState
      title="This post isn't available."
      body="It was deleted, or you can't see it."
      actionLabel="Back"
      onAction={goBack}
    />
  );
}

function Post({ postId }: { postId: Id<"posts"> }) {
  const me = useMe();
  const now = useNow();
  const post = useQuery(api.posts.get, { postId });
  const comments = useQuery(api.posts.comments, { postId });
  const commentBox = useRef<CommentComposerHandle>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  if (post === undefined) return <PostSkeletons count={1} />;
  if (post === null) return <Gone />;
  const mine = post.author.userId === me?.userId;

  return (
    <View style={styles.body}>
      <FlatList
        data={comments ?? []}
        keyExtractor={(comment) => comment.id}
        renderItem={({ item }) => (
          <CommentRow
            comment={item}
            canDelete={item.mine || mine}
            now={now}
            onReply={(name) => commentBox.current?.reply(name)}
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <PostCard
              post={post}
              mine={mine}
              now={now}
              hideCommentCount
              onComments={() => commentBox.current?.focus()}
              onMenu={mine ? () => setMenuOpen(true) : undefined}
            />
            <View style={styles.comments}>
              <Text accessibilityRole="header" style={styles.commentsTitle}>
                Comments
              </Text>
              {comments !== undefined && comments.length > 0 ? (
                <Text style={styles.count}>{comments.length}</Text>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={comments === undefined ? <SkeletonRows count={2} /> : <NoComments />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={styles.content}
      />
      <View style={styles.composer}>
        <CommentComposer postId={postId} ref={commentBox} />
      </View>
      <PostMenu post={post} visible={menuOpen} onClose={() => setMenuOpen(false)} onDeleted={goBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // `Screen` leaves room under its content; the comment box sits closer to the bottom edge.
  body: { flex: 1, marginBottom: -spacing.md },
  list: { flex: 1, marginHorizontal: -spacing.lg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  header: { gap: spacing.lg },
  // The app's section label, at the left gutter, under a hairline that runs to both edges.
  comments: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginHorizontal: -spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  commentsTitle: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.bold, letterSpacing: 0.9, textTransform: "uppercase", color: colors.fg },
  count: { fontSize: 12, lineHeight: 16, color: colors.low },
  // The comment box stays over the thread, with a hairline where the list scrolls under it.
  composer: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
