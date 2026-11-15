import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { FlatList, Keyboard, Platform, Pressable, StyleSheet, Switch, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chip, ChipRow, EmptyState, Icon, ItemCard, SkeletonRows, Text } from "../../components";
import { DEFAULT_FILTER, MAP_FILTERS } from "../../features/map/filters";
import { MapCanvas, TILE_ATTRIBUTION } from "../../features/map/MapCanvas";
import { SearchBox, SearchResults } from "../../features/map/MapSearch";
import { MapSheet, type SheetHeights, type SheetSnap } from "../../features/map/MapSheet";
import type { Filter, NearbyItem } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { pluralize } from "../../lib/format";
import { openUrl } from "../../lib/links";
import { useNearby } from "../../lib/useNearby";
import { colors, fontWeight, radius, spacing } from "../../theme";

const NO_ITEMS: NearbyItem[] = [];
/** Shown even before the first answer arrives: the credit is a licence requirement. */
const DATA_ATTRIBUTION = "© OpenStreetMap contributors";
const ATTRIBUTION_URL = "https://www.openstreetmap.org/copyright";

/** Search box + gap + chips + gaps, below the status bar. */
const TOP_BAR = 112;
/** The demo switch, the attribution and "Recenter", floating above the list. */
const CONTROLS = 86;

/** react-native-web paints an "on" switch teal unless told otherwise; native ignores these. */
const WEB_SWITCH = Platform.OS === "web" ? { activeThumbColor: colors.white, activeTrackColor: colors.accent } : null;

