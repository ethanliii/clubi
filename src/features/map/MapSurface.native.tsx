import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import type { NearbyItem } from "../../../convex/lib/contract";
import { Avatar, Icon, Text, VenuePhoto } from "../../components/bryan";
import { placeholderPhoto } from "../../constants/placeholderPhotos";
import { colors, isLight, ratingColor } from "../../theme";
import type { MapSurfaceProps } from "./types";

const CATEGORY_ICON: Record<string, string> = { nightlife: "🍸", food: "🍴", culture: "🏛", outdoors: "🌳", live: "🎵", popup: "✨" };
const CATEGORY_HUE: Record<string, number> = { nightlife: 320, food: 25, culture: 265, outdoors: 140, live: 200, popup: 45 };
const START_DELTA = 0.03;

/**
 * How many photo pins to show for how far out the map is (latitudeDelta). Zoomed out: only the
 * top picks pop up as pictures; zoom in and more appear. The rest are small dots you can still tap.
 * Which ones are "top" is the backend's `rank`; nothing is re-scored here.
 */
function photoPinsFor(delta: number): number {
  if (delta >= 0.12) return 3;
  if (delta >= 0.06) return 5;
  if (delta >= 0.035) return 8;
  if (delta >= 0.018) return 14;
  if (delta >= 0.009) return 24;
  return Infinity;
}

/** Bryan's map: photo pins with friend faces (or the public score), dots for the rest, smooth zoom. */
export function MapSurface({ items, center, selectedId, onSelect, recenterKey, zoom }: MapSurfaceProps) {
  const ref = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>({ latitude: center.lat, longitude: center.lng, latitudeDelta: START_DELTA, longitudeDelta: START_DELTA });

  useEffect(() => {
    ref.current?.animateToRegion({ latitude: center.lat, longitude: center.lng, latitudeDelta: START_DELTA, longitudeDelta: START_DELTA }, 400);
  }, [center.lat, center.lng, recenterKey]);

  // + / − buttons: halve or double the visible area around the current middle, animated.
  useEffect(() => {
    if (!zoom || zoom.key === 0) return;
    const f = zoom.dir > 0 ? 0.5 : 2;
    ref.current?.animateToRegion(
      { ...region, latitudeDelta: clampDelta(region.latitudeDelta * f), longitudeDelta: clampDelta(region.longitudeDelta * f) },
      280,
    );
  }, [zoom?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const ranked = [...items].sort((a, b) => a.rank - b.rank);
  const photos = photoPinsFor(region.latitudeDelta);

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      initialRegion={region}
      showsUserLocation
      userInterfaceStyle={isLight ? "light" : "dark"}
      rotateEnabled={false}
      pitchEnabled={false}
      moveOnMarkerPress={false}
      showsPointsOfInterests={false}
      onRegionChangeComplete={setRegion}
      onPress={() => onSelect(null)}
    >
      {ranked.map((item, i) => {
        const selected = selectedId === String(item.id);
        return (
          <PinMarker key={String(item.id)} item={item} selected={selected} asPhoto={selected || i < photos} onSelect={onSelect} />
        );
      })}
    </MapView>
  );
}

const clampDelta = (d: number) => Math.min(1.5, Math.max(0.002, d));

function PinMarker({ item, selected, asPhoto, onSelect }: { item: NearbyItem; selected: boolean; asPhoto: boolean; onSelect: (i: NearbyItem) => void }) {
  // Custom marker views are snapshotted. Track changes only briefly after a pin changes shape
  // (so photos and faces get drawn), then stop: that is what keeps panning and zooming smooth.
  const shape = `${asPhoto}-${selected}`;
  const [settled, setSettled] = useState<string | null>(null);
  const tracking = settled !== shape;
  useEffect(() => {
    const t = setTimeout(() => setSettled(shape), shape.startsWith("true") ? 1500 : 300);
    return () => clearTimeout(t);
  }, [shape]);
  return (
    <Marker
      coordinate={{ latitude: item.lat, longitude: item.lng }}
      onPress={(e) => { e.stopPropagation(); onSelect(item); }}
      tracksViewChanges={tracking}
      anchor={asPhoto ? { x: 0.5, y: 0.6 } : { x: 0.5, y: 0.5 }}
      zIndex={selected ? 1000 : asPhoto ? 500 - item.rank : 1}
    >
      {asPhoto ? <PhotoPin item={item} selected={selected} /> : <View style={[styles.dot, { backgroundColor: ratingColor(item.score) }]} />}
    </Marker>
  );
}

/**
 * Photo of the place in a circle, category bubble top-left, then the score tag:
 * friends rated it → their faces + the top friend's score (accent ring) ·
 * nobody I know → the public average with a people icon (grey) ·
 * no ratings yet → the "for you" prediction (plain).
 */
function PhotoPin({ item, selected }: { item: NearbyItem; selected: boolean }) {
  const size = item.tier === "top" || selected ? 54 : 46;
  const uri = item.imageUrl ?? placeholderPhoto(item.category, String(item.id), 200);
  const friend = item.friends[0];
  return (
    <View style={styles.wrap}>
      <View style={[styles.photo, { width: size, height: size, borderRadius: size / 2, borderColor: friend ? colors.accent : colors.white },
        item.kind === "event" && styles.event, selected && styles.selected]}>
        <VenuePhoto hue={CATEGORY_HUE[item.category] ?? 300} height={size} glowOnly style={{ borderRadius: 0 }} />
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} /> : null}
      </View>
      <View style={styles.iconBubble}>
        <Text style={{ fontSize: 10, lineHeight: 13 }}>{CATEGORY_ICON[item.category] ?? "📍"}</Text>
      </View>
      {friend ? (
        <View style={[styles.tag, styles.friendTag]}>
          <View style={styles.faces}>
            {item.friends.slice(0, 2).map((f, k) => (
              <View key={String(f.userId)} style={{ marginLeft: k ? -6 : 0 }}>
                <Avatar name={f.displayName} url={f.avatarUrl} size={16} ring={colors.white} />
              </View>
            ))}
          </View>
          <Text style={[styles.tagText, { color: ratingColor(friend.score) }]}>{friend.score.toFixed(1)}</Text>
        </View>
      ) : item.publicScore !== undefined ? (
        <View style={[styles.tag, styles.publicTag]}>
          <Icon name="users" size={11} color="#555" />
          <Text style={[styles.tagText, { color: "#333" }]}>{item.publicScore.toFixed(1)}</Text>
        </View>
      ) : (
        <View style={[styles.tag, { backgroundColor: ratingColor(item.score) }]}>
          <Text style={[styles.tagText, { color: "#111" }]}>{item.score.toFixed(1)}</Text>
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: colors.white },
  wrap: { alignItems: "center", paddingTop: 4, paddingLeft: 4, maxWidth: 140 },
  photo: { overflow: "hidden", borderWidth: 2.5, backgroundColor: colors.surface, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  event: { borderStyle: "dashed", borderColor: colors.mid },
  selected: { transform: [{ scale: 1.12 }] },
  iconBubble: { position: "absolute", top: 0, left: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  tag: { marginTop: -9, flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1.5, borderColor: colors.white },
  friendTag: { backgroundColor: "#fff", borderColor: colors.accent, paddingLeft: 2 },
  publicTag: { backgroundColor: "#eeeeee", borderColor: "#ffffff" },
  faces: { flexDirection: "row" },
  tagText: { fontWeight: "800", fontSize: 11, lineHeight: 14 },
  name: { color: "#111", fontWeight: "600", fontSize: 11, lineHeight: 14, textShadowColor: "#fff", textShadowRadius: 3, marginTop: 1 },
});
