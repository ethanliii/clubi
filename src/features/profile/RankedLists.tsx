import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SectionHeader } from "../../components";
import type { Bucket, Category, ProfileResult } from "../../lib/api";
import { categoryLabel } from "../../lib/format";
import { spacing } from "../../theme";
import { CategoryTabs } from "./CategoryTabs";
import { RankedRow } from "./RankedRow";

/** "bars" → "Bars". The noun itself comes from the backend. */
const titleOf = (noun: string) => noun.charAt(0).toUpperCase() + noun.slice(1);

export const BUCKET_LABELS: Record<Bucket, string> = {
  loved: "Loved it",
  fine: "It was fine",
  didnt: "Didn't like it",
};

/**
 * A profile's ranked lists: one pill per category in the backend's order, the picked list below
 * as numbered rows. It shows its first `limit` rows. "See all" opens `onSeeAll(category)` when given (my own
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
  const [picked, setPicked] = useState<Category | null>(null);
  const [open, setOpen] = useState<Category[]>([]);
  const list = lists.find((each) => each.category === picked) ?? lists[0];
  if (!list) return null;
  const expanded = open.includes(list.category);
  const rows = expanded ? list.items : list.items.slice(0, limit);
  const more = list.items.length > limit;
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
    <View style={styles.section}>
      <SectionHeader
        title="Rankings"
        actionLabel={action?.label}
        onAction={action?.run}
        actionAccessibilityLabel={action ? `${action.label} ${list.noun}` : undefined}
      />
      <CategoryTabs
        tabs={lists.map((each) => ({ category: each.category, label: titleOf(each.noun), count: each.items.length }))}
        selected={list.category}
        onSelect={setPicked}
      />
      <View>
        {rows.map((item, index) => (
          <RankedRow
            key={item.rankingId}
            item={item}
            subtitle={`${categoryLabel(item.category)} · ${BUCKET_LABELS[item.bucket]}`}
            divider={index < rows.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, paddingTop: spacing.sm },
});
