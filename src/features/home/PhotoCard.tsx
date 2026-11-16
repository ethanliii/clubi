import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AvatarStack, ScoreBadge, Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { venuePath } from "../../lib/links";
import { colors, fontWeight } from "../../theme";
import { cardLabel, friendsLine, metaLine, whenLine } from "./itemText";
import { Photo } from "./Photo";

export type CardShape = "tall" | "wide";

export const CARD_SIZES: Record<CardShape, { width: number; height: number }> = {
  tall: { width: 158, height: 198 },
  wide: { width: 272, height: 172 },
};

/**
 * One place or event in a sideways row: the photo with its score on the corner, then the name,
 * what it is, and the backend's reason. No box around it; the photo is the card.
 */
export function PhotoCard({ item, shape, now }: { item: NearbyItem; shape: CardShape; now: number }) {
  const { width, height } = CARD_SIZES[shape];
  const when = whenLine(item, now);
  const hasFriends = item.friends.length > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cardLabel(item)}
      onPress={() => router.push(venuePath(item.kind, item.id))}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <Photo item={item} width={width} height={height} round={18}>
        <View style={styles.score}>
          <ScoreBadge score={item.score} size="sm" />
        </View>
        {hasFriends ? (
          <>
            <LinearGradient colors={["rgba(8,6,12,0)", "rgba(8,6,12,0.7)"]} style={styles.scrim} />
            <View style={styles.friends}>
              <AvatarStack people={item.friends} size={26} />
            </View>
          </>
        ) : null}
      </Photo>
      <View style={styles.copy}>
        {when ? (
          <Text numberOfLines={1} style={styles.when}>
            {when}
          </Text>
        ) : null}
        <Text numberOfLines={2} style={styles.name}>
          {item.name}
        </Text>
        <Text numberOfLines={2} style={styles.why}>
          {item.why}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {hasFriends ? friendsLine(item) : metaLine(item)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  score: { position: "absolute", top: 10, left: 10 },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 64 },
  friends: { position: "absolute", left: 10, bottom: 10 },
  copy: { paddingTop: 10, gap: 3 },
  when: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.semibold, color: colors.fg, opacity: 0.8 },
  name: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.semibold, letterSpacing: -0.2, color: colors.fg },
  meta: { fontSize: 13, lineHeight: 18, color: colors.muted },
  why: { fontSize: 13, lineHeight: 18, color: colors.fg, opacity: 0.78 },
});
