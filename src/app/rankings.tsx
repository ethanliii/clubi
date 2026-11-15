import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Category } from "../../convex/lib/contract";
import { BackButton, Chip, EmptyState, Screen, Skeleton, Text, openVenue } from "../components";
import { colors, radius, ratingColor, spacing } from "../theme";

type Tab = "been" | "want" | "going";
const CATS: { c: Category | undefined; label: string }[] = [
  { c: undefined, label: "All" }, { c: "nightlife", label: "Bars" }, { c: "food", label: "Food" }, { c: "culture", label: "Culture" },
  { c: "outdoors", label: "Outdoors" }, { c: "live", label: "Shows" }, { c: "popup", label: "Pop-ups" },
];

/** My lists, Beli-style: Been (my rankings) · Want to go · Going, by category, with View map. UI-SPEC §8, §14. */
export default function MyLists() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [tab, setTab] = useState<Tab>("been");
  const [category, setCategory] = useState<Category | undefined>(params.category as Category | undefined);
  const ranked = useQuery(api.rankings.mine, tab === "been" ? { category } : "skip");
  const saved = useQuery(api.saves.list, tab !== "been" ? { type: tab } : "skip");
  const savedRows = saved?.filter((s) => !category || s.category === category);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <BackButton />
        <Text variant="heading">My lists</Text>
        <View style={styles.tabs}>
          {(["been", "want", "going"] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
              <Text style={[styles.tabText, tab === t && { color: colors.fg }]}>{{ been: "Been", want: "Want to go", going: "Going" }[t]}</Text>
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CATS.map((x) => <Chip key={x.label} label={x.label} on={category === x.c} onPress={() => setCategory(x.c)} />)}
        </ScrollView>

        {tab === "been" ? (
          ranked === undefined ? <Skeleton height={240} /> : ranked.length === 0 ? (
            <EmptyState text="Rank your first place" action={<Chip label="Rank a spot" on onPress={() => router.push("/rate")} />} />
          ) : (
            ranked.map((r, i) => (
              <Pressable key={String(r.rankingId)} onPress={() => openVenue(r)} style={styles.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontWeight: "700" }}>{category ? r.position : i + 1}. {r.name}</Text>
                  <Text variant="caption" muted style={{ textTransform: "capitalize" }}>{r.category}</Text>
                </View>
                <View style={[styles.ring, { borderColor: ratingColor(r.score) }]}>
                  <Text style={{ fontWeight: "700", color: ratingColor(r.score), fontSize: 13 }}>{r.score.toFixed(1)}</Text>
                </View>
              </Pressable>
            ))
          )
        ) : savedRows === undefined ? <Skeleton height={240} /> : savedRows.length === 0 ? (
          <EmptyState text="Tap Save on any place to keep it here." />
        ) : (
          savedRows.map((s) => (
            <Pressable key={`${s.kind}${String(s.id)}`} onPress={() => openVenue(s)} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700" }}>{s.name}</Text>
                <Text variant="caption" muted>
                  {s.category}{s.startsAt ? ` · ${new Date(s.startsAt).toLocaleString([], { weekday: "short", hour: "numeric" })}` : ""}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </Screen>
      <Pressable accessibilityRole="button" onPress={() => router.push("/map")} style={styles.viewMap}>
        <Text style={{ color: colors.white, fontWeight: "700" }}>View map</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { paddingVertical: 8 },
  tabOn: { borderBottomWidth: 2, borderBottomColor: colors.fg },
  tabText: { color: colors.muted, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  ring: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  viewMap: { position: "absolute", right: 18, bottom: 28, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 12 },
});
