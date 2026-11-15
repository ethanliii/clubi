import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AvatarStack, ScoreBadge, Skeleton, Text } from "../../components";
import type { NearbyItem } from "../../lib/api";
import { venuePath } from "../../lib/links";
import { colors, fontWeight, spacing } from "../../theme";
import { cardLabel, friendsLine, metaLine, whenLine } from "./itemText";
import { Photo } from "./Photo";

const ROUND = 28;
/** Height for a given width: a tall 4:5 picture, the way a poster hangs. */
const heightFor = (width: number) => Math.round(width * 1.22);

/** The one place the backend ranked first for tonight: a big photo with its score and the reason on it. */
export function Hero({ item, now }: { item: NearbyItem; now: number }) {
  const [width, setWidth] = useState(354);
  const height = heightFor(width);
  const when = whenLine(item, now);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cardLabel(item)}
      onPress={() => router.push(venuePath(item.kind, item.id))}
      onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
      style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
    >
      <Photo item={item} width={width} height={height} round={ROUND}>
        <LinearGradient
          colors={["rgba(8,6,12,0)", "rgba(8,6,12,0.5)", "rgba(8,6,12,0.88)", "rgba(8,6,12,0.97)"]}
          locations={[0, 0.3, 0.58, 1]}
          style={styles.scrim}
        />
        <View style={styles.score}>
          <ScoreBadge score={item.score} size="lg" />
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Top pick for you</Text>
          <Text numberOfLines={2} style={styles.name}>
            {item.name}
          </Text>
          <Text numberOfLines={2} style={styles.why}>
            {item.why}
          </Text>
          <View style={styles.foot}>
            <AvatarStack people={item.friends} size={26} />
            <Text numberOfLines={1} style={styles.meta}>
              {item.friends.length > 0 ? friendsLine(item) : [when, metaLine(item)].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>
      </Photo>
    </Pressable>
  );
}

/** The hero's shape while the first answer is on its way. */
export function HeroSkeleton() {
  return <Skeleton height={heightFor(354)} round={ROUND} />;
}

const styles = StyleSheet.create({
  hero: { width: "100%" },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "72%" },
  score: { position: "absolute", top: 16, right: 16 },
  copy: { position: "absolute", left: 20, right: 20, bottom: 20, gap: 6 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.semibold, color: colors.white, opacity: 0.85 },
  name: { fontSize: 30, lineHeight: 34, fontWeight: fontWeight.bold, letterSpacing: -0.6, color: colors.white },
  why: { fontSize: 15, lineHeight: 21, color: colors.white, opacity: 0.92 },
  foot: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4 },
  meta: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.white, opacity: 0.7 },
});
