import { useMutation, useQuery } from "convex/react";
import { Redirect, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Id } from "../../../convex/_generated/dataModel";
import type { FriendSuggestion } from "../../../convex/lib/contract";
import { Avatar, Button, ItemCard, Loading, Text } from "../../components";
import { forgetQuizResult, lastQuizResult } from "../../features/onboarding/quizResult";
import { Rise } from "../../features/onboarding/Rise";
import { tasteHeadline } from "../../features/onboarding/tasteHeadline";
import { archetype } from "../../features/onboarding/tasteQuiz";
import { api } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { paths } from "../../lib/links";
import { useMe, useSession } from "../../state/session";
import { colors, fontWeight, layout, palette, radius } from "../../theme";

/**
 * "You're in" (Bryan's design), right after the quiz, in place of the taste card: who you are in
 * one line, then things worth tapping straight away — sync contacts, people you may know, people
 * with your taste, and places picked for tonight. Lists come from `friends.suggestions` and
 * `discover.tonight` as the backend returns them. "Let's go" opens the app.
 * (The route stays /taste-card so the onboarding gate in state/session.tsx is unchanged.)
 */
export default function YoureIn() {
  const me = useMe();
  const { finishOnboarding } = useSession();
  // Read once: "Let's go" forgets the result, and the page must not change while it closes.
  const [saved] = useState(lastQuizResult);
  const { lat, lng, ready } = useDemoLocation();
  const suggestions = useQuery(api.friends.suggestions, {});
  const tonight = useQuery(api.discover.tonight, ready ? { lat, lng } : "skip");

  // Opened by address before the quiz was saved: nothing to show yet.
  if (me !== undefined && !me.onboarded && saved === null) return <Redirect href={paths.quiz} />;

  // Persona from the full quiz when we have it, else the name the backend's meters make.
  const persona = saved?.full ? archetype(saved.full) : null;
  const headline = tasteHeadline(me?.onboarded ? me.tasteSummary : saved?.tasteSummary);
  const known = suggestions?.filter((s) => s.mutualCount > 0) ?? [];
  const twins = suggestions?.filter((s) => s.mutualCount === 0) ?? [];
  const first = me?.displayName ? me.displayName.trim().split(/\s+/)[0] : "";

  const enter = () => {
    forgetQuizResult();
    finishOnboarding();
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      {me === undefined ? (
        <Loading label="Getting things ready" />
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Rise style={{ gap: 8 }}>
            <Text style={styles.eyebrow}>{"You're in"}</Text>
            <Text accessibilityRole="header" style={styles.title}>{first ? `Welcome, ${first}` : "Welcome"}</Text>
            <Text style={styles.lead}>
              {persona ? `You're a ${persona.name}. ${persona.line}` : headline.title}
            </Text>
          </Rise>

          <Rise delay={60}>
            <Pressable accessibilityRole="button" accessibilityLabel="Sync your contacts" style={styles.sync}
              onPress={() => Alert.alert("Coming soon", "Contact sync is on the way. Search by username for now.")}>
              <View style={styles.flex}>
                <Text style={styles.syncTitle}>Sync your contacts</Text>
                <Text variant="caption" muted>See which friends are already here. Numbers are matched privately.</Text>
              </View>
              <Text style={styles.syncAction}>Sync</Text>
            </Pressable>
          </Rise>

          <People title="People you may know" rows={known} loading={suggestions === undefined} />
          <People title="Similar taste to you" rows={twins} loading={suggestions === undefined} />

          <View style={{ gap: 12 }}>
            <Text style={styles.section}>Picked for you tonight</Text>
            {tonight === undefined ? (
              <Loading compact />
            ) : tonight.topPicks.length === 0 ? (
              <Text muted>{"We're loading places for your area."}</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}
                style={{ marginHorizontal: -SIDE }}>
                {tonight.topPicks.slice(0, 6).map((item) => (
                  <ItemCard key={String(item.id)} item={item} variant="card" width={220} />
                ))}
              </ScrollView>
            )}
          </View>

          <Pressable accessibilityRole="button" onPress={() => router.push(paths.friends)}>
            <Text muted center>Search for friends by username</Text>
          </Pressable>
        </ScrollView>
      )}
      <View style={styles.footer}>
        <Button title="Let's go" accessibilityLabel="Let's go" disabled={!me?.onboarded} style={styles.go} onPress={enter} />
      </View>
    </SafeAreaView>
  );
}

function People({ title, rows, loading }: { title: string; rows: FriendSuggestion[]; loading: boolean }) {
  const request = useMutation(api.friends.request);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  if (loading) return <Loading compact />;
  if (rows.length === 0) return null;
  const add = (userId: Id<"users">) =>
    request({ userId }).then(
      () => setSent((s) => ({ ...s, [userId]: true })),
      (e: unknown) => Alert.alert("Couldn't add", e instanceof Error ? e.message : "Try again"),
    );
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.section}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={{ marginHorizontal: -SIDE }}>
        {rows.map((u) => (
          <View key={u.userId} style={styles.person}>
            <Avatar name={u.displayName} uri={u.avatarUrl} size={56} />
            <Text style={styles.personName} numberOfLines={1}>{u.displayName}</Text>
            <Text variant="caption" muted center numberOfLines={2}>{u.reason}</Text>
            <Button title={sent[u.userId] ? "Requested" : "Add"} size="sm" variant={sent[u.userId] ? "secondary" : "primary"}
              disabled={sent[u.userId]} style={styles.add} onPress={() => void add(u.userId)} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const SIDE = layout.gutter;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: SIDE, paddingTop: 32, paddingBottom: 20, gap: 26 },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.bold, letterSpacing: 1, textTransform: "uppercase", color: colors.muted },
  title: { fontSize: 36, lineHeight: 40, fontWeight: "800", letterSpacing: -0.8, color: colors.fg },
  lead: { fontSize: 16, lineHeight: 22, color: colors.muted },
  sync: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: colors.accentSoft },
  syncTitle: { fontSize: 17, lineHeight: 22, fontWeight: fontWeight.bold, color: colors.fg },
  syncAction: { color: colors.accent, fontWeight: fontWeight.bold, fontSize: 15 },
  section: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.bold, letterSpacing: 1, textTransform: "uppercase", color: colors.fg },
  row: { gap: 12, paddingHorizontal: SIDE },
  person: { width: 148, alignItems: "center", gap: 4, padding: 12, borderRadius: radius.lg, backgroundColor: palette.field },
  personName: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.semibold, color: colors.fg },
  add: { marginTop: 6, width: "100%" },
  footer: { paddingHorizontal: SIDE, paddingTop: 8, paddingBottom: 14 },
  go: { minHeight: 54 },
});
