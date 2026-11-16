import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AvatarStack, ScoreBadge, Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { venuePath } from "../../lib/links";
import { colors, fontWeight } from "../../theme";
import { cardLabel, friendsLine, metaLine } from "./itemText";
import { Photo } from "./Photo";

export type CardShape = "large" | "medium";

/** The photo's size. The name and the grey line sit under it at the same width. */
export const CARD_SIZES: Record<CardShape, { width: number; height: number }> = {
  large: { width: 300, height: 168 },
  medium: { width: 210, height: 140 },
};
export const CARD_ROUND = 14;

/**
 * One place or event in a sideways row: the photo, then the name in bold with its score at the
 * right, then one grey line. No box around it; the photo is the card.
 */
export function PhotoCard({ item, shape, now }: { item: NearbyItem; shape: CardShape; now: number }) {
  const { width, height } = CARD_SIZES[shape];
  const hasFriends = item.friends.length > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cardLabel(item)}
      onPress={() => router.push(venuePath(item.kind, item.id))}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <Photo item={item} width={width} height={height} round={CARD_ROUND} />
      <View style={styles.under}>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.name}>
            {item.name}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {metaLine(item, now)}
          </Text>
          {hasFriends ? (
            <View style={styles.friends}>
              <AvatarStack people={item.friends} size={18} />
              <Text numberOfLines={1} style={[styles.meta, styles.flex]}>
                {friendsLine(item)}
              </Text>
            </View>
          ) : null}
        </View>
        <ScoreBadge score={item.score} size="sm" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
  under: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 8 },
  copy: { flex: 1, gap: 2 },
  name: { fontSize: 16, lineHeight: 20, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: colors.fg },
  meta: { fontSize: 13, lineHeight: 18, color: colors.muted },
  friends: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
});
