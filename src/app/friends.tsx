import { useQuery } from "convex/react";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { EmptyState, Header, Screen, SkeletonRows, Text } from "../components";
import { FriendButton, PersonRow, personFacts, RowButton, SearchBar } from "../features/friends";
import { api, type FriendSuggestion, type FriendsOverview } from "../lib/api";
import { pluralize } from "../lib/format";
import { useDebounced } from "../lib/useDebounced";
import { useMutationToast } from "../lib/useMutationToast";
import { colors, fontWeight, spacing } from "../theme";

/** How many suggestions show before "See all", so the friends list is not pushed off the screen. */
const SUGGESTION_PREVIEW = 3;

const mutualLine = (count: number | undefined) => (count ? pluralize(count, "mutual friend") : null);

/**
 * The backend's reason ("4 mutual friends · 91% taste match") on one line, with "taste match"
 * shortened to "match" so it fits beside the button.
 */
const reasonLine = (reason: string) => reason.replace(/taste match/g, "match");

/** A titled run of people. The count sits beside the title, quieter than it. */
function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  /** A quiet text button at the right end of the heading ("See all"). */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View>
      <View style={styles.sectionHead}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </Text>
        {count !== undefined ? <Text style={styles.count}>{count}</Text> : null}
        <View style={styles.grow} />
        {action}
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
  const [showAll, setShowAll] = useState(false);

  if (overview === undefined || suggestions === undefined) return <SkeletonRows count={6} />;
  const { friends, incoming, outgoing } = overview;
  const shown = showAll ? suggestions : suggestions.slice(0, SUGGESTION_PREVIEW);

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

      {suggestions.length > 0 ? (
        <Section
          title="People you may know"
          action={
            suggestions.length > SUGGESTION_PREVIEW ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showAll ? "Show fewer suggestions" : "See all suggestions"}
                hitSlop={12}
                onPress={() => setShowAll((open) => !open)}
                style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
              >
                <Text style={styles.seeAllLabel}>{showAll ? "Show less" : "See all"}</Text>
              </Pressable>
            ) : undefined
          }
        >
          {shown.map((person, index) => (
            <PersonRow
              key={person.userId}
              user={person}
              last={index === shown.length - 1}
              subtitle={reasonLine(person.reason)}
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
                // A match with someone who has ranked nothing says nothing, so it is left out.
                friend.tasteMatchPct !== undefined && friend.rankedCount !== 0 ? `${friend.tasteMatchPct}% match` : null,
              ])}
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
                <RowButton
                  title="Cancel"
                  kind="soft"
                  disabled={cancel.pending}
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
  content: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32, marginBottom: 2 },
  // The reference's section label: small, bold, uppercase, letter-spaced.
  sectionTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.fg,
  },
  count: { fontSize: 13, lineHeight: 16, color: colors.muted },
  grow: { flex: 1 },
  seeAll: { minHeight: 32, justifyContent: "center" },
  seeAllLabel: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.bold, letterSpacing: 0.2, color: colors.fg },
  pressed: { opacity: 0.55 },
});
