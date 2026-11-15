import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState, type Ref } from "react";
import { FlatList, Pressable, StyleSheet, View, type TextInputInstance } from "react-native";
import { Avatar, Button, IconButton, Sheet, SkeletonRows, Text, TextField } from "../../components";
import { api, type CommentItem, type Id } from "../../lib/api";
import { formatRelativeTime } from "../../lib/format";
import { userPath } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { useNow } from "../../lib/useNow";
import { colors, fontWeight, spacing } from "../../theme";

/** The backend's limit (`COMMENT_MAX` in convex/lib/social.ts). */
const COMMENT_MAX = 500;

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
        onPress={openAuthor}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Avatar name={author.displayName} uri={author.avatarUrl} size={32} />
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
            <Text variant="caption" muted>
              {formatRelativeTime(comment.createdAt, now)}
            </Text>
          </View>
          <Text style={styles.text}>{comment.text}</Text>
        </Pressable>
        {armed ? (
          <View style={styles.armed}>
            <Button
              title="Delete"
              accessibilityLabel="Delete"
              variant="ghost"
              disabled={pending}
              onPress={() => void remove({ commentId: comment.id })}
              style={styles.small}
            />
            <Button
              title="Cancel"
              accessibilityLabel="Cancel"
              variant="link"
              onPress={() => setArmed(false)}
              style={styles.small}
            />
          </View>
        ) : null}
      </View>
      {canDelete && !armed ? (
        <IconButton icon="more" accessibilityLabel="Comment options" size={32} plain color={colors.muted} onPress={() => setArmed(true)} />
      ) : null}
    </View>
  );
}

/** The comment box and "Send". Clears itself when the comment is saved; the list updates by itself. */
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
      <TextField
        ref={inputRef}
        placeholder="Add a comment"
        accessibilityLabel="Comment"
        value={text}
        onChangeText={setText}
        maxLength={COMMENT_MAX}
        returnKeyType="send"
        submitBehavior="submit"
        onSubmitEditing={() => void send()}
        style={styles.input}
      />
      <Button title="Send" accessibilityLabel="Send" disabled={!ready} onPress={() => void send()} style={styles.send} />
    </View>
  );
}

/** What a comment list says when there is nothing in it. */
export function NoComments() {
  return (
    <Text variant="caption" muted center style={styles.none}>
      No comments yet. Say something.
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
          <SkeletonRows count={2} />
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
          style={styles.sheetList}
          contentContainerStyle={styles.sheetListContent}
        />
      )}
      {postId ? <CommentComposer postId={postId} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  body: { flex: 1, gap: spacing.sm },
  meta: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  name: { flexShrink: 1, fontWeight: fontWeight.bold },
  // Bryan's body size (14 / 20), as in his feed notes.
  text: {},
  armed: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  small: { width: "auto", paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 40 },
  pressed: { opacity: 0.6 },
  composer: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  input: { flex: 1, width: "auto" },
  send: { width: "auto", minHeight: 48, paddingVertical: spacing.md },
  none: { paddingVertical: spacing.xl },
  sheetList: { flexGrow: 0, flexShrink: 1, minHeight: 140 },
  sheetListContent: { gap: spacing.lg, paddingBottom: spacing.sm },
});
