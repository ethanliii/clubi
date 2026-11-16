import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import type { Filter, NearbyItem } from "../../../convex/lib/contract";
import { AvatarStack, Chip, EmptyState, Icon, ScoreBadge, Skeleton, Text, ThemeToggle, formatDistance, openVenue } from "../../components/bryan";
import { MapSurface } from "../../features/map/MapSurface";
import { PlacePeek } from "../../features/map/PlacePeek";
import { useDemoLocation } from "../../lib/demoLocation";
import { useNearby } from "../../lib/useNearby";
import { colors, radius, spacing } from "../../theme";

/** "Near me" looks within about a 15-minute walk. */
const NEAR_ME_METERS = 1500;

const FILTERS: { f: Filter; label: string }[] = [
  { f: "tonight", label: "Tonight" }, { f: "bars", label: "Bars" }, { f: "food", label: "Food" },
  { f: "events", label: "Events" }, { f: "popups", label: "Pop-ups" }, { f: "outdoors", label: "Outdoors" }, { f: "all", label: "All" },
];

/** Map tab. UI-SPEC §4. Items arrive ranked; the sheet shows the selected place or the ranked list. */
export default function MapScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const all = useNearby(filter);
  const { lat, lng, ready, isDemo, setDemo } = useDemoLocation();
  // Near me: events close by, ranked by the backend on fit + distance + timing (no re-sorting here).
  // Search → "Near me" opens the map with it already on.
  const params = useLocalSearchParams<{ nearMe?: string }>();
  const [nearMe, setNearMe] = useState(params.nearMe === "1");
  const near = useQuery(api.discover.nearby, nearMe && ready ? { lat, lng, filter: "events", radiusMeters: NEAR_ME_METERS } : "skip");
  const nearby = nearMe ? near : all;
  const [selected, setSelected] = useState<NearbyItem | null>(null);
  const [recenter, setRecenter] = useState(0);
  const [zoom, setZoom] = useState<{ key: number; dir: 1 | -1 }>({ key: 0, dir: 1 });
  // Drag the list down to hide it (only the handle stays), drag up or tap the handle to bring it back.
  const [hidden, setHidden] = useState(false);
  const [drag] = useState(() => new Animated.Value(0));
  // Two fixed gesture handlers (one for "shown", one for "hidden"), so nothing mutable is read during render.
  const [pans] = useState(() => {
    const make = (fromHidden: boolean) => PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => drag.setValue(fromHidden ? Math.min(0, g.dy) : Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        setHidden(fromHidden ? !(g.dy < -40 || g.vy < -0.5) : g.dy > 60 || g.vy > 0.5);
        Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    });
    return { shown: make(false), hidden: make(true) };
  });
  const toggleSheet = () => setHidden(!hidden);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const results = useQuery(api.places.search, ready && query.length >= 2 ? { text: query, lat, lng } : "skip");

  const center = nearby?.center ?? { lat, lng };

  return (
    <View style={styles.root}>
      <MapSurface items={nearby?.items ?? []} center={center} selectedId={selected ? String(selected.id) : null}
        onSelect={(i) => { setSelected(i); if (i && hidden) setHidden(false); }} recenterKey={recenter} zoom={zoom} />

      <SafeAreaView edges={["top"]} style={styles.top} pointerEvents="box-none">
        <View style={styles.search}>
          <Icon name="search" size={16} color={colors.muted} />
          <TextInput style={styles.input} placeholder="Search places and events" placeholderTextColor={colors.muted}
            value={text} onChangeText={setText} />
        </View>
        {query.length >= 2 && (
          <View style={styles.results}>
            {results === undefined ? <Skeleton height={60} /> : results.length === 0 ? <Text muted>No matches</Text> : (
              results.map((r) => (
                <Pressable key={String(r.id)} onPress={() => { setText(""); setSelected(r); }} style={styles.resultRow}>
                  <Text style={{ flex: 1 }} numberOfLines={1}>{r.name}</Text>
                  <ScoreBadge score={r.score} size="sm" />
                </Pressable>
              ))
            )}
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable accessibilityRole="button" accessibilityLabel="Near me" accessibilityState={{ selected: nearMe }}
            onPress={() => { setNearMe(!nearMe); setSelected(null); setRecenter(recenter + 1); }}
            style={[styles.nearMe, nearMe && styles.nearMeOn]}>
            <Icon name="spark" size={14} color={nearMe ? colors.white : colors.fg} />
            <Text style={{ fontWeight: "700", color: nearMe ? colors.white : colors.fg }}>Near me</Text>
          </Pressable>
          {FILTERS.map((x) => (
            <Chip key={x.f} label={x.label} accessibilityLabel={`Filter: ${x.label}`} on={!nearMe && filter === x.f}
              onPress={() => { setNearMe(false); setFilter(x.f); setSelected(null); }} />
          ))}
        </ScrollView>
      </SafeAreaView>

      <View style={[styles.controls, { bottom: hidden ? 110 : selected ? 520 : 330 }]} pointerEvents="box-none">
        <ThemeToggle size={42} />
        <View style={styles.zoomBox}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => setZoom({ key: zoom.key + 1, dir: 1 })} style={styles.zoomBtn}>
            <Icon name="plus" size={18} color={colors.fg} />
          </Pressable>
          <View style={styles.zoomLine} />
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => setZoom({ key: zoom.key + 1, dir: -1 })} style={styles.zoomBtn}>
            <Icon name="minus" size={18} color={colors.fg} />
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Recenter" onPress={() => setRecenter(recenter + 1)} style={styles.round}>
          <Icon name="navigate" size={18} color={colors.fg} />
        </Pressable>
      </View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: drag }] }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={hidden ? "Show list" : "Hide list"} onPress={toggleSheet}
          {...(hidden ? pans.hidden : pans.shown).panHandlers} style={styles.grab}>
          <View style={styles.handle} />
          {hidden && (
            <Text variant="caption" muted center>
              {nearby ? `${nearby.items.length} ${nearMe ? "events near you" : "places"} · drag up for the list` : "Loading…"}
            </Text>
          )}
        </Pressable>
        {!hidden && (
        <>
        {!selected && <Legend />}
        <ScrollView style={{ maxHeight: selected ? 460 : 260 }} contentContainerStyle={{ gap: spacing.sm }}>
          {nearMe && !selected && (
            <View style={styles.nearHead}>
              <Text variant="title">Events near you</Text>
              <Text variant="caption" muted>Best fit for your taste first, closer ones bumped up</Text>
            </View>
          )}
          {selected ? (
            <PlacePeek item={selected} onClose={() => setSelected(null)} />
          ) : nearby === undefined ? (
            <Skeleton height={120} />
          ) : nearby.items.length === 0 ? (
            <EmptyState text={nearMe ? "No events close by right now. Try Events for the whole area." : "Nothing here yet. We're loading places for this area."} />
          ) : (
            nearby.items.slice(0, 12).map((item) => (
              <Pressable key={String(item.id)} onPress={() => setSelected(item)} onLongPress={() => openVenue(item)} style={styles.row}>
                <Text style={styles.rank}>{item.rank}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600" }} numberOfLines={1}>{item.name}</Text>
                  <Text variant="caption" muted numberOfLines={1}>
                    {item.why} · {item.matchPct}% · {formatDistance(item.distanceMeters)}{item.openNow ? " · Open now" : ""}
                  </Text>
                </View>
                <WhoRated item={item} />
              </Pressable>
            ))
          )}
        </ScrollView>
        </>
        )}
        <View style={styles.footer}>
          <Text variant="caption" muted style={{ flex: 1 }}>{nearby?.attribution ?? "© OpenStreetMap contributors"}</Text>
          <Text variant="caption" muted>Demo location</Text>
          <Switch value={isDemo} onValueChange={setDemo} accessibilityLabel="Demo location" />
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * Who the score is from: friends' faces + the top friend's score (pink ring), or the public
 * average (grey, people icon) when no friend has rated it, else the "for you" prediction.
 */
