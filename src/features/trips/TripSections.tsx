import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, EmptyState, Skeleton, Text } from "../../components";
import type { GroupItem, GroupResult, Kind, TripDetail, TripShortlistItem } from "../../lib/api";
import { categoryLabel } from "../../lib/format";
import { userPath, venuePath } from "../../lib/links";
import { fontWeight, radius, spacing } from "../../theme";
import { AddFace, Face, FaceRow } from "./Faces";
import { MemberScores, ScoreFaces } from "./MemberScores";
import { GUTTER } from "./Page";
import { PlaceCard } from "./PlaceCard";
import { PlacePhoto } from "./PlacePhoto";
import { SectionLabel } from "./ScreenTop";
import { VoteButtons, type Vote } from "./VoteButtons";

type TargetId = GroupItem["id"];
/** What a tap on a thumb hands back: the item and which thumb. */
export type OnVote = (kind: Kind, id: TargetId, tapped: Vote) => void;

const STATUS_LABEL = { joined: "Joined", invited: "Invited", declined: "Declined" } as const;

/**
 * Everyone on the trip as a row of faces, with where they stand under each ("Organizer",
 * "Invited", "Local"). People who have not joined are faded. `onInvite` adds the "+" at the end.
 */
export function MemberList({
  trip,
  meId,
  onInvite,
}: {
  trip: TripDetail;
  meId: string | undefined;
  onInvite?: () => void;
}) {
  return (
    <FaceRow>
      {trip.members.map((member) => (
        <Face
          key={member.userId}
          name={member.displayName}
          uri={member.avatarUrl}
          label={member.userId === meId ? "You" : undefined}
          caption={
            member.isOwner
              ? "Organizer"
              : member.status === "joined"
                ? member.isLocal
                  ? "Local"
                  : undefined
                : STATUS_LABEL[member.status]
          }
          dim={member.status !== "joined"}
          accessibilityLabel={member.displayName}
          onPress={() => router.push(userPath(member.userId))}
        />
      ))}
      {onInvite ? <AddFace label="Invite" accessibilityLabel="Invite friends" onPress={onInvite} /> : null}
    </FaceRow>
  );
}

const PICKS_SHOWN = 6;

function PicksSkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.picks}>
      {[0, 1].map((index) => (
        <View key={index} style={styles.skeleton}>
          <Skeleton height={196} round={radius.xl} />
          <Skeleton width="62%" height={18} />
          <Skeleton width="40%" height={12} />
        </View>
      ))}
    </View>
  );
}

/**
 * "Picks for the group": `api.discover.forGroup` in the order it came, as photo cards. The score
 * on the photo is the group's; under each card are every member's own score, how much they agree,
 * and the two thumbs.
 */
export function GroupPicks({
  group,
  meId,
  now,
  voteOf,
  onVote,
  note,
  importing = false,
}: {
  /** undefined while loading. */
  group: GroupResult | undefined;
  meId: string | undefined;
  now: number;
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
        <SectionLabel title="Picks for the group" />
        <PicksSkeleton />
      </View>
    );
  }
  const solo = group.members.length < 2;
  const items = showAll ? group.items : group.items.slice(0, PICKS_SHOWN);
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <SectionLabel title="Picks for the group" />
        <Text muted>
          {solo ? "Just your taste so far. Picks change as friends join." : "Vote one up to put it on the shortlist."}
        </Text>
        {note ? <Text muted>{note}</Text> : null}
      </View>
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
        <View style={styles.picks}>
          {items.map((item) => (
            <PlaceCard
              key={item.id}
              item={item}
              now={now}
              showRank
              aside={<VoteButtons myVote={voteOf(item.id)} onVote={(tapped) => onVote(item.kind, item.id, tapped)} />}
            >
              {solo ? (
                // On my own there is one score, already on the photo: show friends who ranked it.
                <ScoreFaces scores={item.friends} />
              ) : (
                <View style={styles.pickPeople}>
                  <View style={styles.flex}>
                    <MemberScores scores={item.memberScores} meId={meId} />
                  </View>
                  <Text variant="caption" muted>{`${Math.round(item.agreement * 100)}% agree`}</Text>
                </View>
              )}
            </PlaceCard>
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

const TILE = 168;

/**
 * "Shortlist": what the group has voted up, in the backend's order, as a row of photo tiles that
 * scrolls sideways, each with its vote counts. `photoOf` finds a tile's picture (the shortlist
 * itself carries none; the picks do).
 */
export function Shortlist({
  items,
  canVote,
  onVote,
  photoOf,
}: {
  items: TripShortlistItem[];
  /** Only the organizer and people who joined vote; an invited guest just sees the counts. */
  canVote: boolean;
  onVote: OnVote;
  photoOf?: (id: TargetId) => string | undefined;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionLabel title="Shortlist" count={items.length} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}
      >
        {items.map((item) => (
          <View key={item.id} style={styles.tile}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => router.push(venuePath(item.kind, item.id))}
              style={({ pressed }) => [styles.tileOpen, pressed && styles.pressed]}
            >
              <PlacePhoto uri={photoOf?.(item.id)} category={item.category} height={112} round={radius.lg} />
              <View>
                <Text numberOfLines={1} style={styles.tileName}>
                  {item.name}
                </Text>
                <Text variant="caption" muted numberOfLines={1}>
                  {[categoryLabel(item.category), item.addedBy ? `added by ${item.addedBy.displayName.split(" ")[0]}` : ""]
                    .filter((part) => part !== "")
                    .join(" · ")}
                </Text>
              </View>
            </Pressable>
            {canVote ? (
              <VoteButtons
                myVote={item.myVote}
                up={item.votesUp}
                down={item.votesDown}
                onVote={(tapped) => onVote(item.kind, item.id, tapped)}
              />
            ) : (
              <Text variant="caption" muted>{`${item.votesUp} up · ${item.votesDown} down`}</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md + 2 },
  heading: { gap: 2 },
  picks: { gap: spacing.xl + 4 },
  skeleton: { gap: spacing.sm + 2 },
  flex: { flex: 1 },
  pickPeople: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pressed: { opacity: 0.75 },
  strip: { flexGrow: 0, marginHorizontal: -GUTTER },
  stripContent: { paddingHorizontal: GUTTER, gap: spacing.md },
  tile: { width: TILE, gap: spacing.sm },
  tileOpen: { gap: spacing.sm },
  tileName: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.semibold },
});
