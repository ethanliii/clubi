import { router } from "expo-router";
import { useState } from "react";
import { Alert, Image, Pressable, Share, StyleSheet, View } from "react-native";
import type { ProfileResult } from "../../convex/lib/contract";
import { colors, radius, spacing } from "../theme";
import { Avatar } from "./Bits";
import { Button } from "./Button";
import { FriendButton } from "./FriendButton";
import { Icon } from "./Icon";
import { ScoreBadge } from "./ScoreBadge";
import { Text } from "./Text";
import { Photo, openVenue } from "./VenueCard";

/**
 * Instagram-style profile, shared by mine and someone else's (UI-SPEC §8, §9):
 * counts row, bio, Edit/Share or Add friend/Compare, "memories" highlight circles, photo grid / ranked lists.
 * Pinned favorite photos need a backend field (ask E13); highlights use the top place of each list for now.
 */
export function ProfileView({ profile }: { profile: ProfileResult }) {
  const { user, counts } = profile;
  const [tab, setTab] = useState<"photos" | "lists">("photos");
  const share = () => Share.share({ message: `Find me on Clubi: @${user.username}` }).catch(() => undefined);
  const highlights = profile.lists.map((l) => ({ list: l, item: l.items[0] })).filter((h) => h.item);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.row}>
        <Avatar name={user.displayName} url={user.avatarUrl} size={86} ring={colors.accent} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text variant="title">{user.displayName}</Text>
          <View style={styles.counts}>
            <Count n={counts.posts} label="posts" />
            <Count n={counts.friends} label="friends" onPress={user.isMe ? () => router.push("/friends") : undefined} />
            <Count n={counts.ranked} label="ranked" />
          </View>
        </View>
      </View>
      <View style={{ gap: 2 }}>
        <Text muted>@{user.username}{user.homeCity ? ` · ${user.homeCity}` : ""}</Text>
        {user.bio ? <Text>{user.bio}</Text> : null}
      </View>

      {user.isMe ? (
        <View style={styles.row}>
          <Button title="Edit profile" variant="ghost" style={styles.half}
            onPress={() => Alert.alert("Coming soon", "Profile editing lives in Settings, which is next on the list.")} />
          <Button title="Share profile" variant="ghost" style={styles.half} onPress={share} />
        </View>
      ) : (
        <View style={styles.row}>
          <View style={{ flex: 1 }}><FriendButton userId={user.userId} status={user.status} requestId={user.requestId} /></View>
          <Button title="Compare tastes" variant="ghost" style={styles.half}
            onPress={() => router.push({ pathname: "/compare/[userId]", params: { userId: String(user.userId) } })} />
        </View>
      )}

      {profile.tasteSummary.length > 0 && (
        <View style={styles.meters}>
          {profile.tasteSummary.map((m) => (
            <View key={m.label} style={styles.meterRow}>
              <Text variant="caption" style={{ width: 96 }}>{m.label}</Text>
              <View style={styles.meter}><View style={[styles.meterFill, { width: `${m.pct}%` }]} /></View>
              <Text variant="caption" style={{ width: 36, textAlign: "right" }}>{m.pct}%</Text>
            </View>
          ))}
        </View>
      )}

      {profile.canSee && (
        <View style={styles.highlights}>
          {user.isMe && (
            <Pressable onPress={() => router.push("/rate")} style={styles.hl}>
              <View style={[styles.hlCircle, styles.hlNew]}><Icon name="plus" size={26} color={colors.fg} /></View>
              <Text variant="caption">New</Text>
            </Pressable>
          )}
          {highlights.map(({ list, item }) => (
            <Pressable key={list.category} onPress={() => openVenue(item!)} style={styles.hl}>
              <View style={styles.hlCircle}>
                {item!.imageUrl ? <Image source={{ uri: item!.imageUrl }} style={styles.hlImg} /> : <Photo item={{ category: list.category }} height={66} />}
              </View>
              <Text variant="caption" numberOfLines={1} style={{ textTransform: "capitalize", maxWidth: 76 }}>{list.noun}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!profile.canSee ? (
        <Text muted center>Add friend to see their rankings</Text>
      ) : (
        <>
          <View style={styles.tabs}>
            <Pressable accessibilityLabel="Photos" onPress={() => setTab("photos")} style={[styles.tab, tab === "photos" && styles.tabOn]}>
              <Icon name="feed" size={20} color={tab === "photos" ? colors.fg : colors.muted} />
            </Pressable>
            <Pressable accessibilityLabel="Ranked lists" onPress={() => setTab("lists")} style={[styles.tab, tab === "lists" && styles.tabOn]}>
              <Icon name="check" size={20} color={tab === "lists" ? colors.fg : colors.muted} />
            </Pressable>
          </View>

          {tab === "photos" ? (
            profile.recentPosts.length === 0 ? (
              <Text muted center>{user.isMe ? "Rank a place with a photo and it shows up here." : "No posts yet"}</Text>
            ) : (
              <View style={styles.grid}>
                {profile.recentPosts.map((p) => (
                  <Pressable key={String(p.postId)} onPress={() => openVenue(p.target)} style={styles.cell}>
                    {p.photoUrls[0] ? <Image source={{ uri: p.photoUrls[0] }} style={StyleSheet.absoluteFill} /> : <Photo item={{ category: p.target.category }} height={140} />}
                    <View style={styles.cellTag}><Text style={styles.cellText}>{p.score.toFixed(1)}</Text></View>
                  </Pressable>
                ))}
              </View>
            )
          ) : profile.lists.length === 0 ? (
            user.isMe ? <Button title="Rank your first place" onPress={() => router.push("/rate")} /> : <Text muted center>No rankings yet</Text>
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
        </>
      )}
    </View>
  );
}

function Count({ n, label, onPress }: { n: number; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flex: 1 }}>
      <Text style={{ fontWeight: "700", fontSize: 17 }}>{n.toLocaleString()}</Text>
      <Text variant="caption">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  counts: { flexDirection: "row" },
  half: { flex: 1, width: "auto" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meters: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, gap: 8 },
  meterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  meter: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.raised, overflow: "hidden" },
  meterFill: { height: "100%", backgroundColor: colors.accent },
  highlights: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  hl: { alignItems: "center", gap: 4 },
  hlCircle: { width: 66, height: 66, borderRadius: 33, overflow: "hidden", borderWidth: 2, borderColor: colors.line },
  hlNew: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  hlImg: { width: "100%", height: "100%" },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabOn: { borderBottomWidth: 2, borderBottomColor: colors.fg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 2, marginHorizontal: -spacing.lg },
  cell: { width: "33%", aspectRatio: 0.75, overflow: "hidden", backgroundColor: colors.surface },
  cellTag: { position: "absolute", left: 6, bottom: 6, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, paddingHorizontal: 6 },
  cellText: { color: colors.white, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  rank: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  pos: { width: 22, fontWeight: "700", color: colors.muted },
});
