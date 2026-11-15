import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { colors, radius } from "../../theme";

/**
 * A post's photos (0–4): one is shown wide, more are shown as a grid of two columns.
 * A photo that fails to load is left out. Tapping one calls `onPress` (the feed opens the venue).
 */
export function PostPhotos({
  urls,
  name,
  onPress,
}: {
  urls: string[];
  /** The place's name, for the accessibility label. */
  name: string;
  onPress?: () => void;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const shown = urls.filter((url) => !failed.includes(url));
  if (shown.length === 0) return null;
  const single = shown.length === 1;
  return (
    <View style={styles.grid}>
      {shown.map((url, index) => (
        <Pressable
          key={url}
          accessibilityRole="button"
          accessibilityLabel={single ? `Photo of ${name}` : `Photo ${index + 1} of ${name}`}
          disabled={!onPress}
          onPress={onPress}
          style={({ pressed }) => [
            styles.tile,
            single ? styles.single : styles.multi,
            shown.length > 2 && styles.small,
            pressed && styles.pressed,
          ]}
        >
          <Image
            source={{ uri: url }}
            resizeMode="cover"
            onError={() => setFailed((list) => (list.includes(url) ? list : [...list, url]))}
            style={styles.image}
          />
        </Pressable>
      ))}
    </View>
  );
}

// Bryan's feed photos: 190 tall, side by side, a lone photo at 70% width.
const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tile: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.raised },
  single: { width: "70%", height: 190 },
  // Two per line; an odd last photo stretches across.
  multi: { flexBasis: "45%", flexGrow: 1, height: 190 },
  // Three or four make two lines, so each is shorter.
  small: { height: 140 },
  image: { width: "100%", height: "100%" },
  pressed: { opacity: 0.8 },
});
