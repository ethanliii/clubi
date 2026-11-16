import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ScoreBadge, Text } from "../../components";
import { venuePath } from "../../lib/links";
import { colors, fontWeight, spacing } from "../../theme";
import { PlacePhoto } from "./PlacePhoto";
import type { RankedRowItem } from "./RankedRow";

/**
 * The top of a ranked list: number one as a big photo with its name and score on it.
 * `corner` sits on the photo's top right, outside the tappable part (the "Remove" button).
 */
export function LeaderCard({ item, subtitle, corner }: { item: RankedRowItem; subtitle?: string; corner?: ReactNode }) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.name}
        onPress={() => router.push(venuePath(item.kind, item.id))}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <PlacePhoto uri={item.imageUrl} category={item.category} height={236} round={20} scrim>
          <View style={styles.bottom}>
            <Text style={styles.position}>{item.position}</Text>
            <View style={styles.text}>
              <Text numberOfLines={2} style={styles.name}>
                {item.name}
              </Text>
              {subtitle ? (
                <Text numberOfLines={1} style={styles.subtitle}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <View>
              <ScoreBadge score={item.score} size="lg" />
            </View>
          </View>
        </PlacePhoto>
      </Pressable>
      {corner ? <View style={styles.corner}>{corner}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  bottom: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
  },
  position: {
    fontSize: 56,
    lineHeight: 56,
    fontWeight: fontWeight.bold,
    letterSpacing: -2,
    color: colors.white,
    fontVariant: ["tabular-nums"],
  },
  text: { flex: 1, gap: spacing.xxs, paddingBottom: spacing.xxs },
  name: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
    color: colors.white,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 1 },
  },
  subtitle: { fontSize: 13, lineHeight: 17, color: "rgba(255,255,255,0.85)" },
  corner: { position: "absolute", top: spacing.sm + 2, right: spacing.sm + 2 },
});
