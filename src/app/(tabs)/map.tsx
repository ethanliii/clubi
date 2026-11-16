import { router, useLocalSearchParams, type Href } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlatList, Keyboard, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, Icon, SkeletonRows, Text } from "../../components";
import { FILTER_HEIGHT, FilterChips } from "../../features/map/FilterChips";
import { DEFAULT_FILTER } from "../../features/map/filters";
import { MapCanvas, TILE_ATTRIBUTION } from "../../features/map/MapCanvas";
import { MapRow, ROW_HEIGHT } from "../../features/map/MapRow";
import { SEARCH_HEIGHT, SearchBox, SearchResults } from "../../features/map/MapSearch";
import { MapSheet, type SheetHeights, type SheetSnap } from "../../features/map/MapSheet";
import { PEEK_CARD_HEIGHT, PeekCard } from "../../features/map/PeekCard";
import type { Filter, NearbyItem } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { pluralize } from "../../lib/format";
import { openUrl, venuePath } from "../../lib/links";
import { useNearby } from "../../lib/useNearby";
import { colors, fontWeight, palette, spacing } from "../../theme";

const NO_ITEMS: NearbyItem[] = [];
/** Shown even before the first answer arrives: the credit is a licence requirement. */
const DATA_ATTRIBUTION = "© OpenStreetMap";
const ATTRIBUTION_URL = "https://www.openstreetmap.org/copyright";

const GUTTER = spacing.lg - 2;
/** Space between the status bar and the search field, and between the field and the filters. */
const TOP_GAP = spacing.sm;
const FILTER_GAP = 10;
/** The strip above the list (or the pin's card) that holds the credit and "Recenter". */
const FLOAT = 56;
/** The handle, the title and its line of detail: what the list's own header takes. */
const SHEET_HEADER = 68;
const CARD_MARGIN = spacing.md;

/** What the list is, in the words of the filter that made it. */
const TITLES: Record<Filter, string> = {
  tonight: "Tonight near you",
  bars: "Bars near you",
  food: "Food near you",
  events: "Events near you",
  popups: "Pop-ups near you",
  outdoors: "Outdoors near you",
  all: "Everything near you",
};

