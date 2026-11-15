import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { NearbyItem, UserSearchResult } from "../../../convex/lib/contract";
import { Avatar, EmptyState, FriendButton, Icon, Photo, Skeleton, Text, formatDistance, openVenue } from "../../components/bryan";
import { useDemoLocation } from "../../lib/demoLocation";
import { paths } from "../../lib/links";
import { addRecent, recentKey, removeRecent, useRecentSearches, type Recent } from "../../lib/recentSearches";
import { colors, radius, spacing } from "../../theme";

type Tab = "places" | "people";

/**
 * Full search (references: Spotify search + Beli search). Cancel at the top, Places / People tabs,
 * the location being searched, quick pills, then Recent searches (this device) or live results.
 * Results and their order come from the backend (places.search, friends.search).
 */
export function SearchMode({ onCancel }: { onCancel: () => void }) {
  const { lat, lng, ready, isDemo } = useDemoLocation();
  const [tab, setTab] = useState<Tab>("places");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);
  const searching = query.length >= 2;
  const places = useQuery(api.places.search, ready && searching && tab === "places" ? { text: query, lat, lng } : "skip");
  const people = useQuery(api.friends.search, searching && tab === "people" ? { text: query } : "skip");
  const recents = useRecentSearches().filter((r) => (tab === "places" ? r.type === "place" : r.type === "person"));

  const toggle = useMutation(api.saves.toggle);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const save = (kind: "place" | "event", id: string) =>
    toggle({ kind, id: id as Id<"places"> | Id<"events">, type: "want" }).then(
      (r) => setSaved((m) => ({ ...m, [id]: r.saved })),
      (e: unknown) => Alert.alert("Couldn't save", e instanceof Error ? e.message : "Try again"),
    );

  const openPlace = (p: NearbyItem) => {
    addRecent({ type: "place", kind: p.kind, id: String(p.id), name: p.name, sub: placeSub(p), imageUrl: p.imageUrl, category: p.category });
    openVenue(p);
  };
  const openPerson = (u: UserSearchResult) => {
    addRecent({ type: "person", userId: String(u.userId), name: u.displayName, sub: `@${u.username}`, avatarUrl: u.avatarUrl });
    router.push({ pathname: "/user/[userId]", params: { userId: String(u.userId) } });
  };
  const openRecent = (r: Recent) => {
    addRecent(r);
    if (r.type === "place") router.push({ pathname: "/venue/[kind]/[id]", params: { kind: r.kind, id: r.id } });
    else router.push({ pathname: "/user/[userId]", params: { userId: r.userId } });
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.top}>
        <View style={styles.box}>
          <Icon name="search" size={17} color={colors.muted} />
          <TextInput style={styles.input} autoFocus value={text} onChangeText={setText} returnKeyType="search"
            placeholder={tab === "places" ? "Search a place, vibe, or event" : "Search people by name or @username"}
            placeholderTextColor={colors.muted} accessibilityLabel="Describe your night" />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onCancel} style={styles.cancel}>
          <Text style={{ fontWeight: "600" }}>Cancel</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(["places", "people"] as const).map((t) => (
          <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
            <Icon name={t === "places" ? "map" : "users"} size={16} color={tab === t ? colors.fg : colors.muted} />
            <Text style={{ fontWeight: "700", color: tab === t ? colors.fg : colors.muted }}>{t === "places" ? "Places" : "People"}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "places" && (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Search location" onPress={() => router.push(paths.map)} style={styles.loc}>
            <Icon name="locate" size={16} color={colors.muted} />
            <Text style={{ flex: 1 }}>{isDemo ? "Demo location" : "Current location"}</Text>
            <Text variant="caption" muted>Change</Text>
          </Pressable>
          <View style={styles.pills}>
            <Pill label="Near me" icon="navigate" onPress={() => router.push({ pathname: "/map", params: { nearMe: "1" } })} />
            <Pill label="Want to go" icon="bookmark" onPress={() => router.push(paths.saved)} />
            <Pill label="Plan my night" icon="spark" onPress={() => router.push(paths.plan)} />
          </View>
        </>
      )}

      {!searching ? (
        recents.length === 0 ? (
          <Text muted center style={{ marginTop: spacing.lg }}>
            {tab === "places" ? "Places you open from search show up here." : "People you look up show up here."}
          </Text>
        ) : (
          <View>
            <Text variant="title" style={{ marginBottom: 4 }}>Recent searches</Text>
            {recents.map((r) => (
              <Row key={recentKey(r)} onPress={() => openRecent(r)}
                thumb={r.type === "place"
                  ? <Thumb url={r.imageUrl} category={r.category as NearbyItem["category"]} />
                  : <Avatar name={r.name} url={r.avatarUrl} size={48} />}
                title={r.name} sub={r.type === "place" ? r.sub : `Person · ${r.sub}`}
                right={
                  <>
                    {r.type === "place" && <SaveButton on={!!saved[r.id]} onPress={() => void save(r.kind, r.id)} />}
                    <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${r.name}`} onPress={() => removeRecent(r)} hitSlop={10}>
                      <Icon name="close" size={18} color={colors.muted} />
                    </Pressable>
                  </>
                } />
            ))}
          </View>
        )
      ) : tab === "places" ? (
        places === undefined ? <Skeleton height={160} /> : places.length === 0 ? <EmptyState text="No matches" /> : (
          places.map((p) => (
            <Row key={String(p.id)} onPress={() => openPlace(p)} thumb={<Thumb url={p.imageUrl} category={p.category} />}
              title={p.name} sub={placeSub(p)}
              right={<SaveButton on={!!saved[String(p.id)]} onPress={() => void save(p.kind, String(p.id))} />} />
          ))
        )
      ) : people === undefined ? <Skeleton height={160} /> : people.length === 0 ? <EmptyState text="Nobody by that name yet" /> : (
        people.map((u) => (
          <Row key={String(u.userId)} onPress={() => openPerson(u)} thumb={<Avatar name={u.displayName} url={u.avatarUrl} size={48} />}
            title={u.displayName} sub={`@${u.username}${u.mutualCount ? ` · ${u.mutualCount} mutual` : ""}`}
            right={u.status === "self" ? null : <FriendButton userId={u.userId} status={u.status} requestId={u.requestId} compact />} />
        ))
      )}
    </View>
  );
}

/** "Bar · 0.4 mi" (formatting only; the distance comes from the backend). */
function placeSub(p: NearbyItem): string {
  return [p.kind === "event" ? "Event" : "Place", p.subcategory ?? p.category, formatDistance(p.distanceMeters)].filter(Boolean).join(" · ");
}

function Row({ thumb, title, sub, right, onPress }: { thumb: React.ReactNode; title: string; sub: string; right: React.ReactNode; onPress: () => void }) {
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.rowMain}>
        {thumb}
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600", fontSize: 16 }} numberOfLines={1}>{title}</Text>
          <Text variant="caption" muted numberOfLines={1}>{sub}</Text>
        </View>
      </Pressable>
      <View style={styles.rowRight}>{right}</View>
    </View>
  );
}

function Thumb({ url, category }: { url?: string; category: NearbyItem["category"] }) {
  return (
    <View style={styles.thumb}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} /> : <Photo item={{ category }} height={48} />}
    </View>
  );
}

/** ⊕ = add to Want to go, green ✓ = saved (Spotify's add / added). */
function SaveButton({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={on ? "Saved" : "Want to go"} onPress={onPress} hitSlop={8}
      style={[styles.save, on && styles.saveOn]}>
      <Icon name={on ? "check" : "plus"} size={14} color={on ? colors.bg : colors.fg} />
    </Pressable>
  );
}

function Pill({ label, icon, onPress }: { label: string; icon: "navigate" | "bookmark" | "spark"; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.pill}>
      <Icon name={icon} size={14} color={colors.white} />
      <Text style={{ color: colors.white, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  box: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line },
  input: { flex: 1, color: colors.fg, paddingVertical: 11, fontSize: 15 },
  cancel: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surface },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  tabOn: { borderBottomWidth: 2, borderBottomColor: colors.fg },
  loc: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.accent },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  thumb: { width: 48, height: 48, borderRadius: 8, overflow: "hidden", backgroundColor: colors.surface },
  save: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.fg, alignItems: "center", justifyContent: "center" },
  saveOn: { backgroundColor: colors.ok, borderColor: colors.ok },
});
