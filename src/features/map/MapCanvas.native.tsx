/**
 * The map on iOS and Android: react-native-maps (Apple Maps in Expo Go on iOS, Google Maps on Android),
 * dark, with the three pins drawn as views. The web twin is MapCanvas.web.tsx.
 */
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { formatScore } from "../../lib/format";
import { colors, fontWeight } from "../../theme";
import { DARK_MAP_STYLE } from "./darkMapStyle";
import { PIN, START_LAT_DELTA, pinColor, pinGlow, pinLabel, pinOrder, pinSignature } from "./pinLook";
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
  // When a pin was last tapped (0 = never). Only read and written in tap handlers.
  const pinTappedAt = useRef(0);
  const selectPin = (item: NearbyItem | null) => {
    pinTappedAt.current = Date.now();
    onSelect(item);
  };
  // Only the first value is used: afterwards the camera is moved by the effects below.
  const [initialRegion] = useState(() => regionAround(center));

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
    mapRef.current?.animateCamera({ center: { latitude: selectedLat, longitude: selectedLng } }, { duration: 350 });
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
      onPress={(event) => {
        // On iOS a tap on a pin also reaches the map; only a tap on bare map clears the pick.
        if (event.nativeEvent.action === "marker-press") return;
        if (Date.now() - pinTappedAt.current < SAME_TAP_MS) return;
        onSelect(null);
      }}
    >
      {user ? <UserMarker user={user} /> : null}
      {items.map((item) => (
        <ItemMarker key={item.id} item={item} selected={item.id === selectedId} onSelect={selectPin} />
      ))}
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

function ItemMarker({
  item,
  selected,
  onSelect,
}: {
  item: NearbyItem;
  selected: boolean;
  onSelect: (item: NearbyItem | null) => void;
}) {
  // A custom pin is redrawn on every frame while `tracksViewChanges` is on. Keep it on until the
  // pin's current look has been on screen for a moment, then freeze it; a new look thaws it again.
  const signature = pinSignature(item, selected);
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(signature), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [signature]);

  return (
    <Marker
      identifier={item.id}
      coordinate={{ latitude: item.lat, longitude: item.lng }}
      anchor={CENTERED}
      zIndex={pinOrder(item, selected)}
      tracksViewChanges={settled !== signature}
      stopPropagation
      onPress={(event) => {
        event.stopPropagation();
        onSelect(item);
      }}
    >
      <Pin item={item} selected={selected} />
    </Marker>
  );
}

/** The picture of one pin. `tier` (from the backend) picks which of the three it is. */
function Pin({ item, selected }: { item: NearbyItem; selected: boolean }) {
  const color = pinColor(item.category);
  const isEvent = item.kind === "event";
  const label = pinLabel(item);

  if (item.tier === "top") {
    const size = selected ? PIN.topSelected : PIN.top;
    return (
      <View accessible accessibilityRole="button" accessibilityLabel={label} style={styles.glowRoom}>
        <View
          style={[
            styles.top,
            { width: size, height: size, borderRadius: isEvent ? 14 : size / 2, borderColor: color, shadowColor: color },
            selected && { backgroundColor: color },
          ]}
        >
          <View style={[styles.topHalo, { borderRadius: isEvent ? 18 : size, borderColor: pinGlow(item.category) }]} />
          <Text style={[styles.topScore, selected && styles.topScoreSelected]}>{formatScore(item.score)}</Text>
        </View>
      </View>
    );
  }

  if (item.tier === "good") {
    return (
      <View accessible accessibilityRole="button" accessibilityLabel={label} style={styles.shadowRoom}>
        <View style={[styles.label, selected && { backgroundColor: color, borderColor: color }]}>
          <View
            style={[styles.swatch, { backgroundColor: selected ? colors.bg : color }, isEvent && styles.swatchEvent]}
          />
          <Text numberOfLines={1} style={[styles.labelName, selected && styles.onColor]}>
            {item.name}
          </Text>
          <Text style={[styles.labelScore, { color: selected ? colors.bg : color }]}>{formatScore(item.score)}</Text>
        </View>
      </View>
    );
  }

  const size = selected ? PIN.dotSelected : PIN.dot;
  return (
    // The dot is small; the clear box around it is the tap target.
    <View accessible accessibilityRole="button" accessibilityLabel={label} style={styles.dotTarget}>
      <View
        style={[
          styles.dot,
          { width: size, height: size, borderRadius: isEvent ? 3 : size / 2, backgroundColor: color },
          isEvent && styles.dotEvent,
          selected && styles.dotSelected,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Room around a pin so its glow and shadow are not cut off when the pin is turned into a picture.
  glowRoom: { padding: 8 },
  shadowRoom: { padding: 6 },
  top: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PIN.fill,
    borderWidth: PIN.ring,
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  topHalo: { position: "absolute", top: -7, right: -7, bottom: -7, left: -7, borderWidth: 4 },
  topScore: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: fontWeight.bold,
    color: PIN.text,
    fontVariant: ["tabular-nums"],
  },
  topScoreSelected: { fontSize: 17, lineHeight: 21, color: colors.bg },

  label: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: PIN.label,
    maxWidth: PIN.labelMaxWidth,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: PIN.label / 2,
    backgroundColor: "rgba(20,17,25,0.94)",
    borderWidth: 1,
    borderColor: PIN.border,
    shadowColor: colors.black,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  swatch: { width: 9, height: 9, borderRadius: 4.5 },
  swatchEvent: { borderRadius: 2, transform: [{ rotate: "45deg" }] },
  labelName: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: fontWeight.semibold, color: PIN.text },
  labelScore: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
  onColor: { color: colors.bg },

  dotTarget: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  dot: { borderWidth: 2, borderColor: PIN.fill },
  dotEvent: { transform: [{ rotate: "45deg" }] },
  dotSelected: { borderColor: colors.white },

  userHalo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(74,168,255,0.22)",
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
