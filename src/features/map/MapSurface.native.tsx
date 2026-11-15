import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { NearbyItem } from "../../../convex/lib/contract";
import { Text } from "../../components";
import { colors, ratingColor } from "../../theme";
import type { MapSurfaceProps } from "./types";

const CATEGORY_ICON: Record<string, string> = { nightlife: "🍸", food: "🍴", culture: "🏛", outdoors: "🌳", live: "🎵", popup: "✨" };

/** Pins by tier (UI-SPEC §4): top = big ringed bubble with score, good = labeled bubble, other = dot. */
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
      onPress={() => onSelect(null)}
    >
      {items.map((item) => (
        <Marker
          key={String(item.id)}
          coordinate={{ latitude: item.lat, longitude: item.lng }}
          onPress={(e) => { e.stopPropagation(); onSelect(item); }}
          tracksViewChanges={false}
          zIndex={item.tier === "top" ? 3 : item.tier === "good" ? 2 : 1}
        >
          <Pin item={item} selected={selectedId === String(item.id)} />
        </Marker>
      ))}
    </MapView>
  );
}

function Pin({ item, selected }: { item: NearbyItem; selected: boolean }) {
  if (item.tier === "other") return <View style={[styles.dot, { backgroundColor: ratingColor(item.score) }]} />;
  const top = item.tier === "top";
  return (
    <View style={styles.pinRow}>
      <View style={[styles.bubble, top && styles.bubbleTop, selected && styles.selected, item.kind === "event" && styles.event]}>
        <View style={[styles.icon, { backgroundColor: ratingColor(item.score) }]}>
          <Text style={{ fontSize: 12, lineHeight: 15 }}>{CATEGORY_ICON[item.category] ?? "📍"}</Text>
        </View>
        <Text style={styles.score}>{item.score.toFixed(1)}</Text>
      </View>
      {item.tier === "good" || top ? <Text style={styles.name} numberOfLines={1}>{item.name}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: colors.white },
  pinRow: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: 200 },
  bubble: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.white, borderRadius: 99, paddingLeft: 3, paddingRight: 8, paddingVertical: 3, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  bubbleTop: { borderWidth: 2.5, borderColor: colors.accent },
  selected: { transform: [{ scale: 1.15 }] },
  event: { borderStyle: "dashed", borderWidth: 2, borderColor: colors.mid },
  icon: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  score: { color: "#111", fontWeight: "700", fontSize: 13, lineHeight: 16 },
  name: { color: "#111", fontWeight: "600", fontSize: 11, lineHeight: 14, textShadowColor: "#fff", textShadowRadius: 3 },
});
