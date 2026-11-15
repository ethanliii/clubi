import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { BackButton, Button, Chip, ChipRow, EmptyState, Screen, SkeletonRows, Text } from "../components";
import { RankedRow } from "../features/profile";
import { api, type Bucket, type Category, type RankedListItem } from "../lib/api";
import { confirm } from "../lib/confirm";
import { CATEGORY_TABS, formatRelativeTime } from "../lib/format";
import { paths } from "../lib/links";
import { useMutationToast } from "../lib/useMutationToast";
import { useNow } from "../lib/useNow";
import { spacing } from "../theme";

const BUCKET_LABELS: Record<Bucket, string> = {
  loved: "Loved it",
  fine: "It was fine",
  didnt: "Didn't like it",
};

/** My ranked list for one category, from `api.rankings.mine`, best first as the backend sorted it. */
export default function RankingsScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [picked, setPicked] = useState<Category | null>(null);
  const now = useNow();
  // Every category at once: only used to open on a tab that has something in it, and to know "nothing at all".
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

  return (
    <Screen>
      <BackButton />
      <Text variant="heading" accessibilityRole="header">
        My rankings
      </Text>
      <ChipRow scroll>
        {CATEGORY_TABS.map((tab) => (
          <Chip
            key={tab.category}
            label={tab.label}
            accessibilityLabel={tab.label}
            selected={tab.category === category}
            onPress={() => setPicked(tab.category)}
          />
        ))}
      </ChipRow>

      {items === undefined ? (
        <SkeletonRows count={6} avatar={false} />
      ) : items.length === 0 ? (
        nothingAtAll ? (
          <EmptyState
            icon="star"
            title="Nothing ranked yet"
            body="Rank the places you go and your lists build themselves here."
            actionLabel="Rank your first place"
            onAction={() => router.push(paths.rate)}
          />
        ) : (
          <EmptyState
            icon="star"
            title={`Nothing ranked in ${tabLabel} yet`}
            actionLabel="Rank a place"
            onAction={() => router.push(paths.rate)}
          />
        )
      ) : (
        <View>
          {items.map((item) => (
            <RankedRow
              key={item.rankingId}
              item={item}
              ring
              subtitle={`${BUCKET_LABELS[item.bucket]} · ${formatRelativeTime(item.rankedAt, now)}`}
              trailing={
                <Button
                  title="Remove"
                  accessibilityLabel="Remove"
                  variant="ghost"
                  disabled={remove.pending}
                  style={styles.remove}
                  onPress={() => void onRemove(item)}
                />
              }
            />
          ))}
          <Text variant="caption" muted style={styles.note}>
            Removing a ranking also removes its post.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  remove: { width: "auto", paddingVertical: 8, paddingHorizontal: 14 },
  note: { paddingTop: spacing.md },
});
