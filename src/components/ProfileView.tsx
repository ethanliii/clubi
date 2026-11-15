import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import type { ProfileResult } from "../../convex/lib/contract";
import { colors, radius, spacing } from "../theme";
import { Avatar, Chip } from "./Bits";
import { Button } from "./Button";
import { FriendButton } from "./FriendButton";
import { ScoreBadge } from "./ScoreBadge";
import { Text } from "./Text";
import { openVenue } from "./VenueCard";

/** Shared by my profile and someone else's. Renders ProfileResult as returned (UI-SPEC §8, §9). */
export function ProfileView({ profile }: { profile: ProfileResult }) {
  const { user, counts } = profile;
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.row}>
        <Avatar name={user.displayName} url={user.avatarUrl} size={72} ring={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text variant="heading" style={{ fontSize: 22 }}>{user.displayName}</Text>
          <Text muted>@{user.username}{user.homeCity ? ` · ${user.homeCity}` : ""}</Text>
        </View>
      </View>
      {user.bio ? <Text>{user.bio}</Text> : null}
      <Text muted>
        <Text style={{ fontWeight: "700" }}>{counts.ranked}</Text> ranked ·{" "}
        <Text style={{ fontWeight: "700" }}>{counts.friends}</Text> friends ·{" "}
        <Text style={{ fontWeight: "700" }}>{counts.posts}</Text> posts
      </Text>

      {!user.isMe && (
        <View style={{ gap: 8 }}>
          <FriendButton userId={user.userId} status={user.status} requestId={user.requestId} />
          <Button title="Compare tastes" variant="ghost"
            onPress={() => router.push({ pathname: "/compare/[userId]", params: { userId: String(user.userId) } })} />
        </View>
      )}

      {profile.tasteSummary.length > 0 && (
        <View style={styles.card}>
          {profile.tasteSummary.map((m) => (
            <View key={m.label} style={styles.meterRow}>
              <Text variant="caption" style={{ width: 96 }}>{m.label}</Text>
              <View style={styles.meter}><View style={[styles.meterFill, { width: `${m.pct}%` }]} /></View>
              <Text variant="caption" style={{ width: 36, textAlign: "right" }}>{m.pct}%</Text>
            </View>
          ))}
        </View>
      )}

      {!profile.canSee ? (
        <Text muted center>Add friend to see their rankings</Text>
      ) : (
        profile.lists.map((list) => (
          <View key={list.category} style={{ gap: 4 }}>
            <View style={styles.between}>
              <Text variant="title" style={{ textTransform: "capitalize" }}>{list.noun}</Text>
              {user.isMe && (
                <Pressable onPress={() => router.push({ pathname: "/rankings", params: { category: list.category } })}>
                  <Text muted>See all ▶</Text>
                </Pressable>
              )}
            </View>
            {list.items.slice(0, 5).map((item) => (
              <Pressable key={String(item.rankingId)} onPress={() => openVenue(item)} style={styles.rank}>
                <Text style={styles.pos}>{item.position}</Text>
                <Text style={{ flex: 1 }} numberOfLines={1}>{item.name}</Text>
                <ScoreBadge score={item.score} size="sm" />
              </Pressable>
            ))}
          </View>
        ))
      )}
      {profile.canSee && profile.lists.length === 0 && (
        user.isMe ? <Button title="Rank your first place" onPress={() => router.push("/rate")} /> : <Text muted center>No rankings yet</Text>
      )}
      {profile.recentPosts.length > 0 && (
        <View style={styles.chips}>
          {profile.recentPosts.slice(0, 6).map((p) => (
            <Chip key={String(p.postId)} label={`${p.target.name} · ${p.score.toFixed(1)}`} onPress={() => openVenue(p.target)} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, gap: 8 },
  meterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  meter: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.raised, overflow: "hidden" },
  meterFill: { height: "100%", backgroundColor: colors.accent },
  rank: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  pos: { width: 22, fontWeight: "700", color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
});
