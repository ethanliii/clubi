import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { BackButton, EmptyState, Screen, ScoreBadge, Skeleton, Text, openVenue } from "../../components/bryan";
import { colors, radius, spacing } from "../../theme";

/** You vs a friend. UI-SPEC §9. All numbers come from profile.compare. */
export default function Compare() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const c = useQuery(api.profile.compare, { userId: userId as Id<"users"> });

  if (c === undefined) return <Screen><BackButton /><Skeleton height={300} /></Screen>;
  if (c === null) return <Screen><BackButton /><EmptyState text="This person isn't on Clubi anymore" /></Screen>;
  const first = c.them.displayName.split(" ")[0];

  return (
    <Screen>
      <BackButton />
      <Text variant="heading">You and {first}</Text>
      <View style={styles.big}>
        <Text style={styles.pct}>{c.tasteMatchPct}%</Text>
        <Text muted>taste match{c.agreePct !== undefined ? ` · you agree ${c.agreePct}% of the time` : ""}</Text>
        <Text center>{c.summary}</Text>
      </View>

      <View style={styles.card}>
        {c.dims.map((d) => (
          <View key={d.label} style={{ gap: 4 }}>
            <Text variant="caption">{d.label}</Text>
            <Bar label="You" pct={d.me} color={colors.accent} />
            <Bar label={first ?? "Them"} pct={d.them} color={colors.mid} />
          </View>
        ))}
      </View>

      <Text variant="title">Both ranked</Text>
      {c.shared.length === 0 ? (
        <Text muted>{"You haven't ranked any of the same places yet"}</Text>
      ) : (
        c.shared.map((s) => (
          <Pressable key={String(s.id)} onPress={() => openVenue(s)} style={styles.row}>
            <Text style={{ flex: 1 }}>{s.name}</Text>
            <Text variant="caption" muted>you</Text>
            <ScoreBadge score={s.myScore} size="sm" />
            <Text variant="caption" muted>{first}</Text>
            <ScoreBadge score={s.theirScore} size="sm" />
          </Pressable>
        ))
      )}

      {c.theirTopNewToMe.length > 0 && (
        <>
          <Text variant="title">{`${first}'s favorites you haven't tried`}</Text>
          {c.theirTopNewToMe.map((r) => (
            <Pressable key={String(r.rankingId)} onPress={() => openVenue(r)} style={styles.row}>
              <Text style={{ width: 22, fontWeight: "700" }}>{r.position}</Text>
              <Text style={{ flex: 1 }}>{r.name}</Text>
              <ScoreBadge score={r.score} size="sm" />
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View style={styles.barRow}>
      <Text variant="caption" muted style={{ width: 54 }}>{label}</Text>
      <View style={styles.bar}><View style={{ width: `${pct}%`, height: "100%", backgroundColor: color }} /></View>
      <Text variant="caption" style={{ width: 34, textAlign: "right" }}>{pct}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  big: { alignItems: "center", gap: 4, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg },
  pct: { fontSize: 44, lineHeight: 50, fontWeight: "700", color: colors.accent },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, gap: 10 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.raised, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
});
