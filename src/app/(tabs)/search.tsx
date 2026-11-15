import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { NearbyItem } from "../../../convex/lib/contract";
import {
  Avatar, AvatarStack, Button, Chip, EmptyState, Icon, Screen, Skeleton, Text, VenueCard,
} from "../../components/bryan";
import { SearchMode } from "../../features/search/SearchMode";
import { paths } from "../../lib/links";
import { useDemoLocation } from "../../lib/demoLocation";
import { colors, radius, spacing } from "../../theme";

const VIBES = ["Chill", "Balanced", "Wild"] as const;

/**
 * Search tab (was Home): describe your night, "Going with" friends, tonight's picks.
 * Every list and score comes from the backend. UI-SPEC §3 rows live here now (decision Q10).
 */
export default function Search() {
  const { lat, lng, ready } = useDemoLocation();
  const me = useQuery(api.users.me);
  const unread = useQuery(api.notifications.unreadCount, {});
  // Tapping the search box opens full search (Spotify / Beli style, features/search/SearchMode).
  const [searching, setSearching] = useState(false);
  const [vibe, setVibe] = useState<(typeof VIBES)[number] | null>(null);
  const [group, setGroup] = useState<Id<"users">[]>([]);
  const [picking, setPicking] = useState(false);

  const loc = ready ? { lat, lng } : null;
  const tonight = useQuery(api.discover.tonight, loc && !group.length ? loc : "skip");
  const groupPicks = useQuery(api.discover.forGroup, loc && group.length ? { ...loc, memberIds: group } : "skip");
  const friends = useQuery(api.friends.list, {});

  const day = new Date().toLocaleDateString([], { weekday: "short" });
  const picks: NearbyItem[] | undefined = group.length ? groupPicks?.items : tonight?.topPicks;
  const groupNames = (friends?.friends ?? []).filter((f) => group.includes(f.userId));

  if (searching) {
    return (
      <Screen>
        <SearchMode onCancel={() => setSearching(false)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.between}>
        <View>
          <Text variant="label">{me?.homeCity ?? "Near you"} · {day}</Text>
          <Text variant="heading">Search</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push("/notifications")} style={styles.iconButton}>
          <Icon name="bell" size={18} color={colors.fg} />
          {!!unread && <Text style={styles.badge}>{unread > 99 ? "99+" : unread}</Text>}
        </Pressable>
      </View>

      <Pressable accessibilityRole="search" accessibilityLabel="Describe your night" onPress={() => setSearching(true)} style={styles.search}>
        <Icon name="search" size={17} color={colors.muted} />
        <Text muted style={{ flex: 1, paddingVertical: 12 }}>Search places, events, people</Text>
      </Pressable>

      {(
        <>
          <View style={{ gap: spacing.sm }}>
            <Text variant="title">What are you in the mood for?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {VIBES.map((v) => (
                <Chip key={v} label={v} on={vibe === v} onPress={() => setVibe(vibe === v ? null : v)} />
              ))}
              <Chip label="📍 Near me" onPress={() => router.push("/map")} />
            </ScrollView>
            <View style={styles.going}>
              <Text variant="label">Going with</Text>
              {groupNames.length ? <AvatarStack people={groupNames} /> : null}
              <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                {groupNames.length ? groupNames.map((f) => f.displayName.split(" ")[0]).join(", ") : "Just you"}
              </Text>
              <Chip label={group.length ? "Edit" : "+ Add friends"} onPress={() => setPicking(true)} />
            </View>
          </View>

          {picks === undefined ? (
            <Skeleton height={300} />
          ) : picks.length === 0 ? (
            <EmptyState text="Nothing nearby yet. Try the map." action={<Button title="Open map" variant="ghost" onPress={() => router.push("/map")} />} />
          ) : (
            <>
              <VenueCard item={picks[0]!} big tag={group.length ? "#1 for your group" : "#1 for you tonight"} />
              <Row items={picks.slice(1, 8)} />
            </>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/plan", params: vibe ? { vibe: vibe.toLowerCase() } : {} })}
            style={styles.banner}
          >
            <View style={{ flex: 1 }}>
              <Text variant="title">Plan my night</Text>
              <Text variant="caption" muted>Three stops{group.length ? " for the group" : ""}, ranked for you</Text>
            </View>
            <View style={[styles.iconButton, { backgroundColor: colors.accent }]}>
              <Icon name="spark" size={18} color={colors.white} />
            </View>
          </Pressable>
          {/* Same quick links as main's old Home: Trips + Saved. */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {([["Trips", "calendar", paths.trips], ["Saved", "bookmark", paths.saved]] as const).map(([label, icon, href]) => (
              <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(href)} style={[styles.banner, { flex: 1, paddingVertical: 12, backgroundColor: colors.surface }]}>
                <Icon name={icon} size={18} color={colors.fg} />
                <Text style={{ fontWeight: "600", flex: 1 }}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {!group.length && tonight && (
            <>
              <Section title="Friends went here" items={tonight.friendsGoing} />
              <Section title="Events tonight" items={tonight.events} />
            </>
          )}
        </>
      )}

      <Modal visible={picking} transparent animationType="slide" onRequestClose={() => setPicking(false)}>
        <View style={styles.dim}>
          <View style={styles.sheet}>
            <Text variant="title">{"Who's coming?"}</Text>
            <Text variant="caption" muted>Picks get ranked for everyone you add.</Text>
            {friends === undefined ? (
              <Skeleton height={120} />
            ) : friends.friends.length === 0 ? (
              <EmptyState text="Add friends to plan together." />
            ) : (
              friends.friends.map((f) => {
                const on = group.includes(f.userId);
                return (
                  <Pressable key={f.userId} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                    onPress={() => setGroup(on ? group.filter((g) => g !== f.userId) : [...group, f.userId])} style={styles.friendRow}>
                    <Avatar name={f.displayName} url={f.avatarUrl} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "600" }}>{f.displayName}</Text>
                      {f.tasteMatchPct !== undefined && <Text variant="caption" muted>{f.tasteMatchPct}% taste match</Text>}
                    </View>
                    <View style={[styles.check, on && styles.checkOn]}>{on && <Icon name="check" size={14} color={colors.bg} />}</View>
                  </Pressable>
                );
              })
            )}
            <Button title={group.length ? `Rank for ${group.length + 1} people` : "Done"} onPress={() => setPicking(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Row({ items }: { items: NearbyItem[] }) {
  if (!items.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
      {items.map((item) => <VenueCard key={String(item.id)} item={item} />)}
    </ScrollView>
  );
}

function Section({ title, items }: { title: string; items: NearbyItem[] }) {
  if (!items.length) return null; // empty rows are hidden (UI-SPEC §3)
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="title">{title}</Text>
      <Row items={items} />
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -4, right: -6, backgroundColor: colors.accent, color: colors.white, fontSize: 10, lineHeight: 14, paddingHorizontal: 5, borderRadius: 8, overflow: "hidden" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, paddingHorizontal: 12 },
  input: { flex: 1, color: colors.fg, paddingVertical: 12, fontSize: 14 },
  result: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 2 },
  chips: { gap: 8 },
  going: { flexDirection: "row", alignItems: "center", gap: 8 },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: 16, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.accentSoft },
  dim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, gap: 10, maxHeight: "80%" },
  friendRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: colors.fg, borderColor: colors.fg },
});
