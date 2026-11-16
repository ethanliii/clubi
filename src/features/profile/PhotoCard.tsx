import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../components";
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
      <PlacePhoto uri={item.imageUrl} category={item.category} width={156} height={196} round={12} scrim>
        <View style={styles.text}>
          <Text numberOfLines={2} style={styles.name}>
            {item.name}
          </Text>
          <View style={styles.foot}>
            <Text numberOfLines={1} style={styles.kind}>
              {categoryLabel(item.category)}
            </Text>
            <View style={styles.ring}>
              <Text style={styles.ringText}>{item.score.toFixed(1)}</Text>
            </View>
          </View>
        </View>
      </PlacePhoto>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  text: { position: "absolute", left: spacing.md, right: spacing.sm + 2, bottom: spacing.sm + 2, gap: spacing.xxs },
  foot: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  // Nothing sits on top of the photo: the score is a thin white ring in the fade.
  ring: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  ringText: { fontSize: 12, lineHeight: 15, fontWeight: fontWeight.bold, color: colors.white, fontVariant: ["tabular-nums"] },
  name: { fontSize: 15, lineHeight: 19, fontWeight: fontWeight.bold, color: colors.white },
  kind: { flex: 1, fontSize: 12, lineHeight: 16, color: "rgba(255,255,255,0.72)" },
});
