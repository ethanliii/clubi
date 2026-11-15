import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { ScoreBadge, Text } from "../../components";
import { categoryLabel } from "../../lib/format";
import { venuePath } from "../../lib/links";
import { colors, fontWeight, spacing } from "../../theme";
import { PlacePhoto } from "./PlacePhoto";
import type { RankedRowItem } from "./RankedRow";

/** A tall photo card for a sideways row: the place's photo with its name and score on it. Opens the venue. */
export function PhotoCard({ item }: { item: RankedRowItem }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      onPress={() => router.push(venuePath(item.kind, item.id))}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <PlacePhoto uri={item.imageUrl} category={item.category} width={156} height={204} round={16} scrim>
        <View style={styles.score}>
          <ScoreBadge score={item.score} size="md" />
        </View>
        <View style={styles.text}>
          <Text numberOfLines={2} style={styles.name}>
            {item.name}
          </Text>
          <Text numberOfLines={1} style={styles.kind}>
            {categoryLabel(item.category)}
          </Text>
        </View>
      </PlacePhoto>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  score: { position: "absolute", top: spacing.sm + 2, left: spacing.sm + 2 },
  text: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md, gap: spacing.xxs },
  name: { fontSize: 15, lineHeight: 19, fontWeight: fontWeight.bold, color: colors.white },
  kind: { fontSize: 12, lineHeight: 16, color: "rgba(255,255,255,0.72)" },
});