function WhoRated({ item }: { item: NearbyItem }) {
  const friend = item.friends[0];
  if (friend) {
    return (
      <View style={[styles.who, styles.whoFriend]}>
        <AvatarStack people={item.friends} size={18} />
        <Text style={[styles.whoScore, { color: colors.fg }]}>{friend.score.toFixed(1)}</Text>
      </View>
    );
  }
  if (item.publicScore !== undefined) {
    return (
      <View style={[styles.who, styles.whoPublic]}>
        <Icon name="users" size={13} color={colors.muted} />
        <Text style={[styles.whoScore, { color: colors.muted }]}>{item.publicScore.toFixed(1)}</Text>
      </View>
    );
  }
  return <ScoreBadge score={item.score} size="sm" />;
}

function Legend() {
  return (
    <View style={styles.legend}>
      <View style={[styles.who, styles.whoFriend]}><View style={styles.legendDot} /><Text variant="caption">Friends</Text></View>
      <View style={[styles.who, styles.whoPublic]}><Icon name="users" size={12} color={colors.muted} /><Text variant="caption" muted>Public</Text></View>
      <View style={styles.who}><ScoreBadge score={8} size="sm" /><Text variant="caption" muted>For you</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: spacing.md, gap: 8 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 12, marginTop: 4 },
  input: { flex: 1, color: colors.fg, paddingVertical: 11 },
  results: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 8, gap: 4 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  chips: { gap: 8, alignItems: "center" },
  nearMe: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent },
  nearMeOn: { backgroundColor: colors.accent },
  nearHead: { gap: 2, paddingBottom: 4 },
  controls: { position: "absolute", right: 14, gap: 10, alignItems: "center" },
  zoomBox: { borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  zoomBtn: { width: 42, height: 40, alignItems: "center", justifyContent: "center" },
  zoomLine: { height: 1, backgroundColor: colors.line },
  grab: { paddingVertical: 6, gap: 6 },
  who: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 },
  whoFriend: { borderWidth: 1.5, borderColor: colors.accent },
  whoPublic: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  whoScore: { fontWeight: "800", fontSize: 13 },
  legend: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  legendDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: spacing.md, gap: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  rank: { width: 22, fontWeight: "700", color: colors.muted },
  footer: { flexDirection: "row", alignItems: "center", gap: 8 },
});