/** Peek: the title and the best pick. Half: the map and the list share the screen. Full: up to the search field. */
function sheetHeights(screen: number, searchBottom: number): SheetHeights {
  const full = Math.max(280, screen - searchBottom - FILTER_GAP);
  const peek = Math.min(full, SHEET_HEADER + ROW_HEIGHT + spacing.sm);
  const mid = Math.min(full, Math.max(peek, Math.round(screen * 0.5)));
  return { peek, mid, full };
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  // Home's search field opens this tab with a new `search` value: the field here takes the keyboard.
  const { search: focusSearch } = useLocalSearchParams<{ search?: string }>();
  const { lat, lng, ready, isDemo } = useDemoLocation();
  const [filter, setFilter] = useState<Filter>(DEFAULT_FILTER);
  // Many more than a list needs: zooming in makes room for them, each with its photo.
  const nearby = useNearby(filter, 150);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [snap, setSnap] = useState<SheetSnap>("peek");
  const [search, setSearch] = useState("");
  // Search stays open (white page, "Cancel") from the first tap on the field until it is cancelled.
  const [searchOpen, setSearchOpen] = useState(false);
  // The real height of this screen (the window minus the tab bar), once it has been laid out.
  const [measured, setMeasured] = useState<number | null>(null);
  // How far the list is scrolled: at its very top, a pull down moves the panel instead.
  const listOffset = useRef(0);

  const items = nearby?.items ?? NO_ITEMS;
  const selected = selectedId === null ? null : (items.find((item) => item.id === selectedId) ?? null);
  const center = nearby?.center ?? { lat, lng };

  const searchTop = insets.top + TOP_GAP;
  const searchBottom = searchTop + SEARCH_HEIGHT;
  const filtersBottom = searchBottom + FILTER_GAP + FILTER_HEIGHT;
  const height = measured ?? window.height - 84;
  const heights = sheetHeights(height, searchBottom);
  // The camera centers in what is left between the filters and the list (or the pin's card). When the
  // list is pulled all the way up there is no map left to center in, so the half height stands in.
  const covered = selected ? PEEK_CARD_HEIGHT + CARD_MARGIN : heights[snap === "full" ? "mid" : snap];
  const padding = { top: filtersBottom + spacing.sm, bottom: covered + FLOAT };

  // The full credit is what a screen reader hears; the short form is what fits on the map.
  const attribution = [nearby?.attribution ?? "© OpenStreetMap contributors", TILE_ATTRIBUTION].filter(Boolean).join(" · ");
  const credit = TILE_ATTRIBUTION ? `${DATA_ATTRIBUTION} · OpenMapTiles` : DATA_ATTRIBUTION;
  const searching = searchOpen || search.trim().length >= 2;

  const open = (item: NearbyItem) => router.push(venuePath(item.kind, item.id));

  const pick = (item: NearbyItem | null) => {
    Keyboard.dismiss();
    // A second tap on the picked pin opens it, the same as tapping its card.
    if (item !== null && item.id === selectedId) open(item);
    else setSelectedId(item === null ? null : item.id);
  };

  const chooseFilter = (next: Filter) => {
    setFilter(next);
    setSelectedId(null);
    // A picked pin leaves the camera zoomed in on one block: a new filter starts from the wide view again.
    setRecenterKey((key) => key + 1);
  };

  const onSnap = useCallback((next: SheetSnap) => setSnap(next), []);

  // The credit and "Recenter", floating on the map just above whatever covers its bottom edge.
  const float = (
    <View style={styles.float} pointerEvents="box-none">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={attribution}
        hitSlop={{ top: 12, bottom: 8, left: 8, right: 8 }}
        onPress={() => void openUrl(ATTRIBUTION_URL)}
        style={styles.credit}
      >
        <Text numberOfLines={1} style={styles.creditText}>
          {credit}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Recenter"
        hitSlop={4}
        onPress={() => setRecenterKey((key) => key + 1)}
        style={({ pressed }) => [styles.round, pressed && styles.roundPressed]}
      >
        <Icon name="navigate" size={20} color={colors.accent} />
      </Pressable>
    </View>
  );

  const detail =
    nearby === undefined
      ? "Finding what's good…"
      : items.length === 0
        ? "Nothing here yet"
        : `${pluralize(items.length, "spot")} · Best nearby first`;

  return (
    <View style={styles.screen} onLayout={(event) => setMeasured(event.nativeEvent.layout.height)}>
      <MapCanvas
        items={items}
        center={center}
        user={ready ? { lat, lng } : null}
        userIsDemo={isDemo}
        selectedId={selected === null ? null : selectedId}
        onSelect={pick}
        recenterKey={recenterKey}
        padding={padding}
      />

      {/* Pulled all the way up, the list meets the search field: no strip of map is left between them. */}
      {snap === "full" && selected === null ? <View style={[styles.cover, { height: searchBottom + FILTER_GAP + 24 }]} /> : null}

      {searching ? null : (
        <View style={[styles.filters, { top: searchBottom + FILTER_GAP }]}>
          <FilterChips value={filter} onChange={chooseFilter} onFriends={() => router.push("/group-map" as Href)} />
        </View>
      )}

      <MapSheet
        snap={snap}
        onSnap={onSnap}
        heights={heights}
        hidden={selected !== null}
        above={float}
        aboveHeight={FLOAT}
        listOffset={listOffset}
        header={
          <View style={styles.sheetHeader}>
            <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
              {TITLES[filter]}
            </Text>
            <Text numberOfLines={1} style={styles.detail}>
              {detail}
            </Text>
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
              title="Nothing here yet"
              body="We're loading places for this area."
              style={styles.empty}
            />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            // Below full height a drag on the list moves the panel; a phone only scrolls the list at full height.
            scrollEnabled={Platform.OS === "web" ? snap !== "peek" : snap === "full"}
            getItemLayout={(_data, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
            // The panel is always full height and slid down: pad by the part that hangs below the screen.
            contentContainerStyle={{ paddingBottom: heights.full - heights[snap] + spacing.lg }}
            scrollEventThrottle={32}
            onScroll={(event) => {
              listOffset.current = event.nativeEvent.contentOffset.y;
            }}
            onScrollEndDrag={(event) => {
              // Pulling down past the top of the list at full height lets the map back in.
              if (snap === "full" && event.nativeEvent.contentOffset.y < -48) setSnap("mid");
            }}
            renderItem={({ item, index }) => (
              <MapRow item={item} last={index === items.length - 1 || snap === "peek"} onPress={() => open(item)} />
            )}
          />
        )}
      </MapSheet>

      {selected ? (
        <View style={styles.cardDock} pointerEvents="box-none">
          <View style={{ height: FLOAT }} pointerEvents="box-none">
            {float}
          </View>
          <View style={styles.cardWrap}>
            <PeekCard key={selected.id} item={selected} onOpen={() => open(selected)} onClose={() => setSelectedId(null)} />
          </View>
        </View>
      ) : null}

      {searching ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close search"
          onPress={() => {
            Keyboard.dismiss();
            setSearch("");
            setSearchOpen(false);
          }}
          style={styles.dim}
        />
      ) : null}

      <View style={[styles.search, { top: searchTop }]} pointerEvents="box-none">
        <SearchBox value={search} onChangeText={setSearch} focusKey={focusSearch} open={searchOpen} onOpenChange={setSearchOpen} />
        {searching ? (
          <SearchResults
            text={search}
            lat={lat}
            lng={lng}
            ready={ready}
            nearby={items}
            maxHeight={Math.max(200, height - searchBottom - spacing.xl * 2)}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // "clip" in a browser: the list panel is slid below the bottom edge, and a "hidden" box would let
  // the browser scroll the whole screen up to it when something down there takes the focus.
  screen: {
    flex: 1,
    backgroundColor: colors.page,
    overflow: "hidden",
    ...Platform.select({ web: { overflow: "clip" } as object, default: {} }),
  },
  flex: { flex: 1, minWidth: 0 },

  filters: { position: "absolute", left: 0, right: 0 },
  cover: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: colors.bg },
  // While searching, everything but the field and its results steps back.
  dim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 3, backgroundColor: colors.bg },
  // The results drop down over the filters, the list and the pin's card.
  search: { position: "absolute", left: GUTTER, right: GUTTER, gap: spacing.sm, zIndex: 3, elevation: 20 },

  float: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: GUTTER,
    paddingBottom: spacing.md,
  },
  // A white backing, so the credit can be read whatever pin or street name slides under it.
  credit: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 170,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  creditText: { fontSize: 9, lineHeight: 12, color: colors.muted },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    shadowColor: colors.black,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  roundPressed: { backgroundColor: palette.field },

  sheetHeader: { justifyContent: "center", height: SHEET_HEADER - 28 },
  // The small bold capitals of a section label, as over the feed.
  title: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.fg,
  },
  detail: { marginTop: 2, fontSize: 13, lineHeight: 17, color: colors.muted },
  sheetPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  empty: { paddingVertical: spacing.lg },

  cardDock: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 2 },
  cardWrap: { paddingHorizontal: CARD_MARGIN, paddingBottom: CARD_MARGIN },
});
