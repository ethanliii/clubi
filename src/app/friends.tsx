import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Avatar, BackButton, EmptyState, FriendButton, Screen, Skeleton, Text } from "../components/bryan";
import { colors, radius, spacing } from "../theme";

/** Friends: search, requests, suggestions (always with a reason), your friends, sent. UI-SPEC §10. */
export default function Friends() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const overview = useQuery(api.friends.list, {});
  const suggestions = useQuery(api.friends.suggestions, {});
  const results = useQuery(api.friends.search, query.length >= 2 ? { text: query } : "skip");

  const open = (userId: Id<"users">) => router.push({ pathname: "/user/[userId]", params: { userId: String(userId) } });

  return (
    <Screen>
      <BackButton />
      <Text variant="heading">Friends</Text>
      <TextInput style={styles.input} placeholder="Search by name or username" placeholderTextColor={colors.muted}
        autoCapitalize="none" value={text} onChangeText={setText} />

      {query.length >= 2 ? (
        results === undefined ? <Skeleton height={120} /> : results.length === 0 ? <EmptyState text="No one found" /> : (
          results.map((u) => (
            <Person key={u.userId} name={u.displayName} sub={`@${u.username}`} url={u.avatarUrl} onPress={() => open(u.userId)}>
              <FriendButton userId={u.userId} status={u.status} requestId={u.requestId} compact />
            </Person>
          ))
        )
      ) : overview === undefined ? (
        <Skeleton height={200} />
      ) : (
        <>
          {overview.incoming.length > 0 && (
            <Section title={`Requests (${overview.incoming.length})`}>
              {overview.incoming.map((r) => (
                <Person key={r.requestId} name={r.user.displayName} sub={r.mutualCount ? `${r.mutualCount} mutual` : `@${r.user.username}`}
                  url={r.user.avatarUrl} onPress={() => open(r.user.userId)}>
                  <FriendButton userId={r.user.userId} status="incoming" requestId={r.requestId} compact />
                </Person>
              ))}
            </Section>
          )}
          {suggestions && suggestions.length > 0 && (
            <Section title="People you may know">
              {suggestions.map((s) => (
                <Person key={s.userId} name={s.displayName} sub={s.reason} url={s.avatarUrl} onPress={() => open(s.userId)}>
                  <FriendButton userId={s.userId} status="none" compact />
                </Person>
              ))}
            </Section>
          )}
          {overview.friends.length > 0 && (
            <Section title={`Your friends (${overview.friends.length})`}>
              {overview.friends.map((f) => (
                <Person key={f.userId} name={f.displayName} sub={f.tasteMatchPct !== undefined ? `${f.tasteMatchPct}% match` : `@${f.username}`}
                  url={f.avatarUrl} onPress={() => open(f.userId)} />
              ))}
            </Section>
          )}
          {overview.outgoing.length > 0 && (
            <Section title={`Sent (${overview.outgoing.length})`}>
              {overview.outgoing.map((r) => (
                <Person key={r.requestId} name={r.user.displayName} sub={`@${r.user.username}`} url={r.user.avatarUrl} onPress={() => open(r.user.userId)}>
                  <FriendButton userId={r.user.userId} status="outgoing" requestId={r.requestId} compact />
                </Person>
              ))}
            </Section>
          )}
          {!overview.friends.length && !overview.incoming.length && !suggestions?.length && (
            <EmptyState text="Search for a friend's username to get started" />
          )}
        </>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label">{title}</Text>
      {children}
    </View>
  );
}

function Person({ name, sub, url, onPress, children }: { name: string; sub?: string; url?: string; onPress: () => void; children?: ReactNode }) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onPress} style={styles.who}>
        <Avatar name={name} url={url} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600" }}>{name}</Text>
          {sub ? <Text variant="caption" muted numberOfLines={1}>{sub}</Text> : null}
        </View>
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.fg, borderRadius: radius.lg, padding: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  who: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
});
