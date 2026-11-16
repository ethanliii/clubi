import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState, type Ref } from "react";
import { FlatList, Platform, Pressable, StyleSheet, TextInput, View, type TextInputInstance } from "react-native";
import { Avatar, Icon, Sheet, SkeletonRows, Text } from "../../components";
import { api, type CommentItem, type Id } from "../../lib/api";
import { formatRelativeTime } from "../../lib/format";
import { userPath } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { useNow } from "../../lib/useNow";
import { useMe } from "../../state/session";
import { colors, fontWeight, palette, spacing } from "../../theme";

/** The backend's limit (`COMMENT_MAX` in convex/lib/social.ts). */
const COMMENT_MAX = 500;
const DANGER = palette.danger;
const AVATAR = 34;
/** The grey field is the focus mark; the browser's own blue ring would sit inside it. */
const WEB_NO_OUTLINE = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null;
/** Small text buttons and the "more" dot reach 44pt with this around them. */
const HIT = { top: 14, bottom: 14, left: 10, right: 10 };

/**
 * One comment, Instagram style: a small round avatar, the bold name with the text flowing after it,
 * and a grey time underneath. Long-press (or the small "more" beside it) shows "Delete" on a comment
 * I may remove: my own, or any comment on my own post.
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
    <View style={[styles.row, armed && styles.rowArmed]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${author.displayName}'s profile`}
        hitSlop={6}
        onPress={openAuthor}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Avatar name={author.displayName} uri={author.avatarUrl} size={AVATAR} />
      </Pressable>
      <View style={styles.body}>
        <Pressable
          accessibilityLabel={`Comment by ${author.displayName}: ${comment.text}`}
          accessibilityHint={canDelete ? "Long press to delete" : undefined}
          disabled={!canDelete}
          delayLongPress={300}
          onLongPress={() => setArmed(true)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.text}>
            <Text style={styles.name}>{author.displayName}</Text>
            {"  "}
            {comment.text}
          </Text>
        </Pressable>
        <View style={styles.meta}>
          <Text style={styles.time}>{formatRelativeTime(comment.createdAt, now)}</Text>
          {armed ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete"
                disabled={pending}
                hitSlop={HIT}
                onPress={() => void remove({ commentId: comment.id })}
                style={({ pressed }) => (pressed || pending) && styles.pressed}
              >
                <Text style={styles.delete}>Delete</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                hitSlop={HIT}
                onPress={() => setArmed(false)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
      {canDelete && !armed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comment options"
          hitSlop={HIT}
          onPress={() => setArmed(true)}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          <Icon name="more" size={16} color={colors.low} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The comment box: my avatar, a light-grey rounded field and a dark-red "Post" that enables only
 * with text. Clears itself when the comment is saved; the list updates by itself.
 */
export function CommentComposer({ postId, inputRef }: { postId: Id<"posts">; inputRef?: Ref<TextInputInstance> }) {
  const me = useMe();
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
      {me ? <Avatar name={me.displayName} uri={me.avatarUrl} size={36} /> : null}
      <View style={styles.field}>
        <TextInput
          ref={inputRef}
          placeholder="Add a comment…"
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          accessibilityLabel="Comment"
          value={text}
          onChangeText={setText}
          maxLength={COMMENT_MAX}
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={() => void send()}
          style={[styles.input, WEB_NO_OUTLINE]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post comment"
          accessibilityState={{ disabled: !ready }}
          disabled={!ready}
          hitSlop={{ top: 6, bottom: 6, right: 6 }}
          onPress={() => void send()}
          style={({ pressed }) => [styles.send, pressed && styles.pressed]}
        >
          <Text style={[styles.sendLabel, !ready && styles.sendOff]}>Post</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** What a comment list says when there is nothing in it. */
export function NoComments() {
  return (
    <View style={styles.none}>
      <Icon name="comment" size={30} color={colors.low} />
      <Text style={styles.noneTitle}>No comments yet</Text>
      <Text muted center style={styles.noneBody}>
        Start the conversation.
      </Text>
    </View>
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
        <View style={[styles.sheetList, styles.sheetWait]}>
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
      {postId ? (
        <View style={styles.sheetComposer}>
          <CommentComposer postId={postId} />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  // A soft wash marks the comment the "Delete" belongs to.
  rowArmed: {
    backgroundColor: colors.surface,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    marginVertical: -spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  body: { flex: 1, gap: 3, paddingTop: 1 },
  name: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.bold, color: colors.fg },
  text: { fontSize: 14.5, lineHeight: 20, color: colors.fg },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.lg, minHeight: 18 },
  time: { fontSize: 12, lineHeight: 16, color: colors.low },
  delete: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.bold, color: DANGER },
  cancel: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.bold, color: colors.muted },
  more: { width: 28, height: AVATAR, alignItems: "flex-end", justifyContent: "center" },
  pressed: { opacity: 0.6 },
  composer: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: palette.field,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
  },
  // 16 keeps iOS Safari from zooming the page when the box is focused.
  input: { flex: 1, minWidth: 0, minHeight: 44, paddingVertical: spacing.sm, color: colors.fg, fontSize: 16 },
  send: { minWidth: 52, height: 44, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
  sendLabel: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.bold, color: colors.accent },
  sendOff: { opacity: 0.35 },
  none: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xxl + spacing.sm },
  noneTitle: { fontSize: 17, lineHeight: 22, fontWeight: fontWeight.bold, marginTop: spacing.sm },
  noneBody: { fontSize: 14, lineHeight: 20 },
  // Tall enough to read a thread (the content keeps 280), but free to shrink on a short phone so the
  // comment box stays above the keyboard. The sheet itself stops short of the top of the screen.
  sheetList: { flexGrow: 0, flexShrink: 1, minHeight: 120 },
  sheetWait: { height: 280 },
  sheetListContent: { gap: spacing.lg + 2, paddingTop: spacing.sm, paddingBottom: spacing.lg, minHeight: 280 },
  sheetComposer: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
