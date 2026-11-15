/**
 * The map on iOS and Android: react-native-maps (Apple Maps in Expo Go on iOS, Google Maps on Android),
 * dark, with the pins drawn as views. The web twin is MapCanvas.web.tsx; both follow pinLook.ts and
 * pinLayout.ts, so the two draw the same pins.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import Svg, { Path } from "react-native-svg";
import { Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { formatScore } from "../../lib/format";
import { colors, fontWeight } from "../../theme";
import { DARK_MAP_STYLE } from "./darkMapStyle";
import { layoutPins, scaleForRegion, type PinMode } from "./pinLayout";
import { PIN, START_LAT_DELTA, bubbleSize, pinColor, pinGlyph, pinLabel, pinOrder, pinSignature, SELECT_LAT_DELTA } from "./pinLook";
import type { LatLng, MapCanvasProps } from "./types";

/** Apple and Google draw their own credit on the map, so there is nothing to add for the picture. */
export const TILE_ATTRIBUTION = "";

/** How long a pin keeps redrawing after its look changes, before it is frozen into a cheap picture. */
const SETTLE_MS = 700;
/**
 * On Apple Maps one tap on a pin can reach both the pin and the map underneath, in either order.
 * A map tap this soon after a pin tap is the same finger, not a tap on bare map.
 */
const SAME_TAP_MS = 350;
/** The pins are laid out again once the zoom has changed by this much (a pan never changes it). */
const RELAYOUT_RATIO = 1.04;
const CENTERED = { x: 0.5, y: 0.5 };

function regionAround(center: LatLng) {
  return {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta: START_LAT_DELTA,
    longitudeDelta: START_LAT_DELTA,
  };
}

export function MapCanvas({ items, center, user, selectedId, onSelect, recenterKey, padding }: MapCanvasProps) {
  const mapRef = useRef<MapView>(null);
  const { width } = useWindowDimensions();
  // When a pin was last tapped (0 = never). Only read and written in tap handlers.
  const pinTappedAt = useRef(0);
  const selectPin = (item: NearbyItem | null) => {
    pinTappedAt.current = Date.now();
    onSelect(item);
  };
  // Only the first value is used: afterwards the camera is moved by the effects below.
  const [initialRegion] = useState(() => regionAround(center));
  // Screen points across the whole world at the current zoom: what decides which pins have room to be bubbles.
  const [scale, setScale] = useState(() => scaleForRegion(width, START_LAT_DELTA));
  const regionRef = useRef<Region | null>(null);
  const onRegion = (region: Region) => {
    regionRef.current = region;
    const next = scaleForRegion(width, region.longitudeDelta);
    setScale((current) => (Math.max(next, current) / Math.min(next, current) > RELAYOUT_RATIO ? next : current));
  };

  const placements = useMemo(() => layoutPins(items, scale, selectedId), [items, scale, selectedId]);

  // Demo switch, a new position, or "Recenter": back to the center at the starting zoom.
  useEffect(() => {
    mapRef.current?.animateToRegion(regionAround({ lat: center.lat, lng: center.lng }), 600);
  }, [center.lat, center.lng, recenterKey]);

  // A picked pin slides into view. The zoom stays where the user left it.
  const selected = selectedId === null ? undefined : items.find((item) => item.id === selectedId);
  const selectedLat = selected?.lat;
  const selectedLng = selected?.lng;
  useEffect(() => {
    if (selectedLat === undefined || selectedLng === undefined) return;
    // Fly to the exact point, close enough to see the block. Never zooms back out.
    const now = regionRef.current;
    const latitudeDelta = now ? Math.min(now.latitudeDelta, SELECT_LAT_DELTA) : SELECT_LAT_DELTA;
    const longitudeDelta = now ? now.longitudeDelta * (latitudeDelta / now.latitudeDelta) : SELECT_LAT_DELTA;
    mapRef.current?.animateToRegion({ latitude: selectedLat, longitude: selectedLng, latitudeDelta, longitudeDelta }, 600);
  }, [selectedLat, selectedLng]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      userInterfaceStyle="dark"
      mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
      customMapStyle={Platform.OS === "android" ? DARK_MAP_STYLE : undefined}
      // Keeps the camera's center, and the map maker's own logo and legal link, clear of the search bar and the list.
      mapPadding={{ top: padding.top, right: 0, bottom: padding.bottom, left: 0 }}
      showsPointsOfInterests={false}
      showsBuildings={false}
      showsTraffic={false}
      showsIndoors={false}
      showsCompass={false}
      showsScale={false}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      moveOnMarkerPress={false}
      loadingEnabled
      loadingBackgroundColor={colors.bg}
      loadingIndicatorColor={colors.accent}
      onRegionChangeComplete={onRegion}
      onPress={(event) => {
        // On iOS a tap on a pin also reaches the map; only a tap on bare map clears the pick.
        if (event.nativeEvent.action === "marker-press") return;
        if (Date.now() - pinTappedAt.current < SAME_TAP_MS) return;
        onSelect(null);
      }}
    >
      {user ? <UserMarker user={user} /> : null}
      {items.map((item) => {
        const placement = placements.get(item.id);
        // A pin with no room at this zoom is left out; it comes back as the map is zoomed in.
        if (!placement || placement.mode === "hidden") return null;
        return (
          <ItemMarker
            key={item.id}
            item={item}
            mode={placement.mode}
            named={placement.name}
            selected={item.id === selectedId}
            onSelect={selectPin}
          />
        );
      })}
    </MapView>
  );
}

