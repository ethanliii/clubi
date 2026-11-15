import { useQuery } from "convex/react";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, EmptyState, Header, Screen, SectionHeader, SkeletonRows, Text, TextField } from "../components";
import { FriendButton, PersonRow, personFacts } from "../features/friends";
import { api, type FriendSuggestion, type FriendsOverview } from "../lib/api";
import { pluralize } from "../lib/format";
import { useDebounced } from "../lib/useDebounced";
import { useMutationToast } from "../lib/useMutationToast";
import { spacing } from "../theme";

const mutualLine = (count: number | undefined) => (count ? pluralize(count, "mutual friend") : null);

/** Search results from `api.friends.search`. Each row's button follows the row's `status`. */
function SearchResults({ text }: { text: string }) {
  const results = useQuery(api.friends.search, text.length >= 2 ? { text } : "skip");
  if (results === undefined) return <SkeletonRows count={4} />;
  if (results.length === 0) return <EmptyState icon="search" title="No one found" body="Check the spelling, or try their username." />;
  return (
    <View>
      {results.map((person) => (
        <PersonRow
          key={person.userId}
          user={person}
          subtitle={personFacts([`@${person.username}`, mutualLine(person.mutualCount)])}
          right={
            <FriendButton
              compact
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
        <View style={styles.section}>
          <SectionHeader title="Requests" count={incoming.length} />
          <View>
            {incoming.map((request) => (
              <PersonRow
                key={request.requestId}
                user={request.user}
                subtitle={personFacts([`@${request.user.username}`, mutualLine(request.mutualCount)])}
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
          </View>
        </View>
      ) : null}

      {suggestions.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="People you may know" />
          <View>
            {suggestions.map((person) => (
              <PersonRow
                key={person.userId}
                user={person}
                subtitle={person.reason}
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
          </View>
        </View>
      ) : null}

      {friends.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Your friends" count={friends.length} />
          <View>
            {friends.map((friend) => (
              <PersonRow
                key={friend.userId}
                user={friend}
                subtitle={personFacts([
                  `@${friend.username}`,
                  friend.rankedCount !== undefined ? `${friend.rankedCount} ranked` : null,
                ])}
                right={
                  friend.tasteMatchPct !== undefined ? (
                    <Text variant="caption" muted>{`${friend.tasteMatchPct}% match`}</Text>
                  ) : undefined
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      {outgoing.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Sent" count={outgoing.length} />
          <View>
            {outgoing.map((request) => (
              <PersonRow
                key={request.requestId}
                user={request.user}
                subtitle={personFacts([`@${request.user.username}`, mutualLine(request.mutualCount)])}
                right={
                  <Button
                    title="Cancel"
                    accessibilityLabel="Cancel"
                    variant="ghost"
                    disabled={cancel.pending}
                    style={styles.rowButton}
                    onPress={() => void cancel.run({ requestId: request.requestId })}
                  />
                }
              />
            ))}
          </View>
        </View>
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
      <TextField
        placeholder="Search by name or username"
        accessibilityLabel="Search by name or username"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        value={input}
        onChangeText={setInput}
      />
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
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  section: { gap: spacing.xs },
  rowButton: { width: "auto", paddingVertical: 10, paddingHorizontal: 14 },
});
