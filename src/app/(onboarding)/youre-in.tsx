import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { FriendSuggestion } from "../../../convex/lib/contract";
import { Avatar, Button, Screen, Skeleton, Text, VenueCard } from "../../components";
import { archetype } from "../../features/quiz";
import { useDemoLocation } from "../../lib/demoLocation";
import { useOnboarding } from "../../state/onboarding";
import { colors, radius, spacing } from "../../theme";

/**
 * Replaces the taste card reveal: right after the quiz, show things worth tapping —
 * sync contacts, people you may know, people with your taste, and places picked for you.
 * Lists come from friends.suggestions and discover.tonight as returned (no re-ranking here).
 */
export default function YoureIn() {
  const { answers, complete } = useOnboarding();
  const me = useQuery(api.users.me);
  const { lat, lng, ready } = useDemoLocation();
  const suggestions = useQuery(api.friends.suggestions, {});
  const tonight = useQuery(api.discover.tonight, ready ? { lat, lng } : "skip");
  const persona = archetype(answers);

  const known = suggestions?.filter((s) => s.mutualCount > 0) ?? [];
  const twins = suggestions?.filter((s) => s.mutualCount === 0) ?? [];

  const go = () => {
    complete();
    router.replace("/");
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ gap: 4 }}>
        <Text variant="label">{"You're in"}</Text>
        <Text variant="heading">Welcome{me?.displayName ? `, ${me.displayName.split(" ")[0]}` : ""}</Text>
        <Text muted>{`You're a ${persona.name}. ${persona.line}`}</Text>
      </View>

      <Pressable accessibilityRole="button" style={styles.sync}
        onPress={() => Alert.alert("Coming soon", "Contact sync needs expo-contacts and a backend lookup. Search by username for now.")}>
        <View style={{ flex: 1 }}>
          <Text variant="title">Sync your contacts</Text>
          <Text variant="caption" muted>See which friends are already here. Numbers are matched privately.</Text>
        </View>
        <Text style={{ color: colors.accent, fontWeight: "700" }}>Sync</Text>
      </Pressable>

      <People title="People you may know" rows={known} loading={suggestions === undefined} />
      <People title="Similar taste to you" rows={twins} loading={suggestions === undefined} />

      <View style={{ gap: spacing.sm }}>
        <Text variant="title">Picked for you tonight</Text>
        {tonight === undefined ? (
          <Skeleton height={180} />
        ) : tonight.topPicks.length === 0 ? (
          <Text muted>{"We're loading places for your area."}</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
            {tonight.topPicks.slice(0, 6).map((item) => <VenueCard key={String(item.id)} item={item} />)}
          </ScrollView>
        )}
      </View>

      <Pressable onPress={() => router.push("/friends")}><Text muted center>Search for friends by username</Text></Pressable>
      <Button title="Let's go" onPress={go} />
    </Screen>
  );
}

function People({ title, rows, loading }: { title: string; rows: FriendSuggestion[]; loading: boolean }) {
  const request = useMutation(api.friends.request);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  if (loading) return <Skeleton height={140} />;
  if (rows.length === 0) return null;
  const add = (userId: Id<"users">) =>
    request({ userId }).then(
      () => setSent((s) => ({ ...s, [userId]: true })),
      (e: unknown) => Alert.alert("Couldn't add", e instanceof Error ? e.message : "Try again"),
    );
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="title">{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
        {rows.map((u) => (
          <View key={u.userId} style={styles.person}>
            <Avatar name={u.displayName} url={u.avatarUrl} size={56} />
            <Text style={{ fontWeight: "600" }} numberOfLines={1}>{u.displayName}</Text>
            <Text variant="caption" muted center numberOfLines={2}>{u.reason}</Text>
            <Button title={sent[u.userId] ? "Requested" : "Add"} variant={sent[u.userId] ? "ghost" : "primary"}
              disabled={sent[u.userId]} style={styles.add} onPress={() => add(u.userId)} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sync: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.accentSoft, borderRadius: radius.xl, padding: 16, borderWidth: 1, borderColor: colors.line },
  person: { width: 140, alignItems: "center", gap: 4, backgroundColor: colors.surface, borderRadius: radius.xl, padding: 12 },
  add: { paddingVertical: 8, marginTop: 4 },
});
