import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import type { Filter, NearbyItem } from "../../../convex/lib/contract";
import { Chip, EmptyState, Icon, ScoreBadge, Skeleton, Text, formatDistance, openVenue } from "../../components/bryan";
import { MapSurface } from "../../features/map/MapSurface";
import { PlacePeek } from "../../features/map/PlacePeek";
import { useDemoLocation } from "../../lib/demoLocation";
import { useNearby } from "../../lib/useNearby";
import { colors, radius, spacing } from "../../theme";

const FILTERS: { f: Filter; label: string }[] = [
  { f: "tonight", label: "Tonight" }, { f: "bars", label: "Bars" }, { f: "food", label: "Food" },
  { f: "events", label: "Events" }, { f: "popups", label: "Pop-ups" }, { f: "outdoors", label: "Outdoors" }, { f: "all", label: "All" },
];

/** Map tab. UI-SPEC §4. Items arrive ranked; the sheet shows the selected place or the ranked list. */
export default function MapScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const nearby = useNearby(filter);
  const { lat, lng, ready, isDemo, setDemo } = useDemoLocation();
  const [selected, setSelected] = useState<NearbyItem | null>(null);
  const [recenter, setRecenter] = useState(0);
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
        onSelect={setSelected} recenterKey={recenter} />

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
          {FILTERS.map((x) => (
            <Chip key={x.f} label={x.label} accessibilityLabel={`Filter: ${x.label}`} on={filter === x.f}
              onPress={() => { setFilter(x.f); setSelected(null); }} />
          ))}
        </ScrollView>
      </SafeAreaView>

      <View style={styles.controls} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel="Recenter" onPress={() => setRecenter(recenter + 1)} style={styles.round}>
          <Icon name="map" size={18} color={colors.fg} />
        </Pressable>
      </View>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView style={{ maxHeight: selected ? 460 : 260 }} contentContainerStyle={{ gap: spacing.sm }}>
          {selected ? (
            <PlacePeek item={selected} onClose={() => setSelected(null)} />
          ) : nearby === undefined ? (
            <Skeleton height={120} />
          ) : nearby.items.length === 0 ? (
            <EmptyState text="Nothing here yet. We're loading places for this area." />
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
                <ScoreBadge score={item.score} size="sm" />
              </Pressable>
            ))
          )}
        </ScrollView>
        <View style={styles.footer}>
          <Text variant="caption" muted style={{ flex: 1 }}>{nearby?.attribution ?? "© OpenStreetMap contributors"}</Text>
          <Text variant="caption" muted>Demo location</Text>
          <Switch value={isDemo} onValueChange={setDemo} accessibilityLabel="Demo location" />
        </View>
      </View>
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
  chips: { gap: 8 },
  controls: { position: "absolute", right: 14, bottom: 330 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: spacing.md, gap: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  rank: { width: 22, fontWeight: "700", color: colors.muted },
  footer: { flexDirection: "row", alignItems: "center", gap: 8 },
});
