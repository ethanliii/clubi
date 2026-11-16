import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useEffect, useRef, useState, type Ref } from "react";
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
const AVATAR = 32;
/** The grey field is the focus mark; the browser's own blue ring would sit inside it. */
const WEB_NO_OUTLINE = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null;
/** Small text buttons reach 44pt with this around them. */
const HIT = { top: 14, bottom: 14, left: 10, right: 10 };

/**
 * One comment, Instagram style: a small round avatar, the bold name with the text flowing after it,
 * and a grey line underneath: the time and "Reply". Long-press shows "Delete" on that line for a
 * comment I may remove: my own, or any comment on my own post.
 */
export function CommentRow({
  comment,
  canDelete,
  now,
  onAuthor,
  onReply,
}: {
  comment: CommentItem;
  canDelete: boolean;
  now: number;
  /** Called before the author's profile opens, e.g. to close the sheet. */
  onAuthor?: () => void;
  /** "Reply" under the comment: the comment box takes the keyboard, starting with "@Name ". */
  onReply?: (name: string) => void;
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
            {" "}
            {comment.text}
          </Text>
        </Pressable>
        <View style={styles.meta}>
          <Text style={styles.time}>{formatRelativeTime(comment.createdAt, now)}</Text>
          {onReply && !armed ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reply to ${author.displayName}`}
              hitSlop={HIT}
              onPress={() => onReply(author.displayName)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.reply}>Reply</Text>
            </Pressable>
          ) : null}
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
    </View>
  );
}

/** Who "Reply" was pressed on. `at` changes on every press, so pressing the same name twice works. */
export type ReplyTarget = { name: string; at: number };

/**
 * The comment box: my avatar and a light-grey rounded field that grows to four lines as you type.
 * "Post" appears in dark red once there is text. Clears itself when the comment is saved; the list
 * updates by itself.
 */
export function CommentComposer({
  postId,
  inputRef,
  replyTo,
}: {
  postId: Id<"posts">;
  inputRef?: Ref<TextInputInstance>;
  replyTo?: ReplyTarget | null;
}) {
  const me = useMe();
  const [text, setText] = useState("");
  const box = useRef<TextInputInstance | null>(null);
  const { run: addComment, pending } = useMutationToast(api.posts.addComment);
  const hasText = text.trim().length > 0;
  const ready = hasText && !pending;
  const send = async () => {
    if (!ready) return;
    const saved = await addComment({ postId, text: text.trim() });
    if (saved !== undefined) setText("");
  };
  const setBox = (node: TextInputInstance | null) => {
    box.current = node;
    if (typeof inputRef === "function") inputRef(node);
    else if (inputRef) (inputRef as { current: TextInputInstance | null }).current = node;
  };
  const replyName = replyTo?.name;
  const replyAt = replyTo?.at;
  useEffect(() => {
    if (replyName === undefined) return;
    setText((was) => (was.trim().length > 0 ? was : `@${replyName} `));
    box.current?.focus();
  }, [replyName, replyAt]);
  return (
    <View style={styles.composer}>
      {me ? <Avatar name={me.displayName} uri={me.avatarUrl} size={36} style={styles.composerAvatar} /> : null}
      <View style={styles.field}>
        <TextInput
          ref={setBox}
          placeholder="Add a comment…"
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          accessibilityLabel="Comment"
          value={text}
          onChangeText={setText}
          maxLength={COMMENT_MAX}
          multiline
          // A phone's return key starts a new line; on the web Enter sends, as in any chat box.
          submitBehavior={Platform.OS === "web" ? "submit" : "newline"}
          onSubmitEditing={Platform.OS === "web" ? () => void send() : undefined}
          style={[styles.input, WEB_NO_OUTLINE]}
        />
        {hasText ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post comment"
            accessibilityState={{ disabled: !ready }}
            disabled={!ready}
            hitSlop={{ top: 6, bottom: 6, right: 6 }}
            onPress={() => void send()}
            style={({ pressed }) => [styles.send, (pressed || pending) && styles.pressed]}
          >
            <Text style={styles.sendLabel}>Post</Text>
          </Pressable>
        ) : null}
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
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
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
            <CommentRow
              comment={item}
              canDelete={item.mine || postIsMine}
              now={now}
              onAuthor={onClose}
              onReply={(name) => setReplyTo({ name, at: Date.now() })}
            />
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
          <CommentComposer postId={postId} replyTo={replyTo} />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 14, lineHeight: 19, fontWeight: fontWeight.bold, color: colors.fg },
  text: { fontSize: 14, lineHeight: 19, color: colors.fg },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.lg, minHeight: 18 },
  time: { fontSize: 12, lineHeight: 16, color: colors.low },
  delete: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.bold, color: DANGER },
  reply: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.bold, color: colors.muted },
  cancel: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.bold, color: colors.muted },
  pressed: { opacity: 0.6 },
  // The avatar and "Post" stay on the last line as the field grows.
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md },
  composerAvatar: { marginBottom: 4 },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: palette.field,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
  },
  // 16 keeps iOS Safari from zooming the page when the box is focused. Four lines, then it scrolls.
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    maxHeight: 104,
    paddingTop: 11,
    paddingBottom: 11,
    paddingRight: spacing.md,
    color: colors.fg,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: "center",
  },
  send: { minWidth: 52, height: 44, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
  sendLabel: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.bold, color: colors.accent },
  none: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xxl + spacing.sm },
  noneTitle: { fontSize: 17, lineHeight: 22, fontWeight: fontWeight.bold, marginTop: spacing.sm },
  noneBody: { fontSize: 14, lineHeight: 20 },
  // Tall enough to read a thread (the content keeps 280), but free to shrink on a short phone so the
  // comment box stays above the keyboard. The sheet itself stops short of the top of the screen.
  sheetList: { flexGrow: 0, flexShrink: 1, minHeight: 120 },
  sheetWait: { height: 280 },
  sheetListContent: { gap: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, minHeight: 280 },
  sheetComposer: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
