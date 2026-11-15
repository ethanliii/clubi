import { useQuery } from "convex/react";
import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, EmptyState, Header, Screen, SkeletonRows, Text } from "../components";
import { FriendButton, PersonRow, personFacts, SearchBar } from "../features/friends";
import { api, type FriendSuggestion, type FriendsOverview } from "../lib/api";
import { pluralize } from "../lib/format";
import { useDebounced } from "../lib/useDebounced";
import { useMutationToast } from "../lib/useMutationToast";
import { colors, fontWeight, spacing } from "../theme";

const mutualLine = (count: number | undefined) => (count ? pluralize(count, "mutual friend") : null);

/**
 * The backend's reason ("Also in San Francisco · 100% taste match"), unchanged in wording, set on
 * two lines: the first fact, then the rest. One long line would be cut off beside the button.
 */
const reasonLines = (reason: string) => {
  const [first, ...rest] = reason.split(" · ");
  return rest.length > 0 ? `${first}\n${rest.join(" · ")}` : first;
};

/** A titled run of people. The count sits beside the title, quieter than it. */
function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <View>
      <View style={styles.sectionHead}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {count !== undefined ? (
          <Text variant="title" style={styles.count}>
            {count}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Search results from `api.friends.search`. Each row's button follows the row's `status`. */
function SearchResults({ text }: { text: string }) {
  const results = useQuery(api.friends.search, text.length >= 2 ? { text } : "skip");
  if (results === undefined) return <SkeletonRows count={4} />;
  if (results.length === 0) {
    return <EmptyState icon="search" title="No one found" body="Check the spelling, or try their username." />;
  }
  return (
    <View>
      {results.map((person, index) => (
        <PersonRow
          key={person.userId}
          user={person}
          last={index === results.length - 1}
          subtitle={personFacts([`@${person.username}`, mutualLine(person.mutualCount)])}
          right={
            <FriendButton
              compact
              addLabel="Add"
              userId={person.userId}
              displayName={person.displayName}
              status={person.status}
              requestId={person.requestId}
            />
          }
        />
      ))}
    </View>
  );
}

/** Requests, suggestions, friends and sent requests, from `api.friends.list` and `api.friends.suggestions`. */
function Overview({
  overview,
  suggestions,
}: {
  overview: FriendsOverview | undefined;
  suggestions: FriendSuggestion[] | undefined;
}) {
  const cancel = useMutationToast(api.friends.cancel);

  if (overview === undefined || suggestions === undefined) return <SkeletonRows count={6} />;
  const { friends, incoming, outgoing } = overview;

  return (
    <>
      {incoming.length > 0 ? (
        <Section title="Requests" count={incoming.length}>
          {incoming.map((request, index) => (
            <PersonRow
              key={request.requestId}
              user={request.user}
              last={index === incoming.length - 1}
              subtitle={mutualLine(request.mutualCount) ?? `@${request.user.username}`}
              right={
                <FriendButton
                  compact
                  userId={request.user.userId}
                  displayName={request.user.displayName}
                  status="incoming"
                  requestId={request.requestId}
                />
              }
            />
          ))}
        </Section>
      ) : null}

      {friends.length > 0 ? (
        <Section title="Your friends" count={friends.length}>
          {friends.map((friend, index) => (
            <PersonRow
              key={friend.userId}
              user={friend}
              last={index === friends.length - 1}
              subtitle={personFacts([
                `@${friend.username}`,
                friend.rankedCount !== undefined ? `${friend.rankedCount} ranked` : null,
              ])}
              right={
                friend.tasteMatchPct !== undefined ? (
                  <View accessible accessibilityLabel={`${friend.tasteMatchPct}% match`} style={styles.match}>
                    <Text style={styles.matchPct}>{`${friend.tasteMatchPct}%`}</Text>
                    <Text style={styles.matchLabel}>match</Text>
                  </View>
                ) : undefined
              }
            />
          ))}
        </Section>
      ) : null}

      {suggestions.length > 0 ? (
        <Section title="People you may know">
          {suggestions.map((person, index) => (
            <PersonRow
              key={person.userId}
              user={person}
              last={index === suggestions.length - 1}
              subtitle={reasonLines(person.reason)}
              right={
                <FriendButton
                  compact
                  addLabel="Add"
                  userId={person.userId}
                  displayName={person.displayName}
                  status="none"
                />
              }
            />
          ))}
        </Section>
      ) : null}

      {outgoing.length > 0 ? (
        <Section title="Sent" count={outgoing.length}>
          {outgoing.map((request, index) => (
            <PersonRow
              key={request.requestId}
              user={request.user}
              last={index === outgoing.length - 1}
              subtitle={personFacts([`@${request.user.username}`, mutualLine(request.mutualCount)])}
              right={
                <Button
                  title="Cancel"
                  accessibilityLabel="Cancel"
                  variant="secondary"
                  size="sm"
                  disabled={cancel.pending}
                  hitSlop={6}
                  style={styles.rowButton}
                  onPress={() => void cancel.run({ requestId: request.requestId })}
                />
              }
            />
          ))}
        </Section>
      ) : null}

      {friends.length === 0 && suggestions.length === 0 ? (
        <EmptyState icon="users" title="Search for a friend's username to get started" />
      ) : null}
    </>
  );
}

/** Find people and answer friend requests. Typing two letters swaps the sections for search results. */
export default function FriendsScreen() {
  const [input, setInput] = useState("");
  const debounced = useDebounced(input, 300).trim();
  const searching = input.trim().length >= 2;
  // Asked here, not inside the sections, so they are still there the moment the search box is cleared.
  const overview = useQuery(api.friends.list, {});
  const suggestions = useQuery(api.friends.suggestions, {});

  return (
    <Screen scroll={false}>
      <Header title="Friends" />
      <SearchBar placeholder="Search by name or username" value={input} onChangeText={setInput} />
      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {searching ? <SearchResults text={debounced} /> : <Overview overview={overview} suggestions={suggestions} />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroller: { flex: 1 },
  content: { gap: spacing.xl + spacing.xs, paddingTop: spacing.xs, paddingBottom: spacing.xxl * 2 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginBottom: spacing.xs },
  count: { color: colors.muted, fontWeight: fontWeight.medium },
  match: { alignItems: "flex-end", minWidth: 48 },
  matchPct: { fontSize: 17, lineHeight: 22, fontWeight: fontWeight.bold },
  matchLabel: { fontSize: 11, lineHeight: 14, color: colors.muted },
  rowButton: { width: "auto", paddingHorizontal: 16 },
});