function sheetHeights(screen: number, top: number): SheetHeights {
  const full = Math.max(260, screen - top - CONTROLS - spacing.sm);
  const mid = Math.min(full, Math.max(240, Math.round(screen * 0.42)));
  const peek = Math.min(mid, 176);
  return { peek, mid, full };
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { lat, lng, ready, isDemo, setDemo } = useDemoLocation();
  const [filter, setFilter] = useState<Filter>(DEFAULT_FILTER);
  const nearby = useNearby(filter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [snap, setSnap] = useState<SheetSnap>("mid");
  const [search, setSearch] = useState("");
  // The real height of this screen (the window minus the tab bar), once it has been laid out.
  const [measured, setMeasured] = useState<number | null>(null);
  const listRef = useRef<FlatList<NearbyItem>>(null);

  const items = nearby?.items ?? NO_ITEMS;
  const selected = selectedId === null ? null : (items.find((item) => item.id === selectedId) ?? null);
  const center = nearby?.center ?? { lat, lng };

  const top = insets.top + TOP_BAR;
  const height = measured ?? window.height - 84;
  const heights = sheetHeights(height, top);
  // The camera centers in what is left between the search bar and the list. When the list is
  // pulled all the way up there is no map left to center in, so the middle height stands in.
  const padding = { top, bottom: heights[snap === "full" ? "mid" : snap] + CONTROLS };

  const attribution = [nearby?.attribution ?? DATA_ATTRIBUTION, TILE_ATTRIBUTION].filter(Boolean).join(" · ");
  const searching = search.trim().length >= 2;

  // The picked card sits at the top of the list: bring the list back up to it.
  useEffect(() => {
    if (selectedId !== null) listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [selectedId]);

  const pick = (item: NearbyItem | null) => {
    Keyboard.dismiss();
    setSelectedId(item === null ? null : item.id);
    // A pin can only be seen with some map showing.
    if (item !== null && snap === "full") setSnap("mid");
  };

  const chooseFilter = (next: Filter) => {
    setFilter(next);
    setSelectedId(null);
  };

  return (
    <View style={styles.screen} onLayout={(event) => setMeasured(event.nativeEvent.layout.height)}>
      <MapCanvas
        items={items}
        center={center}
        user={ready ? { lat, lng } : null}
        selectedId={selected === null ? null : selectedId}
        onSelect={pick}
        recenterKey={recenterKey}
        padding={padding}
      />

      <LinearGradient
        colors={["rgba(20,17,25,0.92)", "rgba(20,17,25,0.6)", "rgba(20,17,25,0)"]}
        locations={[0, 0.6, 1]}
        style={[styles.scrim, { height: top + spacing.xl }]}
      />

      <View style={[styles.top, searching && styles.topSearching, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.gutter}>
          <SearchBox value={search} onChangeText={setSearch} />
        </View>
        {searching ? (
          <View style={styles.gutter}>
            <SearchResults text={search} lat={lat} lng={lng} ready={ready} maxHeight={Math.max(180, height * 0.5)} />
          </View>
        ) : (
          <ChipRow scroll style={styles.chips}>
            {MAP_FILTERS.map((option) => (
              <Chip
                key={option.filter}
                label={option.label}
                accessibilityLabel={`Filter: ${option.label}`}
                selected={filter === option.filter}
                onPress={() => chooseFilter(option.filter)}
                style={styles.chip}
              />
            ))}
          </ChipRow>
        )}
      </View>

      <View style={styles.bottom}>
        <View style={styles.controls}>
          <View style={styles.controlsLeft}>
            <View style={styles.pill}>
              <Text aria-hidden variant="caption" muted>
                Demo location
              </Text>
              <Switch
                accessibilityLabel="Demo location"
                value={isDemo}
                onValueChange={setDemo}
                trackColor={{ false: colors.raised, true: colors.accent }}
                thumbColor={colors.white}
                ios_backgroundColor={colors.raised}
                {...WEB_SWITCH}
              />
            </View>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={attribution}
              hitSlop={6}
              onPress={() => void openUrl(ATTRIBUTION_URL)}
              style={styles.attribution}
            >
              <Text variant="caption" numberOfLines={1} style={styles.attributionText}>
                {attribution}
              </Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Recenter"
            hitSlop={4}
            onPress={() => setRecenterKey((key) => key + 1)}
            style={({ pressed }) => [styles.pill, styles.recenter, pressed && styles.pressed]}
          >
            <Icon name="locate" size={18} color={colors.fg} />
            <Text variant="caption" style={styles.pillText}>
              Recenter
            </Text>
          </Pressable>
        </View>

        <MapSheet
          snap={snap}
          onSnap={setSnap}
          heights={heights}
          header={
            <View style={styles.sheetHeader}>
              <Text variant="title" numberOfLines={1} style={styles.flex}>
                {selected ? "On the map" : "Ranked for you"}
              </Text>
              {selected ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Show all"
                  hitSlop={10}
                  onPress={() => setSelectedId(null)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.link}>Show all</Text>
                </Pressable>
              ) : nearby !== undefined && items.length > 0 ? (
                <Text variant="caption" muted>
                  {pluralize(items.length, "spot")}
                </Text>
              ) : null}
            </View>
          }
        >
          {nearby === undefined ? (
            <View style={styles.sheetPad}>
              <SkeletonRows count={4} />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.sheetPad}>
              <EmptyState
                icon="map"
                title="Nothing here yet. We're loading places for this area."
                style={styles.empty}
              />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={items}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
              ListHeaderComponent={
                selected ? (
                  <View style={styles.picked}>
                    <ItemCard item={selected} showRank style={styles.pickedCard} />
                  </View>
                ) : undefined
              }
              renderItem={({ item }) => <ItemCard item={item} showRank />}
            />
          )}
        </MapSheet>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, overflow: "hidden" },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, pointerEvents: "none" },

  top: { position: "absolute", top: 0, left: 0, right: 0, gap: spacing.sm, pointerEvents: "box-none" },
  // The results drop down over the floating controls and the list, not under them.
  topSearching: { zIndex: 2, elevation: 12 },
  gutter: { paddingHorizontal: spacing.md },
  chips: { paddingHorizontal: spacing.md },
  // His chips are 30 tall with 14 at the sides; the shared chip is 40.
  chip: { minHeight: 32, paddingHorizontal: 14 },

  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, pointerEvents: "box-none" },
  controls: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    pointerEvents: "box-none",
  },
  controlsLeft: { flexShrink: 1, alignItems: "flex-start", gap: spacing.xs + 2, pointerEvents: "box-none" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 42,
    paddingLeft: spacing.md + 2,
    paddingRight: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  recenter: { paddingLeft: spacing.md, paddingRight: spacing.md + 2 },
  pillText: { fontWeight: fontWeight.semibold },
  attribution: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: "rgba(20,17,25,0.82)",
  },
  attributionText: { color: colors.muted, fontSize: 11, lineHeight: 14 },

  sheetHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 28 },
  link: { color: colors.accent, fontWeight: fontWeight.semibold },
  sheetPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  empty: { paddingVertical: spacing.xl },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  picked: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  pickedCard: { borderBottomWidth: 0 },
});
