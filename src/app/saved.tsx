import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { EmptyState, Header, IconButton, Screen, Skeleton, Text, VenuePhoto } from "../components";
import { api, type SavedItem, type SaveType } from "../lib/api";
import { categoryHue, categoryLabel, formatEventTime } from "../lib/format";
import { venuePath } from "../lib/links";
import { useMutationToast } from "../lib/useMutationToast";
import { useNow } from "../lib/useNow";
import { colors, fontSize, fontWeight, palette, radius, spacing } from "../theme";

const TABS: { type: SaveType; label: string }[] = [
  { type: "want", label: "Want to go" },
  { type: "going", label: "Going" },
];

const PHOTO = 88;

/** One saved place: photo, name, when it is on. The filled mark on the right takes it off the list. */
function SavedRow({
  item,
  now,
  busy,
  onRemove,
}: {
  item: SavedItem;
  now: number;
  busy: boolean;
  onRemove: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.name}
        onPress={() => router.push(venuePath(item.kind, item.id))}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
      >
        <VenuePhoto
          uri={item.imageUrl}
          category={item.category}
          hue={categoryHue(item.category)}
          height={PHOTO}
          style={styles.photo}
        />
        <View style={styles.rowText}>
          <Text numberOfLines={2} style={styles.name}>
            {item.name}
          </Text>
          {item.startsAt !== undefined ? (
            <Text numberOfLines={1} style={styles.when}>
              {formatEventTime(item.startsAt, now)}
            </Text>
          ) : null}
          <Text numberOfLines={1} style={styles.meta}>
            {categoryLabel(item.category)}
          </Text>
        </View>
      </Pressable>
      <IconButton
        icon={item.type === "going" ? "check" : "bookmarkFilled"}
        accessibilityLabel="Remove"
        plain
        size={44}
        color={colors.accent}
        disabled={busy}
        onPress={onRemove}
      />
    </View>
  );
}

function SkeletonList() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.list}>
      {[0, 1, 2, 3].map((key) => (
        <View key={key} style={styles.rowMain}>
          <Skeleton width={PHOTO} height={PHOTO} round={radius.lg} />
          <View style={styles.rowText}>
            <Skeleton width={170} height={16} />
            <Skeleton width={90} height={12} />
          </View>
        </View>
      ))}
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
      <Header title="Saved" />
      <View accessibilityRole="tablist" style={styles.tabs}>
        {TABS.map((tab) => {
          const on = tab.type === type;
          return (
            <Pressable
              key={tab.type}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: on }}
              onPress={() => setType(tab.type)}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{tab.label}</Text>
              <View style={[styles.tabLine, on && styles.tabLineOn]} />
            </Pressable>
          );
        })}
      </View>

      {items === undefined ? (
        <SkeletonList />
      ) : items.length === 0 ? (
        <EmptyState
          icon={type === "going" ? "calendar" : "bookmark"}
          title={type === "going" ? "Nothing on your calendar yet." : "Tap Save on any place to keep it here."}
          body={type === "going" ? "Tap I'm going on an event and it shows up here." : undefined}
        />
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <SavedRow
              key={`${item.type}-${item.id}`}
              item={item}
              now={now}
              busy={toggle.pending}
              onRemove={() => void toggle.run({ kind: item.kind, id: item.id, type: item.type })}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    gap: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
  },
  tab: { minHeight: 44, justifyContent: "flex-end", gap: 10 },
  tabLabel: { fontSize: fontSize.bodyLg, lineHeight: 22, fontWeight: fontWeight.semibold, color: colors.muted },
  tabLabelOn: { color: colors.fg },
  tabLine: { height: 2, borderRadius: 1, backgroundColor: "transparent" },
  tabLineOn: { backgroundColor: colors.fg },
  list: { gap: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 3 },
  name: { fontSize: fontSize.bodyLg, lineHeight: 21, fontWeight: fontWeight.semibold },
  when: { fontSize: 13, lineHeight: 18 },
  meta: { fontSize: 13, lineHeight: 18, color: colors.muted },
  photo: { width: PHOTO, borderRadius: radius.lg },
});
