import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { EmptyState, Header, IconButton, Screen, Skeleton } from "../components";
import { CategoryTabs, RankedRow } from "../features/profile";
import { api, type Bucket, type Category, type RankedListItem } from "../lib/api";
import { confirm } from "../lib/confirm";
import { CATEGORY_TABS, formatRelativeTime } from "../lib/format";
import { paths } from "../lib/links";
import { useMutationToast } from "../lib/useMutationToast";
import { useNow } from "../lib/useNow";
import { colors, spacing } from "../theme";

const BUCKET_LABELS: Record<Bucket, string> = {
  loved: "Loved it",
  fine: "It was fine",
  didnt: "Didn't like it",
};

/** My ranked list for one category, from `api.rankings.mine`, best first as the backend sorted it. */
/** To the Rank tab of the tabs already underneath, not a second copy of them on top of this screen. */
function openRate() {
  if (router.canDismiss()) router.dismissAll();
  router.replace(paths.rate);
}

export default function RankingsScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [picked, setPicked] = useState<Category | null>(null);
  const now = useNow();
  // Every category at once: to open on a tab that has something in it, to count each tab, and to know "nothing at all".
  const everything = useQuery(api.rankings.mine, {});
  const fromLink = CATEGORY_TABS.find((tab) => tab.category === params.category)?.category;
  const firstUsed =
    everything === undefined
      ? undefined
      : (CATEGORY_TABS.find((tab) => everything.some((item) => item.category === tab.category))?.category ?? "nightlife");
  const category = picked ?? fromLink ?? firstUsed;
  const items = useQuery(api.rankings.mine, category === undefined ? "skip" : { category });
  const remove = useMutationToast(api.rankings.remove, { success: "Removed" });

  const onRemove = async (item: RankedListItem) => {
    const sure = await confirm({
      title: `Remove ${item.name}?`,
      message: "This deletes your ranking and its post.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (sure) await remove.run({ rankingId: item.rankingId });
  };

  const tabLabel = CATEGORY_TABS.find((tab) => tab.category === category)?.label ?? "";
  const nothingAtAll = everything !== undefined && everything.length === 0;
  const tabs = CATEGORY_TABS.map((tab) => ({
    ...tab,
    count: everything?.filter((item) => item.category === tab.category).length,
  }));
  const subtitleOf = (item: RankedListItem) => `${BUCKET_LABELS[item.bucket]} · ${formatRelativeTime(item.rankedAt, now)}`;

  return (
    <Screen>
      <Header
        title="My rankings"
        subtitle={everything !== undefined && everything.length > 0 ? `${everything.length} ranked · Best first` : undefined}
      />
      {nothingAtAll ? null : <CategoryTabs tabs={tabs} selected={category} onSelect={setPicked} />}

      {items === undefined ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.loading}>
          {[0, 1, 2, 3, 4].map((row) => (
            <View key={row} style={styles.loadingRow}>
              <Skeleton width={56} height={56} round={10} />
              <View style={styles.loadingLines}>
                <Skeleton width="60%" height={15} />
                <Skeleton width="35%" height={11} />
              </View>
              <Skeleton width={44} height={44} round={22} />
            </View>
          ))}
        </View>
      ) : items.length === 0 ? (
        nothingAtAll ? (
          <EmptyState
            icon="star"
            title="Nothing ranked yet"
            body="Rank a place you've been and your lists start here."
            actionLabel="Rank your first place"
            onAction={openRate}
          />
        ) : (
          <EmptyState
            icon="star"
            title={`Nothing ranked in ${tabLabel} yet`}
            actionLabel="Rank a place"
            onAction={openRate}
          />
        )
      ) : (
        <View style={styles.list}>
          <View>
            {items.map((item, index) => (
              <RankedRow
                key={item.rankingId}
                item={item}
                subtitle={subtitleOf(item)}
                divider={index < items.length - 1}
                trailing={
                  <IconButton
                    icon="trash"
                    accessibilityLabel="Remove"
                    plain
                    size={44}
                    color={colors.low}
                    disabled={remove.pending}
                    style={styles.remove}
                    onPress={() => void onRemove(item)}
                  />
                }
              />
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  // Pull the icon to the screen edge so its glyph lines up with the score column's right side.
  remove: { marginRight: -spacing.md },
  loading: { gap: spacing.lg },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  loadingLines: { flex: 1, gap: spacing.sm },
});
