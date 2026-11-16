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
import { Text } from "../../components";
import { colors, fontWeight, palette } from "../../theme";

/** The picture's shape: a little wider than tall, like a photo in a feed. */
const PHOTO_HEIGHT = 260;
const RADIUS = 10;

/**
 * The picture under a post's headline: the author's own photos when the post has any (swipe between
 * them), otherwise the place's photo. With neither, or when they fail to load, nothing is drawn and
 * the post reads as text.
 */
export function PostMedia({
  photoUrls,
  placePhotoUrl,
  name,
  onPress,
}: {
  /** The author's photos, 0–4. */
  photoUrls: string[];
  /** The place's or event's own photo, when the backend sends one. */
  placePhotoUrl?: string;
  /** The place's name, for the button's label. */
  name: string;
  onPress: () => void;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  const own = photoUrls.filter((url) => !failed.includes(url));
  const photos = own.length > 0 ? own : placePhotoUrl && !failed.includes(placePhotoUrl) ? [placePhotoUrl] : [];
  const fail = (url: string) => setFailed((list) => (list.includes(url) ? list : [...list, url]));

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  if (photos.length === 0) return null;

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.frame}>
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
              style={{ width, height: PHOTO_HEIGHT }}
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
          <Image source={{ uri: photos[0] }} resizeMode="cover" onError={() => fail(photos[0])} style={styles.image} />
        </Pressable>
      )}
      {/* Which photo this is, on its own small dark pill so it reads on any picture. */}
      {photos.length > 1 ? (
        <>
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {Math.min(page + 1, photos.length)}/{photos.length}
            </Text>
          </View>
          <View style={styles.dots}>
            {photos.map((url, index) => (
              <View key={url} style={[styles.dot, index === Math.min(page, photos.length - 1) && styles.dotOn]} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

export const POST_MEDIA_HEIGHT = PHOTO_HEIGHT;
export const POST_MEDIA_RADIUS = RADIUS;

const styles = StyleSheet.create({
  frame: { width: "100%", height: PHOTO_HEIGHT, borderRadius: RADIUS, overflow: "hidden", backgroundColor: colors.surface },
  image: { width: "100%", height: "100%" },
  pressed: { opacity: 0.9 },
  counter: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
    pointerEvents: "none",
  },
  dots: { position: "absolute", left: 0, right: 0, bottom: 10, flexDirection: "row", justifyContent: "center", gap: 5, pointerEvents: "none" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotOn: { backgroundColor: palette.onPhoto },
  counterText: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.semibold, color: palette.onPhoto, fontVariant: ["tabular-nums"] },
});