/** The user's own position: a blue dot. It never changes its look, so it is frozen after its first moments. */
function UserMarker({ user }: { user: LatLng }) {
  // Android turns a custom pin into a picture; give it a moment to be laid out before freezing it.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      coordinate={{ latitude: user.lat, longitude: user.lng }}
      anchor={CENTERED}
      zIndex={500}
      tracksViewChanges={!settled}
      accessibilityLabel="You are here"
    >
      <View style={styles.userHalo}>
        <View style={styles.userDot} />
      </View>
    </Marker>
  );
}

const NO_OFFSET = { x: 0, y: 0 };
/** Clear room above a bubble for its edge and shadow. */
const PIN_ROOM = 6;

/** Where the place's point falls inside a bubble's view: `pointY` from the top, at the end of the tip. */
function bubbleGeometry(item: NearbyItem, named: boolean, selected: boolean) {
  const grown = selected ? PIN.selectedScale : 1;
  const tip = Math.round(PIN.tip * grown);
  const pointY = PIN_ROOM + Math.round(bubbleSize(item).height * grown) + tip;
  return { tip, pointY, height: pointY + (named ? PIN.name.gap + PIN.name.height : 0) };
}

function ItemMarker({
  item,
  mode,
  named,
  selected,
  onSelect,
}: {
  item: NearbyItem;
  mode: PinMode;
  named: boolean;
  selected: boolean;
  onSelect: (item: NearbyItem | null) => void;
}) {
  // A custom pin is redrawn on every frame while `tracksViewChanges` is on. Keep it on until the
  // pin's current look has been on screen for a moment, then freeze it; a new look thaws it again.
  const signature = `${pinSignature(item, selected)}|${mode}|${named ? "1" : "0"}`;
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(signature), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [signature]);

  const geo = mode === "bubble" ? bubbleGeometry(item, named, selected) : null;

  return (
    <Marker
      identifier={item.id}
      // The place's own coordinate, untouched. A bubble hangs from it by its tip, a dot is centred on it.
      coordinate={{ latitude: item.lat, longitude: item.lng }}
      // Google Maps (Android) takes `anchor`; Apple Maps centres a view and takes `centerOffset`.
      anchor={geo ? { x: 0.5, y: geo.pointY / geo.height } : CENTERED}
      centerOffset={geo ? { x: 0, y: geo.height / 2 - geo.pointY } : NO_OFFSET}
      zIndex={pinOrder(item, mode === "bubble", selected)}
      tracksViewChanges={settled !== signature}
      stopPropagation
      onPress={(event) => {
        event.stopPropagation();
        onSelect(item);
      }}
    >
      <Pin item={item} mode={mode} named={named} selected={selected} />
    </Marker>
  );
}

