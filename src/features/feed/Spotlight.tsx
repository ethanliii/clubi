import { useMutation } from "convex/react";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Alert, FlatList, Image, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { FeedItem } from "../../../convex/lib/contract";
import { Avatar, Icon, Photo, Text, openVenue, timeAgo } from "../../components/bryan";
import { colors, radius, ratingColor, spacing } from "../../theme";

/** Event-time clock for double-tap detection (kept outside the component for the purity lint). */
function nowMs(): number {
  return Date.now();
}

/**
 * Home spotlight: one big photo per friend (their newest post), swipe to the next friend.
 * Order is the feed's order (newest first). "Closest friend first" needs a backend ordering (ask E14).
 */
export function Spotlight({ posts, onSeeAll, onComments }: { posts: FeedItem[]; onSeeAll: () => void; onComments: (p: FeedItem) => void }) {
  const react = useMutation(api.posts.react);
  const toggleSave = useMutation(api.saves.toggle);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const lastTap = useRef<{ id: string; at: number } | null>(null);
  const fail = (what: string) => (e: unknown) => Alert.alert(`Couldn't ${what}`, e instanceof Error ? e.message : "Try again");
  const like = (p: FeedItem) => react({ postId: p.postId }).catch(fail("like"));
  const save = (p: FeedItem) =>
    toggleSave({ kind: p.target.kind, id: p.target.id, type: "want" }).then((r) => setSaved((s) => ({ ...s, [String(p.postId)]: r.saved })), fail("save"));
  // Double-tap the photo to like (Instagram-style).
  const tapPhoto = (p: FeedItem) => {
    const now = nowMs();
    const id = String(p.postId);
    if (lastTap.current && lastTap.current.id === id && now - lastTap.current.at < 300) {
      lastTap.current = null;
      if (!p.myReaction) void like(p);
    } else {
      lastTap.current = { id, at: now };
    }
  };
  const { width } = useWindowDimensions();
  // Full-bleed 4:5 portrait with square corners (Instagram), one friend per screen width.
  const cardW = width;
  const cardH = Math.round(cardW * 1.25);
  const list = useRef<FlatList<FeedItem>>(null);
  const [index, setIndex] = useState(0);

  // First post per friend, keeping the backend's order.
  const seen = new Set<string>();
  const perFriend = posts.filter((p) => {
    const id = String(p.author.userId);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  if (perFriend.length === 0) return null;

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(perFriend.length - 1, i));
    list.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <FlatList
        ref={list}
        data={perFriend}
        horizontal
        pagingEnabled
        snapToInterval={cardW}
        style={{ marginHorizontal: -spacing.lg }}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => String(p.postId)}
        getItemLayout={(_, i) => ({ length: cardW, offset: cardW * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / cardW))}
        renderItem={({ item }) => (
          <View style={{ width: cardW, gap: 10 }}>
          <Pressable onPress={() => tapPhoto(item)} onLongPress={() => { if (!saved[String(item.postId)]) void save(item); }} delayLongPress={450}
            accessibilityHint="Double-tap to like, hold to save" style={[styles.card, { height: cardH }]}>
            {item.photoUrls[0] ? (
              <Image source={{ uri: item.photoUrls[0] }} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={StyleSheet.absoluteFill}><Photo item={{ category: item.target.category, id: item.target.id }} height={cardH} /></View>
            )}
            <View style={styles.shade} />
            <Pressable style={styles.who} onPress={() => router.push({ pathname: "/user/[userId]", params: { userId: String(item.author.userId) } })}>
              <Avatar name={item.author.displayName} url={item.author.avatarUrl} size={40} ring={colors.white} />
              <View>
                <Text style={styles.white}>{item.author.displayName}</Text>
                <Text variant="caption" style={styles.dim}>{timeAgo(item.createdAt)} ago</Text>
              </View>
            </Pressable>
          </Pressable>
          {/* Under the photo (Instagram): like · comment · save, score on the right with a tiny line under it, then title + description. */}
          <View style={styles.under}>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Like" onPress={() => like(item)} style={styles.action} hitSlop={8}>
                <Icon name="heart" size={24} color={item.myReaction ? colors.accent : colors.fg} />
                {!!item.reactionCount && <Text style={styles.count}>{item.reactionCount}</Text>}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Comments" onPress={() => onComments(item)} style={styles.action} hitSlop={8}>
                <Icon name="comment" size={24} color={colors.fg} />
                {!!item.commentCount && <Text style={styles.count}>{item.commentCount}</Text>}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={saved[String(item.postId)] ? "Saved" : "Save"} onPress={() => save(item)} style={styles.action} hitSlop={8}>
                <Icon name="bookmark" size={24} color={saved[String(item.postId)] ? colors.accent : colors.fg} />
              </Pressable>
              <View style={{ flex: 1 }} />
              <View style={styles.scoreCol} accessibilityLabel={`Score ${item.score.toFixed(1)}`}>
                <View style={[styles.scorePill, { backgroundColor: ratingColor(item.score) }]}>
                  <Text style={styles.scoreText}>{item.score.toFixed(1)}</Text>
                </View>
                <Text style={styles.tiny} numberOfLines={1}>{item.label}</Text>
              </View>
            </View>
            <Pressable onPress={() => openVenue(item.target)} style={{ gap: 2 }}>
              <Text style={styles.title} numberOfLines={1}>{item.target.name}</Text>
              {!!item.caption && <Text style={styles.desc} numberOfLines={2}>{item.caption}</Text>}
            </Pressable>
          </View>
          </View>
        )}
      />
      <View style={styles.controls}>
        <View style={styles.dots}>
          {perFriend.slice(0, 8).map((p, i) => <View key={String(p.postId)} style={[styles.dot, i === index && styles.dotOn]} />)}
        </View>
        {index < perFriend.length - 1 && (
          <Pressable accessibilityRole="button" onPress={() => goTo(index + 1)}>
            <Text style={{ fontWeight: "700" }}>Next friend →</Text>
          </Pressable>
        )}
      </View>
      <Pressable accessibilityRole="button" onPress={onSeeAll} style={styles.seeAll}>
        <Text style={{ fontWeight: "600" }}>{"See all friends' posts"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", backgroundColor: colors.surface, justifyContent: "space-between" },
  shade: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.12)" },
  who: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  under: { paddingHorizontal: spacing.lg, gap: 8 },
  actions: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  action: { flexDirection: "row", alignItems: "center", gap: 5, height: 28 },
  count: { fontSize: 14, fontWeight: "600", color: colors.fg },
  scoreCol: { alignItems: "flex-end", gap: 3, maxWidth: 140 },
  scorePill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  scoreText: { color: colors.white, fontWeight: "800", fontSize: 14 },
  tiny: { fontSize: 10.5, color: colors.muted },
  title: { fontSize: 17, fontWeight: "700", color: colors.fg },
  desc: { fontSize: 14, lineHeight: 19, color: colors.muted },
  white: { color: colors.white, fontWeight: "700", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  dim: { color: "rgba(255,255,255,0.85)" },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dots: { flexDirection: "row", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.fg, width: 16 },
  seeAll: { alignItems: "center", paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
});
