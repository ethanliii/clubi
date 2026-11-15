import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { BackButton, Button, Chip, ChipRow, EmptyState, ListRow, Screen, SkeletonRows, Text, VenuePhoto } from "../components";
import { api, type SavedItem, type SaveType } from "../lib/api";
import { categoryHue, categoryLabel, formatEventTime } from "../lib/format";
import { venuePath } from "../lib/links";
import { useMutationToast } from "../lib/useMutationToast";
import { useNow } from "../lib/useNow";
import { colors, radius } from "../theme";

const TABS: { type: SaveType; label: string }[] = [
  { type: "want", label: "Want to go" },
  { type: "going", label: "Going" },
];

function Thumb({ item }: { item: SavedItem }) {
  const [failed, setFailed] = useState(false);
  if (item.imageUrl && !failed) {
    return <Image source={{ uri: item.imageUrl }} resizeMode="cover" onError={() => setFailed(true)} style={styles.thumb} />;
  }
  return (
    <View style={styles.thumbBox}>
      <VenuePhoto hue={categoryHue(item.category)} height={48} style={styles.thumbPhoto} />
    </View>
  );
}

/** Places I want to try and events I'm going to, from `api.saves.list`, newest first. */
export default function SavedScreen() {
  const [type, setType] = useState<SaveType>("want");
  const items = useQuery(api.saves.list, { type });
  const toggle = useMutationToast(api.saves.toggle, { success: "Removed" });
  const now = useNow();

  return (
    <Screen>
      <BackButton />
      <Text variant="heading" accessibilityRole="header">
        Saved
      </Text>
      <ChipRow>
        {TABS.map((tab) => (
          <Chip
            key={tab.type}
            label={tab.label}
            accessibilityLabel={tab.label}
            selected={tab.type === type}
            onPress={() => setType(tab.type)}
          />
        ))}
      </ChipRow>

      {items === undefined ? (
        <SkeletonRows count={5} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="Tap Save on any place to keep it here."
          body={type === "going" ? "Events you mark I'm going show up under Going." : undefined}
        />
      ) : (
        <View>
          {items.map((item) => (
            <ListRow
              key={`${item.type}-${item.id}`}
              title={item.name}
              subtitle={[categoryLabel(item.category), item.startsAt !== undefined ? formatEventTime(item.startsAt, now) : ""]
                .filter((part) => part !== "")
                .join(" · ")}
              left={<Thumb item={item} />}
              onPress={() => router.push(venuePath(item.kind, item.id))}
              right={
                <Button
                  title="Remove"
                  accessibilityLabel="Remove"
                  variant="ghost"
                  disabled={toggle.pending}
                  style={styles.remove}
                  onPress={() => void toggle.run({ kind: item.kind, id: item.id, type: item.type })}
                />
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.raised },
  thumbBox: { width: 48, height: 48 },
  thumbPhoto: { borderRadius: radius.md },
  remove: { width: "auto", paddingVertical: 8, paddingHorizontal: 14 },
});
