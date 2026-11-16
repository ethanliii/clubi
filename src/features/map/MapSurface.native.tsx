import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { NearbyItem } from "../../../convex/lib/contract";
import { Text, VenuePhoto } from "../../components/bryan";
import { colors, ratingColor, isLight } from "../../theme";
import type { MapSurfaceProps } from "./types";

const CATEGORY_ICON: Record<string, string> = { nightlife: "🍸", food: "🍴", culture: "🏛", outdoors: "🌳", live: "🎵", popup: "✨" };
const CATEGORY_HUE: Record<string, number> = { nightlife: 320, food: 25, culture: 265, outdoors: 140, live: 200, popup: 45 };

/** Pins by tier (UI-SPEC §4): top = big photo pin, good = photo pin + name, other = dot. */
export function MapSurface({ items, center, selectedId, onSelect, recenterKey }: MapSurfaceProps) {
  const ref = useRef<MapView>(null);
  useEffect(() => {
    ref.current?.animateToRegion({ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 400);
  }, [center.lat, center.lng, recenterKey]);

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
      showsUserLocation
      userInterfaceStyle={isLight ? "light" : "dark"}
      onPress={() => onSelect(null)}
    >
      {items.map((item) => (
        <PinMarker key={String(item.id)} item={item} selected={selectedId === String(item.id)} onSelect={onSelect} />
      ))}
    </MapView>
  );
}

function PinMarker({ item, selected, onSelect }: { item: NearbyItem; selected: boolean; onSelect: (i: NearbyItem) => void }) {
  // Custom marker views are snapshotted; keep tracking until the photo has loaded so it actually shows.
  const [loaded, setLoaded] = useState(!item.imageUrl);
  return (
    <Marker
      coordinate={{ latitude: item.lat, longitude: item.lng }}
      onPress={(e) => { e.stopPropagation(); onSelect(item); }}
      tracksViewChanges={!loaded || selected}
      zIndex={selected ? 5 : item.tier === "top" ? 3 : item.tier === "good" ? 2 : 1}
    >
      <Pin item={item} selected={selected} onLoaded={() => setLoaded(true)} />
    </Marker>
  );
}

/** Photo of the place in a circle, a small category bubble on its top-left, the score under it. */
function Pin({ item, selected, onLoaded }: { item: NearbyItem; selected: boolean; onLoaded: () => void }) {
  if (item.tier === "other") return <View style={[styles.dot, { backgroundColor: ratingColor(item.score) }]} />;
  const size = item.tier === "top" ? 54 : 44;
  return (
    <View style={styles.wrap}>
      <View style={[styles.photo, { width: size, height: size, borderRadius: size / 2, borderColor: item.tier === "top" ? colors.accent : colors.white },
        item.kind === "event" && styles.event, selected && styles.selected]}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: "100%" }} onLoad={onLoaded} onError={onLoaded} />
        ) : (
          <VenuePhoto hue={CATEGORY_HUE[item.category] ?? 300} category={item.category} seed={String(item.id)} height={size} style={{ borderRadius: 0 }} />
        )}
      </View>
      <View style={styles.iconBubble}>
        <Text style={{ fontSize: 10, lineHeight: 13 }}>{CATEGORY_ICON[item.category] ?? "📍"}</Text>
      </View>
      <View style={[styles.score, { backgroundColor: ratingColor(item.score) }]}>
        <Text style={styles.scoreText}>{item.score.toFixed(1)}</Text>
      </View>
      {item.tier === "good" || item.tier === "top" ? <Text style={styles.name} numberOfLines={1}>{item.name}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: colors.white },
  wrap: { alignItems: "center", paddingTop: 4, paddingLeft: 4, maxWidth: 140 },
  photo: { overflow: "hidden", borderWidth: 2.5, backgroundColor: colors.surface, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  event: { borderStyle: "dashed", borderColor: colors.mid },
  selected: { transform: [{ scale: 1.15 }] },
  iconBubble: { position: "absolute", top: 0, left: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  score: { marginTop: -8, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1.5, borderColor: colors.white },
  scoreText: { color: "#111", fontWeight: "700", fontSize: 11, lineHeight: 14 },
  name: { color: "#111", fontWeight: "600", fontSize: 11, lineHeight: 14, textShadowColor: "#fff", textShadowRadius: 3, marginTop: 1 },
});
