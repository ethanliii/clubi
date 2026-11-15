import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SectionHeader } from "../../components";
import type { Category, ProfileResult } from "../../lib/api";
import { spacing } from "../../theme";
import { RankedRow } from "./RankedRow";

/** "bars" → "Bars". The noun itself comes from the backend. */
const titleOf = (noun: string) => noun.charAt(0).toUpperCase() + noun.slice(1);

/**
 * A profile's ranked lists, one section per category, in the backend's order.
 * Each shows its first `limit` rows. "See all" opens `onSeeAll(category)` when given (my own
 * profile → the rankings screen); otherwise it unfolds the rest of the list in place.
 */
export function RankedLists({
  lists,
  limit = 3,
  onSeeAll,
}: {
  lists: ProfileResult["lists"];
  limit?: number;
  onSeeAll?: (category: Category) => void;
}) {
  const [open, setOpen] = useState<Category[]>([]);
  return (
    <>
      {lists.map((list) => {
        const expanded = open.includes(list.category);
        const rows = expanded ? list.items : list.items.slice(0, limit);
        const more = list.items.length > limit;
        const title = titleOf(list.noun);
        const action = onSeeAll
          ? { label: "See all", run: () => onSeeAll(list.category) }
          : more
            ? {
                label: expanded ? "Show less" : "See all",
                run: () =>
                  setOpen((current) =>
                    expanded ? current.filter((category) => category !== list.category) : [...current, list.category],
                  ),
              }
            : null;
        return (
          <View key={list.category} style={styles.section}>
            <SectionHeader
              title={title}
              actionLabel={action?.label}
              onAction={action?.run}
              actionAccessibilityLabel={action ? `${action.label} ${list.noun}` : undefined}
            />
            <View>
              {rows.map((item) => (
                <RankedRow key={item.rankingId} item={item} />
              ))}
            </View>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
});
