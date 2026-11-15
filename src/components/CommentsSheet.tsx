import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { colors, radius, spacing } from "../theme";
import { Avatar, EmptyState, Skeleton, timeAgo } from "./Bits";
import { Button } from "./Button";
import { Text } from "./Text";

/** Comment thread for one post. UI-SPEC §7: oldest first, 1–500 characters, long-press my comment to delete. */
export function CommentsSheet({ postId, onClose }: { postId: Id<"posts"> | null; onClose: () => void }) {
  const comments = useQuery(api.posts.comments, postId ? { postId } : "skip");
  const add = useMutation(api.posts.addComment);
  const remove = useMutation(api.posts.removeComment);
  const [text, setText] = useState("");

  const send = async () => {
    if (!postId || !text.trim()) return;
    try {
      await add({ postId, text: text.trim() });
      setText("");
    } catch (e) {
      Alert.alert("Couldn't comment", e instanceof Error ? e.message : "Try again");
    }
  };

  const confirmDelete = (commentId: Id<"comments">) =>
    Alert.alert("Delete comment?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove({ commentId }).catch(() => undefined) },
    ]);

  return (
    <Modal visible={postId !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheet}>
        <Text variant="title">Comments</Text>
        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: spacing.md }}>
          {comments === undefined ? (
            <Skeleton height={80} />
          ) : comments.length === 0 ? (
            <EmptyState text="No comments yet. Say something." />
          ) : (
            comments.map((c) => (
              <Pressable key={String(c.id)} onLongPress={c.mine ? () => confirmDelete(c.id) : undefined} style={styles.row}>
                <Avatar name={c.author.displayName} url={c.author.avatarUrl} size={30} />
                <View style={{ flex: 1 }}>
                  <Text variant="caption" style={{ fontWeight: "700" }}>
                    {c.author.displayName} <Text variant="caption" muted>{timeAgo(c.createdAt)}</Text>
                  </Text>
                  <Text>{c.text}</Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment"
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            maxLength={500}
          />
          <Button title="Send" style={styles.send} disabled={!text.trim()} onPress={send} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.fg, borderRadius: radius.lg, padding: spacing.md },
  send: { width: "auto", paddingHorizontal: 16 },
});
