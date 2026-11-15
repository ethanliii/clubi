import { router } from "expo-router";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Alert, Image, Pressable, Share, StyleSheet, Switch, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { ProfileResult } from "../../convex/lib/contract";
import { colors, spacing } from "../theme";
import { Avatar } from "./Bits";
import { Button } from "./Button";
import { FriendButton } from "./FriendButton";
import { Icon } from "./Icon";
import { ScoreBadge } from "./ScoreBadge";
import { Text } from "./Text";
import { Photo, openVenue } from "./VenueCard";

/**
 * Instagram-style profile, shared by mine and someone else's (UI-SPEC §8, §9):
 * counts row, bio, Edit/Share or Add friend/Compare, Favorites (pinned photos), Top spots, photo grid / ranked lists.
 * Kept light on purpose: no taste meters or night-out stats here (those live on Compare).
 */
export function ProfileView({ profile }: { profile: ProfileResult }) {
  const { user, counts } = profile;
  const [tab, setTab] = useState<"photos" | "lists">("photos");
  const pins = useQuery(api.onboarding.pins, { userId: user.userId });
  const setPins = useMutation(api.onboarding.setPins);
  // Hold a photo in your grid to pin / unpin it as a favorite (max 6, backend enforces).
  const togglePin = (postId: Id<"posts">) => {
    const cur = pins ?? [];
    const next = cur.includes(postId) ? cur.filter((x) => x !== postId) : [...cur, postId];
    setPins({ postIds: next }).catch((e: unknown) => Alert.alert("Couldn't pin", e instanceof Error ? e.message : "Try again"));
  };
  const share = () => Share.share({ message: `Find me on Clubi: @${user.username}` }).catch(() => undefined);
  // Top spots = the #1 of each of their lists, in the backend's list order (no re-ranking here).
  const topSpots = profile.lists.map((l) => ({ list: l, item: l.items[0] })).filter((h) => h.item).slice(0, 3);

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

      <FollowBar userId={user.userId} isMe={user.isMe} />

      {profile.canSee && <Favorites profile={profile} />}

      {profile.canSee && topSpots.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text variant="label">Top spots</Text>
          <View style={styles.row}>
            {topSpots.map(({ list, item }) => (
              <Pressable key={list.category} onPress={() => openVenue(item!)} style={styles.spot}>
                <View style={styles.spotImg}>
                  {item!.imageUrl ? <Image source={{ uri: item!.imageUrl }} style={StyleSheet.absoluteFill} /> : <Photo item={{ category: list.category }} height={110} />}
                  <View style={styles.cellTag}><Text style={styles.cellText}>{item!.score.toFixed(1)}</Text></View>
                </View>
                <Text style={{ fontWeight: "700" }} numberOfLines={1}>{item!.name}</Text>
                <Text variant="caption" muted numberOfLines={1}>#1 {list.noun}</Text>
              </Pressable>
            ))}
          </View>
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
                  <Pressable key={String(p.postId)} onPress={() => openVenue(p.target)} onLongPress={user.isMe ? () => togglePin(p.postId) : undefined} style={styles.cell}>
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

/**
 * Favorites: big photos up top. Pinned posts (onboarding.pins) in pin order; until someone pins,
 * their newest photo posts (backend order). Hold a grid photo on your own profile to pin.
 */
function Favorites({ profile }: { profile: ProfileResult }) {
  const pins = useQuery(api.onboarding.pins, { userId: profile.user.userId });
  if (pins === undefined) return null;
  const withPhoto = profile.recentPosts.filter((p) => p.photoUrls[0]);
  const pinned = pins.map((id) => withPhoto.find((p) => p.postId === id)).filter((p) => p !== undefined);
  const shown = (pinned.length ? pinned : withPhoto).slice(0, 3);
  if (shown.length === 0) return null;
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.between}>
        <Text variant="label">Favorites</Text>
        {profile.user.isMe && <Text variant="caption" muted>{pinned.length ? "Hold a photo below to change" : "Hold a photo below to pin"}</Text>}
      </View>
      <View style={styles.favs}>
        {shown.map((p, i) => (
          <Pressable key={String(p.postId)} onPress={() => openVenue(p.target)} style={[styles.fav, i === 0 && shown.length === 3 && styles.favBig]}>
            <Image source={{ uri: p.photoUrls[0] }} style={StyleSheet.absoluteFill} />
            <View style={styles.favCap}><Text style={styles.cellText} numberOfLines={1}>{p.target.name}</Text></View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Public accounts (Q20): followers / following, Follow button for others, Public switch for me. */
function FollowBar({ userId, isMe }: { userId: ProfileResult["user"]["userId"]; isMe: boolean }) {
  const status = useQuery(api.follows.status, { userId });
  const follow = useMutation(api.follows.follow);
  const unfollow = useMutation(api.follows.unfollow);
  const setPublic = useMutation(api.follows.setPublic);
  if (!status) return null;
  const run = (p: Promise<unknown>) => p.catch((e: unknown) => Alert.alert("Something went wrong", e instanceof Error ? e.message : "Try again"));
  return (
    <View style={[styles.row, { flexWrap: "wrap" }]}>
      {(status.isPublic || isMe) && (
        <Text muted>
          <Text style={{ fontWeight: "700" }}>{status.followers}</Text> followers · <Text style={{ fontWeight: "700" }}>{status.following}</Text> following
        </Text>
      )}
      <View style={{ flex: 1 }} />
      {isMe ? (
        <View style={styles.row}>
          <Text variant="caption" muted>Public account</Text>
          <Switch value={status.isPublic} onValueChange={(v) => void run(setPublic({ isPublic: v }))} accessibilityLabel="Public account" />
        </View>
      ) : status.isPublic ? (
        <Button title={status.iFollow ? "Following" : "Follow"} variant={status.iFollow ? "ghost" : "primary"} style={{ width: "auto", paddingVertical: 8, paddingHorizontal: 16 }}
          onPress={() => run(status.iFollow ? unfollow({ userId }) : follow({ userId }))} />
      ) : null}
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
  favs: { flexDirection: "row", gap: 4, height: 220 },
  fav: { flex: 1, overflow: "hidden", backgroundColor: colors.surface, borderRadius: 4 },
  favBig: { flex: 1.6 },
  favCap: { position: "absolute", left: 6, right: 6, bottom: 6 },
  spot: { flex: 1, gap: 3 },
  spotImg: { height: 110, overflow: "hidden", borderRadius: 4, backgroundColor: colors.surface },
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
