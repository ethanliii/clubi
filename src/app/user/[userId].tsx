import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  BackButton,
  Button,
  EmptyState,
  Icon,
  ListRow,
  Loading,
  Screen,
  SectionHeader,
  Sheet,
  Text,
  goBack,
  useToast,
} from "../../components";
import { FriendButton } from "../../features/friends";
import { PostCard, ProfileHeader, ProfileSkeleton, RankedLists, TasteMeters } from "../../features/profile";
import { api, type Id } from "../../lib/api";
import { formatDateRange, pluralize } from "../../lib/format";
import { comparePath, paths } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { useNow } from "../../lib/useNow";
import { colors, spacing } from "../../theme";

/** "Invite to a trip": pick one of the trips I'm in, from `api.trips.list`. */
function InviteSheet({
  visible,
  onClose,
  userId,
  displayName,
}: {
  visible: boolean;
  onClose: () => void;
  userId: Id<"users">;
  displayName: string;
}) {
  const trips = useQuery(api.trips.list, visible ? {} : "skip");
  const invite = useMutationToast(api.trips.invite);
  const toast = useToast();
  // Only someone in the trip can invite; the backend says which those are with `myStatus`.
  const mine = trips?.filter((trip) => trip.myStatus === "owner" || trip.myStatus === "joined");

  return (
    <Sheet visible={visible} onClose={onClose} title={`Invite ${displayName} to a trip`}>
      {mine === undefined ? (
        <Loading compact />
      ) : mine.length === 0 ? (
        <EmptyState
          title="You have no trips yet"
          body="Start one, then invite your friends."
          actionLabel="Trips"
          onAction={() => {
            onClose();
            router.push(paths.trips);
          }}
        />
      ) : (
        <View>
          {mine.map((trip) => (
            <ListRow
              key={trip.tripId}
              title={trip.name}
              accessibilityLabel={`Invite to ${trip.name}`}
              subtitle={[trip.city ?? "", formatDateRange(trip.startDate, trip.endDate), pluralize(trip.memberCount, "person", "people")]
                .filter((part) => part !== "")
                .join(" · ")}
              onPress={async () => {
                if (invite.pending) return;
                const result = await invite.run({ tripId: trip.tripId, userIds: [userId] });
                if (result === undefined) return;
                onClose();
                if (result.invited > 0) toast("Invited", "success");
                else toast(`${displayName} is already in ${trip.name}`, "info");
              }}
            />
          ))}
        </View>
      )}
    </Sheet>
  );
}

/** Another person's profile, from `api.profile.get({ userId })`. The friend button follows `user.status`. */
export default function UserScreen() {
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = params.userId as Id<"users">;
  const profile = useQuery(api.profile.get, { userId });
  const [inviting, setInviting] = useState(false);
  const now = useNow();

  if (profile === undefined) {
    return (
      <Screen>
        <BackButton />
        <ProfileSkeleton />
      </Screen>
    );
  }
  if (profile === null) {
    return (
      <Screen>
        <BackButton />
        <EmptyState icon="user" title="This person isn't on clubi anymore" actionLabel="Back" onAction={goBack} />
      </Screen>
    );
  }

  const { user } = profile;
  const isFriend = user.status === "friends";
  const firstName = user.displayName.trim().split(/\s+/)[0] || user.displayName;
  // A post shows the place's photo when its author added none: the same `imageUrl` its ranked row has.
  const photoOf = new Map<string, string>();
  for (const list of profile.lists) {
    for (const item of list.items) if (item.imageUrl) photoOf.set(`${item.kind}-${item.id}`, item.imageUrl);
  }

  const compare = (
    <Button
      title="Compare tastes"
      accessibilityLabel="Compare tastes"
      // One pink button at a time: adding them comes first, comparing once you are friends.
      variant={isFriend ? "primary" : "ghost"}
      style={isFriend ? styles.primary : undefined}
      onPress={() => router.push(comparePath(user.userId))}
    />
  );
  const friend = (
    <FriendButton userId={user.userId} displayName={user.displayName} status={user.status} requestId={user.requestId} />
  );

  return (
    <Screen>
      <View style={styles.bar}>
        <BackButton />
        {isFriend ? (
          <Button
            title="Invite to a trip"
            accessibilityLabel="Invite to a trip"
            variant="link"
            hitSlop={8}
            style={styles.invite}
            onPress={() => setInviting(true)}
          />
        ) : null}
      </View>
      <ProfileHeader user={user} counts={profile.counts} />

      {user.isMe ? (
        <Button
          title="Edit profile"
          accessibilityLabel="Edit profile"
          variant="ghost"
          onPress={() => router.push(paths.settings)}
        />
      ) : user.status === "incoming" ? (
        // Accept and Decline are already a pair, so they get their own line.
        <View style={styles.stack}>
          <Text muted>{`${firstName} wants to be friends`}</Text>
          {friend}
          {compare}
        </View>
      ) : (
        <View style={styles.actions}>
          <View style={styles.half}>{friend}</View>
          <View style={styles.half}>{compare}</View>
        </View>
      )}

      {!profile.canSee ? (
        <View style={styles.locked}>
          <Icon name="lock" size={20} color={colors.muted} />
          <Text muted style={styles.lockedText}>{`${firstName}'s rankings are for friends`}</Text>
        </View>
      ) : (
        <>
          <TasteMeters summary={profile.tasteSummary} />
          {profile.lists.length === 0 ? (
            <EmptyState icon="star" title={`${firstName} hasn't ranked anything yet`} />
          ) : (
            <RankedLists lists={profile.lists} limit={5} />
          )}
          {profile.recentPosts.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Recent" />
              <View style={styles.posts}>
                {profile.recentPosts.map((post) => (
                  <PostCard
                    key={post.postId}
                    post={post}
                    now={now}
                    imageUrl={photoOf.get(`${post.target.kind}-${post.target.id}`)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}

      {isFriend ? (
        <InviteSheet
          visible={inviting}
          onClose={() => setInviting(false)}
          userId={user.userId}
          displayName={user.displayName}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1 },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 36 },
  invite: { minHeight: 36, justifyContent: "center" },
  // The ghost button has a 1px border; the same border in pink keeps the pair the same height.
  primary: { borderWidth: 1, borderColor: colors.accent },
  locked: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  lockedText: { flex: 1, fontSize: 15, lineHeight: 20 },
  section: { gap: spacing.md, paddingTop: spacing.sm },
  posts: { gap: spacing.lg },
});
