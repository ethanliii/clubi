import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Text, VenuePhoto } from "../../components";
import { colors, fontWeight, ratingColor } from "../../theme";

/** How tall the picture is: a real photo gets room, the category look stays compact. */
const PHOTO_HEIGHT = 320;
const PLAIN_HEIGHT = 176;
const RADIUS = 22;

/**
 * The picture a post leads with, with the place's name and the score on it.
 * Shows the author's own photos when the post has any (swipe between them), otherwise the place's
 * photo, otherwise the shared category look. A photo that fails to load is skipped the same way.
 */
export function PostMedia({
  photoUrls,
  placePhotoUrl,
  name,
  detail,
  score,
  hue,
  onPress,
}: {
  /** The author's photos, 0–4. */
  photoUrls: string[];
  /** The place's or event's own photo, when the backend sends one. */
  placePhotoUrl?: string;
  name: string;
  /** One quiet line under the name, e.g. "Nightlife". */
  detail?: string;
  /** Drawn large in its rating colour. Left out when there is no score. */
  score?: number;
  /** For the category look when there is no photo. */
  hue: number;
  onPress: () => void;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  const own = photoUrls.filter((url) => !failed.includes(url));
  const photos = own.length > 0 ? own : placePhotoUrl && !failed.includes(placePhotoUrl) ? [placePhotoUrl] : [];
  const height = photos.length > 0 ? PHOTO_HEIGHT : PLAIN_HEIGHT;
  const fail = (url: string) => setFailed((list) => (list.includes(url) ? list : [...list, url]));

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.frame, { height }]}>
      {photos.length > 1 && width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          style={StyleSheet.absoluteFill}
        >
          {photos.map((url, index) => (
            <Pressable
              key={url}
              accessibilityRole="button"
              accessibilityLabel={`Open ${name}, photo ${index + 1} of ${photos.length}`}
              onPress={onPress}
              style={{ width, height }}
            >
              <Image source={{ uri: url }} resizeMode="cover" onError={() => fail(url)} style={styles.image} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${name}`}
          onPress={onPress}
          style={({ pressed }) => [StyleSheet.absoluteFill, pressed && styles.pressed]}
        >
          {photos.length === 1 ? (
            <Image
              source={{ uri: photos[0] }}
              resizeMode="cover"
              onError={() => fail(photos[0])}
              style={styles.image}
            />
          ) : (
            <VenuePhoto hue={hue} height={height} style={styles.plain} />
          )}
        </Pressable>
      )}

      {/* Everything drawn over the picture lets taps and swipes through to it. */}
      <LinearGradient
        colors={["rgba(8,6,12,0)", "rgba(8,6,12,0.55)", "rgba(8,6,12,0.92)"]}
        locations={[0, 0.55, 1]}
        style={styles.scrim}
      />
      {photos.length > 1 ? (
        <View style={styles.dots}>
          {photos.map((url, index) => (
            <View key={url} style={[styles.dot, index === page && styles.dotOn]} />
          ))}
        </View>
      ) : null}
      <View style={styles.caption}>
        <View style={styles.words}>
          <Text numberOfLines={2} style={styles.name}>
            {name}
          </Text>
          {detail ? (
            <Text numberOfLines={1} style={styles.detail}>
              {detail}
            </Text>
          ) : null}
        </View>
        {score !== undefined ? (
          <Text accessibilityLabel={`Score ${score.toFixed(1)}`} style={[styles.score, { color: ratingColor(score) }]}>
            {score.toFixed(1)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export const POST_MEDIA_HEIGHT = PHOTO_HEIGHT;
export const POST_MEDIA_RADIUS = RADIUS;

const styles = StyleSheet.create({
  frame: { width: "100%", borderRadius: RADIUS, overflow: "hidden", backgroundColor: colors.surface },
  image: { width: "100%", height: "100%" },
  plain: { borderRadius: 0 },
  pressed: { opacity: 0.85 },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "62%", pointerEvents: "none" },
  dots: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    pointerEvents: "none",
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.45)" },
  dotOn: { backgroundColor: colors.white },
  caption: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    pointerEvents: "none",
  },
  words: { flex: 1, gap: 2 },
  name: { fontSize: 22, lineHeight: 26, fontWeight: fontWeight.bold, letterSpacing: -0.3, color: colors.white },
  detail: { fontSize: 13, lineHeight: 18, color: "rgba(255,255,255,0.72)" },
  score: {
    fontSize: 40,
    lineHeight: 42,
    fontWeight: "800",
    letterSpacing: -1.2,
    fontVariant: ["tabular-nums"],
  },
});
