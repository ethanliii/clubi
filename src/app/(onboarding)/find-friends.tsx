import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Avatar, BackButton, Button, EmptyState, Screen, Skeleton, Text } from "../../components/bryan";
import { useOnboarding } from "../../state/onboarding";
import { colors, radius, spacing } from "../../theme";

/** Last onboarding step: suggestions (with their reason) + search by username. "Let's go" enters the app. */
export default function FindFriends() {
  const { complete } = useOnboarding();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const suggestions = useQuery(api.friends.suggestions, {});
  const results = useQuery(api.friends.search, query.length >= 2 ? { text: query } : "skip");
  const request = useMutation(api.friends.request);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  const add = async (userId: Id<"users">) => {
    try {
      await request({ userId });
      setSent((s) => ({ ...s, [userId]: true }));
    } catch (e) {
      Alert.alert("Couldn't add", e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const go = () => {
    complete();
    router.replace("/");
  };

  const rows = query.length >= 2 ? results : suggestions;

  return (
    <Screen edges={["top", "bottom"]}>
      <BackButton />
      <Text variant="heading">Find your friends</Text>
      <Text muted>Your feed fills up with what they rank.</Text>
      <TextInput
        style={styles.input}
        placeholder="Search by name or username"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        value={text}
        onChangeText={setText}
      />
      {rows === undefined ? (
        <Skeleton height={160} />
      ) : rows.length === 0 ? (
        <EmptyState text={query.length >= 2 ? "No one found" : "Search for a friend's username to get started"} />
      ) : (
        rows.map((u) => {
          const status = "status" in u ? u.status : undefined;
          const done = sent[u.userId] || status === "outgoing" || status === "friends";
          return (
            <View key={u.userId} style={styles.row}>
              <Avatar name={u.displayName} url={u.avatarUrl} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600" }}>{u.displayName}</Text>
                <Text variant="caption" muted>
                  {"reason" in u ? u.reason : `@${u.username}`}
                </Text>
              </View>
              {status !== "self" && (
                <Button
                  title={done ? (status === "friends" ? "Friends" : "Requested") : "Add"}
                  variant={done ? "ghost" : "primary"}
                  disabled={done}
                  style={styles.add}
                  onPress={() => add(u.userId)}
                />
              )}
            </View>
          );
        })
      )}
      <Button title="Let's go" onPress={go} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.fg,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  add: { width: "auto", paddingVertical: 8, paddingHorizontal: 14 },
});