/** The picture of one pin: a score bubble (with its name underneath when there is room) or a dot. */
const Pin = memo(function Pin({
  item,
  mode,
  named,
  selected,
}: {
  item: NearbyItem;
  mode: PinMode;
  named: boolean;
  selected: boolean;
}) {
  const color = pinColor(item.score);
  const label = pinLabel(item);

  if (mode !== "bubble") {
    return (
      // The dot is small; the clear box around it is the tap target.
      <View accessible accessibilityRole="button" accessibilityLabel={label} style={styles.dotTarget}>
        <View style={[styles.dot, { backgroundColor: color }]} />
      </View>
    );
  }

  const size = bubbleSize(item);
  const grown = selected ? PIN.selectedScale : 1;
  const bubbleWidth = Math.round(size.width * grown);
  const bubbleHeight = Math.round(size.height * grown);
  // The name hangs below the bubble. The same strip is left clear above it, so the bubble (not the
  // middle of bubble-plus-name) sits exactly on the place.
  const geo = bubbleGeometry(item, named, selected);
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.pin, { width: named ? PIN.name.maxWidth : bubbleWidth + 12, height: geo.height, paddingTop: PIN_ROOM }]}
    >
      <View
        style={[
          styles.bubble,
          { width: bubbleWidth, height: bubbleHeight, backgroundColor: selected ? PIN.selectedFill : color },
          selected && styles.bubbleSelected,
        ]}
      >
        <Svg width={size.glyph * grown} height={size.glyph * grown} viewBox="0 0 24 24">
          <Path
            d={pinGlyph(item.category)}
            fill="none"
            stroke={PIN.ink}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={[styles.score, { fontSize: size.font * grown, lineHeight: Math.round(size.font * grown * 1.2) }]}>
          {formatScore(item.score)}
        </Text>
      </View>
      <View style={[styles.tip, { borderTopWidth: geo.tip, borderTopColor: selected ? PIN.selectedRing : color }]} />
      {named ? (
        <Text numberOfLines={1} style={[styles.name, selected && styles.nameSelected]}>
          {item.name}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  // Room around the bubble so its edge and shadow are not cut off when the pin is turned into a picture.
  // The view ends at the tip's point (or at the name under it): no room below, so the anchor is exact.
  pin: { alignItems: "center", justifyContent: "flex-start" },
  tip: { width: 0, height: 0, borderLeftWidth: PIN.tipHalf, borderRightWidth: PIN.tipHalf, borderLeftColor: "transparent", borderRightColor: "transparent" },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 99,
    borderWidth: PIN.edge,
    borderColor: PIN.edgeColor,
    shadowColor: colors.black,
    shadowOpacity: 0.45,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  bubbleSelected: { borderWidth: 3, borderColor: PIN.selectedRing, shadowOpacity: 0.6, shadowRadius: 8, elevation: 9 },
  score: { fontWeight: fontWeight.bold, color: PIN.ink, fontVariant: ["tabular-nums"], letterSpacing: -0.2 },
  name: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: PIN.name.height,
    textAlign: "center",
    fontSize: PIN.name.font,
    lineHeight: PIN.name.height,
    fontWeight: fontWeight.semibold,
    color: colors.fg,
    textShadowColor: colors.page,
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  nameSelected: { fontWeight: fontWeight.bold },

  dotTarget: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  dot: {
    width: PIN.dot + PIN.edge * 2,
    height: PIN.dot + PIN.edge * 2,
    borderRadius: (PIN.dot + PIN.edge * 2) / 2,
    borderWidth: PIN.edge,
    borderColor: PIN.edgeColor,
  },

  userHalo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(74,168,255,0.2)",
  },
  userDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: PIN.user,
    borderWidth: 3,
    borderColor: colors.white,
  },
});
