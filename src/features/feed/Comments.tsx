import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState, type Ref } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View, type TextInputInstance } from "react-native";
import { Avatar, Icon, IconButton, Sheet, SkeletonRows, Text } from "../../components";
import { api, type CommentItem, type Id } from "../../lib/api";
import { formatRelativeTime } from "../../lib/format";
import { userPath } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { useNow } from "../../lib/useNow";
import { colors, fontWeight, spacing } from "../../theme";

/** The backend's limit (`COMMENT_MAX` in convex/lib/social.ts). */
const COMMENT_MAX = 500;
const DANGER = "#ff6b6b";

/**
 * One comment. Long-press (or the "⋯" beside it) shows "Delete" on a comment I may remove:
 * my own, or any comment on my own post.
 */
export function CommentRow({
  comment,
  canDelete,
  now,
  onAuthor,
}: {
  comment: CommentItem;
  canDelete: boolean;
  now: number;
  /** Called before the author's profile opens, e.g. to close the sheet. */
  onAuthor?: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const { run: remove, pending } = useMutationToast(api.posts.removeComment);
  const { author } = comment;
  const openAuthor = () => {
    onAuthor?.();
    router.push(userPath(author.userId));
  };

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${author.displayName}'s profile`}
        hitSlop={6}
        onPress={openAuthor}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Avatar name={author.displayName} uri={author.avatarUrl} size={36} />
      </Pressable>
      <View style={styles.body}>
        <Pressable
          accessibilityLabel={`Comment by ${author.displayName}: ${comment.text}`}
          accessibilityHint={canDelete ? "Long press to delete" : undefined}
          disabled={!canDelete}
          onLongPress={() => setArmed(true)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <View style={styles.meta}>
            <Text numberOfLines={1} style={styles.name}>
              {author.displayName}
            </Text>
            <Text muted style={styles.time}>
              {formatRelativeTime(comment.createdAt, now)}
            </Text>
          </View>
          <Text style={styles.text}>{comment.text}</Text>
        </Pressable>
        {armed ? (
          <View style={styles.armed}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete"
              disabled={pending}
              hitSlop={10}
              onPress={() => void remove({ commentId: comment.id })}
              style={({ pressed }) => [styles.choice, (pressed || pending) && styles.pressed]}
            >
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={10}
              onPress={() => setArmed(false)}
              style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
            >
              <Text muted style={styles.cancel}>
                Cancel
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {canDelete && !armed ? (
        <IconButton icon="more" accessibilityLabel="Comment options" size={36} plain color={colors.muted} onPress={() => setArmed(true)} />
      ) : null}
    </View>
  );
}

/** The comment box and its send button. Clears itself when the comment is saved; the list updates by itself. */
export function CommentComposer({ postId, inputRef }: { postId: Id<"posts">; inputRef?: Ref<TextInputInstance> }) {
  const [text, setText] = useState("");
  const { run: addComment, pending } = useMutationToast(api.posts.addComment);
  const ready = text.trim().length > 0 && !pending;
  const send = async () => {
    if (!ready) return;
    const saved = await addComment({ postId, text: text.trim() });
    if (saved !== undefined) setText("");
  };
  return (
    <View style={styles.composer}>
      <TextInput
        ref={inputRef}
        placeholder="Add a comment"
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        accessibilityLabel="Comment"
        value={text}
        onChangeText={setText}
        maxLength={COMMENT_MAX}
        returnKeyType="send"
        submitBehavior="submit"
        onSubmitEditing={() => void send()}
        style={styles.input}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send"
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        onPress={() => void send()}
        style={({ pressed }) => [styles.send, ready && styles.sendReady, pressed && styles.pressed]}
      >
        <Icon name="send" size={20} color={ready ? colors.white : colors.muted} />
      </Pressable>
    </View>
  );
}

/** What a comment list says when there is nothing in it. */
export function NoComments() {
  return (
    <Text muted center style={styles.none}>
      No comments yet
    </Text>
  );
}

/**
 * The comment sheet the feed opens from a post's comment button: the post's comments, oldest first,
 * and the comment box. Keep it mounted and flip `visible`.
 */
export function CommentsSheet({
  postId,
  postIsMine,
  visible,
  onClose,
}: {
  postId: Id<"posts"> | null;
  /** I wrote the post, so I may remove any comment on it. */
  postIsMine: boolean;
  /** Closing keeps `postId`, so the list stays put while the sheet slides away. */
  visible: boolean;
  onClose: () => void;
}) {
  const comments = useQuery(api.posts.comments, postId ? { postId } : "skip");
  const now = useNow();
  return (
    <Sheet visible={visible} onClose={onClose} title="Comments" scroll={false}>
      {comments === undefined ? (
        <View style={styles.sheetList}>
          <SkeletonRows count={3} />
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(comment) => comment.id}
          renderItem={({ item }) => (
            <CommentRow comment={item} canDelete={item.mine || postIsMine} now={now} onAuthor={onClose} />
          )}
          ListEmptyComponent={<NoComments />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.sheetList}
          contentContainerStyle={styles.sheetListContent}
        />
      )}
      {postId ? <CommentComposer postId={postId} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  body: { flex: 1, gap: spacing.xs },
  meta: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  name: { flexShrink: 1, fontSize: 14, lineHeight: 19, fontWeight: fontWeight.semibold },
  time: { fontSize: 13, lineHeight: 18 },
  text: { fontSize: 15, lineHeight: 21 },
  armed: { flexDirection: "row", alignItems: "center", gap: spacing.xl },
  choice: { minHeight: 36, justifyContent: "center" },
  delete: { fontWeight: fontWeight.semibold, color: DANGER },
  cancel: { fontWeight: fontWeight.medium },
  pressed: { opacity: 0.6 },
  composer: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  // 16 keeps iOS Safari from zooming the page when the box is focused.
  input: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 23,
    backgroundColor: colors.surface,
    color: colors.fg,
    fontSize: 16,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  sendReady: { backgroundColor: colors.accent },
  none: { paddingVertical: spacing.xxl },
  // Tall enough to read a thread; the sheet itself stops short of the top of the screen.
  sheetList: { flexGrow: 0, flexShrink: 1, minHeight: 260 },
  sheetListContent: { gap: spacing.lg + 2, paddingTop: spacing.xs, paddingBottom: spacing.md },
});
