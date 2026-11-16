import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../components";
import type { Id } from "../../lib/api";
import { venuePath } from "../../lib/links";
import { colors, fontWeight, palette, spacing } from "../../theme";
import { FavoritesPicker } from "./FavoritesPicker";
import { PlacePhoto } from "./PlacePhoto";
import { SectionLabel } from "./SectionLabel";
import { useFavorites } from "./useFavorites";

const COLUMNS = 3;
const GAP = 3;

/**
 * A profile's favorites as a photo grid: only the places that person marked as a favorite, in
 * their order, three to a row, each with its name and score on the photo. A tile opens the venue.
 * On my own profile (`mine`) the section also carries "Edit", which opens the sheet where I tick
 * them; with none marked it says how. Someone else's profile with none marked draws nothing.
 */
export function FavoritesGallery({
  userId,
  mine = false,
  hasRanked = true,
}: {
  userId: Id<"users">;
  mine?: boolean;
  /** Mine only: false while I have ranked nothing, so there is nothing to mark yet. */
  hasRanked?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const { posts, loading } = useFavorites(userId);
  // The picker's ticks: started from the saved favorites each time the sheet opens.
  const [picker, setPicker] = useState<{ open: boolean; picked: Id<"posts">[] }>({ open: false, picked: [] });

  const canEdit = mine && hasRanked && !loading;
  if (posts.length === 0 && !canEdit) return null;
  const openPicker = () => setPicker({ open: true, picked: posts.map((post) => post.postId) });
  const tile = width > 0 ? Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS) : 0;
  return (
    <View style={styles.section}>
      <SectionLabel
        title="Favorites"
        actionLabel={canEdit ? (posts.length > 0 ? "Edit" : "Choose") : undefined}
        actionAccessibilityLabel="Choose favorites"
        onAction={canEdit ? openPicker : undefined}
      />
      {posts.length === 0 ? (
        <Text muted style={styles.none}>
          Nothing marked yet. Choose the places you love most and they show here.
        </Text>
      ) : (
        <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.grid}>
          {tile > 0
            ? posts.map(({ postId, target, score }) => (
                <Pressable
                  key={postId}
                  accessibilityRole="button"
                  accessibilityLabel={`${target.name}, ${score.toFixed(1)}`}
                  onPress={() => router.push(venuePath(target.kind, target.id))}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <PlacePhoto uri={target.imageUrl} category={target.category} width={tile} height={Math.round(tile * 1.25)} round={6} scrim>
                    <View style={styles.text}>
                      <Text numberOfLines={2} style={styles.name}>
                        {target.name}
                      </Text>
                      <Text style={styles.score}>{score.toFixed(1)}</Text>
                    </View>
                  </PlacePhoto>
                </Pressable>
              ))
            : null}
        </View>
      )}
      {mine ? (
        <FavoritesPicker
          userId={userId}
          visible={picker.open}
          picked={picker.picked}
          onPick={(picked) => setPicker((state) => ({ ...state, picked }))}
          onClose={() => setPicker((state) => ({ ...state, open: false }))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, paddingTop: spacing.sm },
  none: { fontSize: 14, lineHeight: 19, color: colors.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  pressed: { opacity: 0.7 },
  text: { position: "absolute", left: 8, right: 8, bottom: 7, gap: 1 },
  name: { fontSize: 12.5, lineHeight: 16, fontWeight: fontWeight.bold, color: palette.onPhoto },
  score: { fontSize: 12, lineHeight: 15, fontWeight: fontWeight.bold, color: palette.onPhotoMuted, fontVariant: ["tabular-nums"] },
});
