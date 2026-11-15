import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ScoreBadge, Text } from "../../components";
import type { Id, Kind } from "../../lib/api";
import { venuePath } from "../../lib/links";
import { colors, fontWeight, ratingColor, spacing } from "../../theme";

export type RankedRowItem = {
  kind: Kind;
  id: Id<"places"> | Id<"events">;
  name: string;
  score: number;
  position: number;
};

/**
 * One line of a ranked list, exactly as the backend sent it: its position, its name and its score.
 * Tapping it opens the venue. `trailing` sits outside the tappable part (a "Remove" button).
 */
export function RankedRow({
  item,
  subtitle,
  showPosition = true,
  ring = false,
  trailing,
}: {
  item: RankedRowItem;
  subtitle?: string;
  /** Hide the number when the rows come from different lists (compare's "new to me"). */
  showPosition?: boolean;
  /** The score in a rating-coloured ring (the full rankings list) instead of the small badge. */
  ring?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.name}
        onPress={() => router.push(venuePath(item.kind, item.id))}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        {showPosition ? (
          <Text muted style={styles.position}>
            {item.position}
          </Text>
        ) : null}
        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.name}>
            {item.name}
          </Text>
          {subtitle ? (
            <Text variant="caption" muted numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {ring ? (
          <View accessibilityLabel={`Score ${item.score.toFixed(1)}`} style={[styles.ring, { borderColor: ratingColor(item.score) }]}>
            <Text style={[styles.ringText, { color: ratingColor(item.score) }]}>{item.score.toFixed(1)}</Text>
          </View>
        ) : (
          <ScoreBadge score={item.score} size="sm" />
        )}
      </Pressable>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: spacing.sm + 2 },
  pressed: { opacity: 0.6 },
  position: { width: 22, fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
  text: { flex: 1, gap: spacing.xxs },
  name: { fontWeight: fontWeight.bold },
  ring: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  ringText: { fontSize: 13, fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
});
