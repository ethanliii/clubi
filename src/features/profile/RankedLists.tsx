import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { Bucket, Category, ProfileResult } from "../../lib/api";
import { CATEGORY_TABS, categoryLabel } from "../../lib/format";
import { spacing } from "../../theme";
import { CategoryTabs } from "./CategoryTabs";
import { RankedRow } from "./RankedRow";
import { SectionLabel } from "./SectionLabel";

/** The pill's name for a category: the same short word the rankings screen uses ("Bars", "Food", "Shows"). */
const tabLabelOf = (category: Category, noun: string) =>
  CATEGORY_TABS.find((tab) => tab.category === category)?.label ?? noun.charAt(0).toUpperCase() + noun.slice(1);

export const BUCKET_LABELS: Record<Bucket, string> = {
  loved: "Loved it",
  fine: "It was fine",
  didnt: "Didn't like it",
};

/**
 * A profile's ranked lists: "All" first (the best across every list, by the backend's scores), then
 * one pill per category in the backend's order, the picked list below as numbered rows. It shows its first `limit` rows. "See all" opens `onSeeAll(category)` when given (my own
 * profile → the rankings screen); otherwise it unfolds the rest of the list in place.
 */
export function RankedLists({
  lists,
  limit = 3,
  onSeeAll,
}: {
  lists: ProfileResult["lists"];
  limit?: number;
  onSeeAll?: (category?: Category) => void;
}) {
  const [picked, setPicked] = useState<Category | "all">("all");
  const [open, setOpen] = useState<(Category | "all")[]>([]);
  if (lists.length === 0) return null;
  // With one list "All" would say the same thing twice.
  const withAll = lists.length > 1;
  const list = lists.find((each) => each.category === picked) ?? (withAll ? undefined : lists[0]);
  const key: Category | "all" = list ? list.category : "all";
  const items = list ? list.items : lists.flatMap((each) => each.items).sort((a, b) => b.score - a.score);
  const noun = list ? list.noun : "rankings";
  const expanded = open.includes(key);
  const rows = expanded ? items : items.slice(0, limit);
  const more = items.length > limit;
  const action = onSeeAll
    ? { label: "See all", run: () => onSeeAll(list?.category) }
    : more
      ? {
          label: expanded ? "Show less" : "See all",
          run: () => setOpen((current) => (expanded ? current.filter((each) => each !== key) : [...current, key])),
        }
      : null;
  const tabs: { category: Category | "all"; label: string; count?: number }[] = lists.map((each) => ({
    category: each.category,
    label: tabLabelOf(each.category, each.noun),
    count: each.items.length,
  }));
  if (withAll) tabs.unshift({ category: "all", label: "All", count: items.length === 0 ? undefined : lists.reduce((sum, each) => sum + each.items.length, 0) });
  return (
    <View style={styles.section}>
      <SectionLabel
        title="Rankings"
        actionLabel={action?.label}
        onAction={action?.run}
        actionAccessibilityLabel={action ? `${action.label} ${noun}` : undefined}
      />
      <CategoryTabs
        tabs={tabs}
        selected={key}
        onSelect={setPicked}
      />
      <View>
        {rows.map((item, index) => (
          <RankedRow
            key={item.rankingId}
            item={list ? item : { ...item, position: index + 1 }}
            subtitle={`${categoryLabel(item.category)} · ${BUCKET_LABELS[item.bucket]}`}
            divider={index < rows.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs, paddingTop: spacing.sm },
});
