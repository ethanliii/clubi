import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  ItemCard,
  ListRow,
  SectionHeader,
  SkeletonRows,
  Text,
} from "../../components";
import type { GroupItem, GroupResult, Kind, TripDetail, TripShortlistItem } from "../../lib/api";
import { categoryLabel } from "../../lib/format";
import { userPath, venuePath } from "../../lib/links";
import { colors, spacing } from "../../theme";
import { MemberScores } from "./MemberScores";
import { VoteButtons, type Vote } from "./VoteButtons";

type TargetId = GroupItem["id"];
/** What a tap on 👍 or 👎 hands back: the item and which thumb. */
export type OnVote = (kind: Kind, id: TargetId, tapped: Vote) => void;

const STATUS_LABEL = { joined: "Joined", invited: "Invited", declined: "Declined" } as const;

/** Everyone on the trip with where they stand: "Organizer", "Joined", "Invited", "Declined". */
export function MemberList({ trip, meId }: { trip: TripDetail; meId: string | undefined }) {
  return (
    <View>
      <SectionHeader title="Who's in" count={trip.members.length} />
      {trip.members.map((member) => (
        <ListRow
          key={member.userId}
          title={member.userId === meId ? `${member.displayName} (you)` : member.displayName}
          subtitle={member.isOwner ? "Organizer" : STATUS_LABEL[member.status]}
          accessibilityLabel={member.displayName}
          left={<Avatar name={member.displayName} uri={member.avatarUrl} size={40} />}
          right={member.isLocal ? <Chip label="Local" size="sm" /> : undefined}
          onPress={() => router.push(userPath(member.userId))}
          style={member.status === "joined" ? undefined : styles.faded}
        />
      ))}
    </View>
  );
}

const PICKS_SHOWN = 8;

/**
 * "Picks for the group": `api.discover.forGroup` in the order it came. The badge is the group
 * score; under it each member's own score, how much they agree, and the two thumbs.
 */
export function GroupPicks({
  group,
  meId,
  voteOf,
  onVote,
  note,
  importing = false,
}: {
  /** undefined while loading. */
  group: GroupResult | undefined;
  meId: string | undefined;
  voteOf: (id: TargetId) => Vote | undefined;
  onVote: OnVote;
  /** One more line under the heading, e.g. that the picks are not from the trip's city. */
  note?: string;
  /** The backend is importing places for this spot right now: an empty list is not final yet. */
  importing?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  if (group === undefined) {
    return (
      <View style={styles.section}>
        <SectionHeader title="Picks for the group" />
        <SkeletonRows count={4} />
      </View>
    );
  }
  const solo = group.members.length < 2;
  const items = showAll ? group.items : group.items.slice(0, PICKS_SHOWN);
  return (
    <View style={styles.section}>
      <SectionHeader title="Picks for the group" />
      <Text variant="caption" muted>
        {solo
          ? "Invite friends to get picks that suit everyone"
          : "Each score is for the whole group. Vote a pick up to put it on the shortlist."}
      </Text>
      {note ? (
        <Text variant="caption" muted>
          {note}
        </Text>
      ) : null}
      {group.items.length === 0 ? (
        importing ? (
          <EmptyState
            title="Looking up places there."
            body="This takes a minute the first time. Picks show up here on their own."
            icon="map"
          />
        ) : (
          <EmptyState title="No picks around here yet." body="Nothing nearby suits the whole group right now." />
        )
      ) : (
        <View>
          {items.map((item) => (
            // The thumbs sit under the card, not inside it: the card is one big button, and a
            // button inside a button does not work on the web.
            <View key={item.id} style={styles.pick}>
              <ItemCard item={item} showRank style={styles.pickCard} />
              <View style={styles.pickActions}>
                <View style={styles.pickFacts}>
                  <MemberScores scores={item.memberScores} meId={meId} />
                  {solo ? null : (
                    <Text variant="caption" muted>{`${Math.round(item.agreement * 100)}% agreement`}</Text>
                  )}
                </View>
                <VoteButtons myVote={voteOf(item.id)} onVote={(tapped) => onVote(item.kind, item.id, tapped)} />
              </View>
            </View>
          ))}
        </View>
      )}
      {!showAll && group.items.length > PICKS_SHOWN ? (
        <Button
          title={`Show all ${group.items.length} picks`}
          accessibilityLabel="Show all picks"
          variant="ghost"
          onPress={() => setShowAll(true)}
        />
      ) : null}
    </View>
  );
}

/** "Shortlist": what the group has voted up, in the backend's order, with the vote counts. */
export function Shortlist({
  items,
  canVote,
  onVote,
}: {
  items: TripShortlistItem[];
  /** Only the organizer and people who joined vote; an invited guest just sees the counts. */
  canVote: boolean;
  onVote: OnVote;
}) {
  if (items.length === 0) return null;
  return (
    <View>
      <SectionHeader title="Shortlist" count={items.length} />
      {items.map((item) => (
        <ListRow
          key={item.id}
          title={item.name}
          subtitle={[categoryLabel(item.category), item.addedBy ? `Added by ${item.addedBy.displayName}` : ""]
            .filter((part) => part !== "")
            .join(" · ")}
          onPress={() => router.push(venuePath(item.kind, item.id))}
          right={
            canVote ? (
              <VoteButtons
                myVote={item.myVote}
                up={item.votesUp}
                down={item.votesDown}
                onVote={(tapped) => onVote(item.kind, item.id, tapped)}
              />
            ) : (
              <Text variant="caption" muted>{`${item.votesUp} up · ${item.votesDown} down`}</Text>
            )
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  faded: { opacity: 0.7 },
  pick: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  pickCard: { borderBottomWidth: 0, paddingBottom: spacing.xs },
  // Lined up with the card's text: past the rank number and the picture.
  pickActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: 22 + spacing.md + 56 + spacing.md,
    paddingBottom: spacing.sm,
  },
  pickFacts: { flex: 1, gap: 2 },
});
