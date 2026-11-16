import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ScoreBadge, Text } from "../../components";
import type { Category, Id, Kind } from "../../lib/api";
import { categoryLabel } from "../../lib/format";
import { venuePath } from "../../lib/links";
import { colors, fontWeight, palette, spacing } from "../../theme";

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
 * One line of a ranked list, exactly as the backend sent it: "1. Name", a grey line under it
 * (`subtitle`, else the kind of place) and the score in its ring at the right.
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
    <View style={[styles.row, divider && styles.divider]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.name}
        onPress={() => router.push(venuePath(item.kind, item.id))}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <View style={styles.text}>
          <Text numberOfLines={2} style={styles.name}>
            {showPosition ? `${item.position}. ${item.name}` : item.name}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {subtitle ?? categoryLabel(item.category)}
          </Text>
        </View>
        <ScoreBadge score={item.score} size="md" style={styles.score} />
      </Pressable>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.hairline },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 68, paddingVertical: spacing.md },
  pressed: { opacity: 0.55 },
  text: { flex: 1, gap: spacing.xxs },
  name: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: colors.fg },
  meta: { fontSize: 13, lineHeight: 17, color: colors.muted },
  score: { alignSelf: "center" },
});
