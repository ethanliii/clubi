import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { router } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import type { FeedItem } from "../../../convex/lib/contract";
import {
  Avatar, Button, Chip, EmptyState, Icon, Photo, ScoreBadge, Skeleton, Text, openVenue, timeAgo,
} from "../../components";
import { colors, radius, spacing } from "../../theme";

/** Home tab = the friend feed (decision D2). UI-SPEC §7. New posts appear on their own. */
export default function Home() {
  const { results, status, loadMore } = usePaginatedQuery(api.posts.feed, {}, { initialNumItems: 15 });
  const unread = useQuery(api.notifications.unreadCount, {});

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={results}
        keyExtractor={(p) => String(p.postId)}
        contentContainerStyle={styles.list}
        onEndReached={() => status === "CanLoadMore" && loadMore(15)}
        ListHeaderComponent={
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
        }
        ListEmptyComponent={
          status === "LoadingFirstPage" ? (
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
        renderItem={({ item }) => <Post post={item} />}
      />
    </SafeAreaView>
  );
}

function Post({ post }: { post: FeedItem }) {
  const react = useMutation(api.posts.react);
  const like = () =>
    react({ postId: post.postId }).catch((e: unknown) => Alert.alert("Couldn't like", e instanceof Error ? e.message : "Try again"));
  const chips = [...post.tags, ...(post.insightChips ?? [])];
  const open = () => openVenue(post.target);

  return (
    <View style={styles.post}>
      <View style={styles.row}>
        <Pressable onPress={() => router.push({ pathname: "/friend/[id]", params: { id: String(post.author.userId) } })}>
          <Avatar name={post.author.displayName} url={post.author.avatarUrl} size={36} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text>
            <Text style={{ fontWeight: "700" }}>{post.author.displayName}</Text> ranked{" "}
            <Text style={{ fontWeight: "700" }} onPress={open}>{post.target.name}</Text>
          </Text>
          <Text variant="caption" muted>{post.label} · {timeAgo(post.createdAt)}</Text>
        </View>
        <ScoreBadge score={post.score} />
      </View>

      <Pressable onPress={open} style={styles.photo}>
        {post.photoUrls[0] ? (
          <Image source={{ uri: post.photoUrls[0] }} style={{ width: "100%", height: 260 }} />
        ) : (
          <Photo item={{ category: post.target.category }} height={200} />
        )}
      </Pressable>

      {post.caption ? <Text>{`"${post.caption}"`}</Text> : null}
      {chips.length > 0 && (
        <View style={styles.chips}>
          {chips.slice(0, 5).map((c) => <Chip key={c} label={c} />)}
        </View>
      )}

      {post.myScoreForIt !== undefined ? (
        <View style={styles.callout}>
          <Text variant="caption">You gave it <Text variant="caption" style={{ fontWeight: "700" }}>{post.myScoreForIt.toFixed(1)}</Text></Text>
        </View>
      ) : (
        <Pressable onPress={() => router.push({ pathname: "/rate", params: { kind: post.target.kind, id: String(post.target.id) } })}>
          <Text variant="caption" style={{ color: colors.accent, fontWeight: "600" }}>Rank it too →</Text>
        </Pressable>
      )}

      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="Like" onPress={like} style={styles.action}>
          <Icon name="heart" size={18} color={post.myReaction ? colors.accent : colors.muted} />
          <Text variant="caption" muted>{post.reactionCount ?? 0}</Text>
        </Pressable>
        <View style={styles.action} accessibilityLabel="Comments">
          <Icon name="comment" size={18} color={colors.muted} />
          <Text variant="caption" muted>{post.commentCount ?? 0}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -4, right: -6, backgroundColor: colors.accent, color: colors.white, fontSize: 10, lineHeight: 14, paddingHorizontal: 5, borderRadius: 8, overflow: "hidden" },
  post: { gap: 10, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  photo: { borderRadius: radius.xl, overflow: "hidden" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  callout: { backgroundColor: colors.raised, borderRadius: radius.md, padding: 10 },
  action: { flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 12 },
});
