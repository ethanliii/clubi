import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { router } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, Share, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import type { FeedItem } from "../../../convex/lib/contract";
import {
  Avatar, Button, Chip, CommentsSheet, EmptyState, Icon, Skeleton, Text, openVenue, timeAgo,
} from "../../components";
import type { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";
import { Spotlight } from "../../features/feed/Spotlight";
import { colors, radius, ratingColor, spacing } from "../../theme";

/** Home tab = the friend feed (decision D2). UI-SPEC §7. New posts appear on their own. */
export default function Home() {
  const { results, status, loadMore } = usePaginatedQuery(api.posts.feed, {}, { initialNumItems: 15 });
  const unread = useQuery(api.notifications.unreadCount, {});
  const [commentsFor, setCommentsFor] = useState<Id<"posts"> | null>(null);
  // Spotlight = one big photo per friend, swipe to the next; All = the full feed below.
  const [mode, setMode] = useState<"spotlight" | "all">("spotlight");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={mode === "all" ? results : []}
        keyExtractor={(p) => String(p.postId)}
        contentContainerStyle={styles.list}
        onEndReached={() => status === "CanLoadMore" && loadMore(15)}
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
          <View style={styles.between}>
            <View>
              <Text variant="label">Friends · live</Text>
              <Text variant="heading">Home</Text>
            </View>
            <View style={styles.row}>
              <Pressable accessibilityRole="button" accessibilityLabel="Friends" onPress={() => router.push("/friends")} style={styles.iconButton}>
                <Icon name="user" size={18} color={colors.fg} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push("/notifications")} style={styles.iconButton}>
                <Icon name="bell" size={18} color={colors.fg} />
                {!!unread && <Text style={styles.badge}>{unread > 99 ? "99+" : unread}</Text>}
              </Pressable>
            </View>
          </View>
          {results.length > 0 && (
            <View style={styles.seg}>
              {(["spotlight", "all"] as const).map((m) => (
                <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} onPress={() => setMode(m)}
                  style={[styles.segBtn, mode === m && styles.segOn]}>
                  <Text style={{ fontWeight: "600", color: mode === m ? colors.fg : colors.muted }}>{m === "spotlight" ? "Last night" : "All friends"}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {mode === "spotlight" && <Spotlight posts={results} onSeeAll={() => setMode("all")} onComments={(p) => setCommentsFor(p.postId)} />}
          </View>
        }
        ListEmptyComponent={
          results.length > 0 ? undefined : status === "LoadingFirstPage" ? (
            <View style={{ gap: spacing.lg }}>
              <Skeleton height={320} />
              <Skeleton height={320} />
            </View>
          ) : (
            <EmptyState
              text="Your feed is quiet. Add friends to see what they rank."
              action={
                <View style={{ gap: 10, width: "100%" }}>
                  <Button title="Find friends" onPress={() => router.push("/friends")} />
                  <Button title="See tonight's picks →" variant="ghost" onPress={() => router.push("/search")} />
                </View>
              }
            />
          )
        }
        ListFooterComponent={
          status === "LoadingMore" ? (
            <ActivityIndicator color={colors.muted} />
          ) : status === "Exhausted" && results.length ? (
            <Text center muted variant="caption">{"You're all caught up"}</Text>
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const prev = results[index - 1];
          const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(item.createdAt);
          return (
            <View style={{ gap: spacing.md }}>
              {showDay && <Text variant="label">{dayLabel(item.createdAt)}</Text>}
              <Post post={item} onComments={() => setCommentsFor(item.postId)} />
            </View>
          );
        }}
      />
      <CommentsSheet postId={commentsFor} onClose={() => setCommentsFor(null)} />
    </SafeAreaView>
  );
}

function Post({ post, onComments }: { post: FeedItem; onComments: () => void }) {
  const react = useMutation(api.posts.react);
  const toggleSave = useMutation(api.saves.toggle);
  const [saved, setSaved] = useState<boolean | null>(null);
  const like = () =>
    react({ postId: post.postId }).catch((e: unknown) => Alert.alert("Couldn't like", e instanceof Error ? e.message : "Try again"));
  // Save = "want to go" on the place in the post (saves.toggle), so it shows up in Saved.
  const save = () =>
    toggleSave({ kind: post.target.kind, id: post.target.id, type: "want" }).then(
      (r) => setSaved(r.saved),
      (e: unknown) => Alert.alert("Couldn't save", e instanceof Error ? e.message : "Try again"),
    );
  const chips = [...post.tags, ...(post.insightChips ?? [])];
  const open = () => openVenue(post.target);

  const share = () =>
    Share.share({ message: `${post.author.displayName} ranked ${post.target.name} ${post.score.toFixed(1)} on Clubi` }).catch(() => undefined);
  const rankToo = () => router.push({ pathname: "/rate", params: { kind: post.target.kind, id: String(post.target.id) } });

  // Beli-style card: who ranked what + score ring, photos (only when there are some), notes, actions.
  return (
    <View style={styles.post}>
      <View style={styles.row}>
        <Pressable onPress={() => router.push({ pathname: "/user/[userId]", params: { userId: String(post.author.userId) } })}>
          <Avatar name={post.author.displayName} url={post.author.avatarUrl} size={40} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text>
            <Text style={{ fontWeight: "700" }}>{post.author.displayName}</Text> ranked{" "}
            <Text style={{ fontWeight: "700" }} onPress={open}>{post.target.name}</Text>
          </Text>
          <Text variant="caption" muted>{post.label}</Text>
        </View>
        <ScoreRing score={post.score} />
      </View>

      {post.photoUrls.length > 0 && (
        <Pressable onPress={open} style={styles.photos}>
          {post.photoUrls.slice(0, 2).map((url) => (
            <Image key={url} source={{ uri: url }} style={[styles.photo, post.photoUrls.length === 1 && { flex: 0, width: "70%" }]} />
          ))}
        </Pressable>
      )}

      {post.caption ? (
        <Text>
          <Text style={{ fontWeight: "700" }}>Notes: </Text>
          {post.caption}
        </Text>
      ) : null}
      {chips.length > 0 && (
        <View style={styles.chips}>
          {chips.slice(0, 5).map((c) => <Chip key={c} label={c} />)}
        </View>
      )}
      {post.myScoreForIt !== undefined && (
        <Text variant="caption" muted>
          You gave it <Text variant="caption" style={{ fontWeight: "700", color: ratingColor(post.myScoreForIt) }}>{post.myScoreForIt.toFixed(1)}</Text>
        </Text>
      )}

      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="Like" onPress={like} style={styles.action}>
          <Icon name="heart" size={20} color={post.myReaction ? colors.accent : colors.fg} />
          {!!post.reactionCount && <Text variant="caption">{post.reactionCount}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Comments" onPress={onComments} style={styles.action}>
          <Icon name="comment" size={20} color={colors.fg} />
          {!!post.commentCount && <Text variant="caption">{post.commentCount}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Share" onPress={share} style={styles.action}>
          <Icon name="share" size={20} color={colors.fg} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {post.myScoreForIt === undefined && (
          <Pressable accessibilityRole="button" accessibilityLabel="Rank it too" onPress={rankToo} style={styles.action}>
            <Icon name="plusCircle" size={22} color={colors.fg} />
          </Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel={saved ? "Saved" : "Save"} onPress={save} style={styles.action}>
          <Icon name="bookmark" size={20} color={saved ? colors.accent : colors.fg} />
        </Pressable>
      </View>
      <Text variant="caption" muted>{timeAgo(post.createdAt)}</Text>
    </View>
  );
}

/** Score in a colored ring, Beli-style. The number is the backend's; the color is the rating scale. */
function ScoreRing({ score }: { score: number }) {
  return (
    <View style={[styles.ring, { borderColor: ratingColor(score) }]} accessibilityLabel={`Score ${score.toFixed(1)}`}>
      <Text style={{ fontWeight: "700", color: ratingColor(score) }}>{score.toFixed(1)}</Text>
    </View>
  );
}

/** "Today" / "Yesterday" / "Nov 12" divider when the day changes between posts (formatting only). */
function dayLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -4, right: -6, backgroundColor: colors.accent, color: colors.white, fontSize: 10, lineHeight: 14, paddingHorizontal: 5, borderRadius: 8, overflow: "hidden" },
  post: { gap: 10, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  photos: { flexDirection: "row", gap: 6 },
  photo: { flex: 1, height: 190, borderRadius: radius.lg },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  action: { flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 14 },
  seg: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.lg, padding: 3 },
  segBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.md },
  segOn: { backgroundColor: colors.raised },
  ring: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
