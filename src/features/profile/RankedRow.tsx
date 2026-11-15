import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ScoreBadge, Text } from "../../components";
import type { Category, Id, Kind } from "../../lib/api";
import { venuePath } from "../../lib/links";
import { colors, fontWeight, spacing } from "../../theme";
import { PlacePhoto } from "./PlacePhoto";

export type RankedRowItem = {
  kind: Kind;
  id: Id<"places"> | Id<"events">;
  name: string;
  category: Category;
  score: number;
  position: number;
  imageUrl?: string;
};

/**
 * One line of a ranked list, exactly as the backend sent it: its position, photo, name and score.
 * Tapping it opens the venue. `trailing` sits outside the tappable part (the "Remove" button).
 */
export function RankedRow({
  item,
  subtitle,
  showPosition = true,
  divider = true,
  trailing,
}: {
  item: RankedRowItem;
  subtitle?: string;
  /** Hide the number when the rows come from different lists. */
  showPosition?: boolean;
  /** The hairline under the row; the last row of a list leaves it out. */
  divider?: boolean;
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
          <Text style={[styles.position, item.position === 1 && styles.first]}>{item.position}</Text>
        ) : null}
        <PlacePhoto uri={item.imageUrl} category={item.category} width={56} height={56} round={12} />
        <View style={[styles.rest, divider && styles.divider]}>
          <View style={styles.text}>
            <Text numberOfLines={2} style={styles.name}>
              {item.name}
            </Text>
            {subtitle ? (
              <Text variant="caption" muted numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {/* The badge aligns itself to the top; the wrapper centres it on the row. */}
          <View style={styles.score}>
            <ScoreBadge score={item.score} size="md" />
          </View>
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  pressed: { opacity: 0.6 },
  position: {
    width: 20,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: fontWeight.bold,
    fontVariant: ["tabular-nums"],
    color: colors.muted,
  },
  first: { color: colors.fg },
  // The hairline starts at the text, not under the photo, so the photos read as one column.
  rest: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 76,
    paddingVertical: 10,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  text: { flex: 1, gap: spacing.xxs },
  score: { minWidth: 44, alignItems: "flex-end" },
  name: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.semibold },
});
