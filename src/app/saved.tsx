import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { EmptyState, Header, Icon, IconButton, Screen, SectionHeader, Skeleton, Text, VenuePhoto } from "../components";
import { api, type SavedItem, type SaveType } from "../lib/api";
import { categoryHue, categoryLabel, displayName, formatEventTime } from "../lib/format";
import { paths, venuePath } from "../lib/links";
import { useMutationToast } from "../lib/useMutationToast";
import { useNow } from "../lib/useNow";
import { colors, fontSize, fontWeight, palette, radius, spacing } from "../theme";

const TABS: { type: SaveType; label: string; icon: "bookmark" | "calendar" }[] = [
  { type: "want", label: "Want to go", icon: "bookmark" },
  { type: "going", label: "Going", icon: "calendar" },
];

const PHOTO = 72;

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
            {displayName(item.name)}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {categoryLabel(item.category)}
          </Text>
          {item.startsAt !== undefined ? (
            <Text numberOfLines={1} style={styles.when}>
              {formatEventTime(item.startsAt, now)}
            </Text>
          ) : null}
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
          <Skeleton width={PHOTO} height={PHOTO} round={radius.md} />
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
              hitSlop={{ top: 4, bottom: 4 }}
              style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}
            >
              <Icon name={tab.icon} size={16} color={on ? colors.white : colors.fg} />
              <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {items === undefined ? (
        <SkeletonList />
      ) : items.length === 0 ? (
        <EmptyState
          icon={type === "going" ? "calendar" : "bookmark"}
          title={type === "going" ? "Nothing on your calendar" : "Nothing saved yet"}
          body={
            type === "going"
              ? "Tap I'm going on an event and it shows up here."
              : "Tap the bookmark on any place to keep it here."
          }
          actionLabel={type === "going" ? "Browse events" : "Find places"}
          onAction={() => router.push(type === "going" ? paths.recs : paths.map)}
        />
      ) : (
        <View style={styles.list}>
          <SectionHeader title={type === "going" ? "Going" : "Want to go"} count={items.length} style={styles.count} />
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
  // Two light-grey pills, a line icon and a bold label each; the chosen one fills black.
  tabs: { flexDirection: "row", gap: spacing.sm },
  tab: {
    flexDirection: "row",
    gap: 7,
    height: 38,
    paddingHorizontal: 15,
    borderRadius: radius.pill,
    backgroundColor: palette.field,
    alignItems: "center",
    justifyContent: "center",
  },
  tabOn: { backgroundColor: colors.fg },
  tabLabel: { fontSize: 15, lineHeight: 19, fontWeight: fontWeight.bold, color: colors.fg },
  tabLabelOn: { color: colors.white },
  list: { paddingTop: spacing.sm },
  count: { paddingBottom: 2 },
  when: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.semibold, color: colors.accent },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.bodyLg, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  meta: { fontSize: 13, lineHeight: 18, color: colors.muted },
  photo: { width: PHOTO, borderRadius: radius.md, backgroundColor: colors.surface },
});
