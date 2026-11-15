import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  EmptyState,
  Header,
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
import { spacing } from "../../theme";

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
        <Header title="" />
        <ProfileSkeleton />
      </Screen>
    );
  }
  if (profile === null) {
    return (
      <Screen>
        <Header title="" />
        <EmptyState icon="user" title="This person isn't on clubi anymore" actionLabel="Back" onAction={goBack} />
      </Screen>
    );
  }

  const { user } = profile;
  const isFriend = user.status === "friends";

  return (
    <Screen>
      <Header title={user.displayName} />
      <ProfileHeader user={user} counts={profile.counts} />

      {user.isMe ? (
        <Button
          title="Edit profile"
          accessibilityLabel="Edit profile"
          variant="ghost"
          onPress={() => router.push(paths.settings)}
        />
      ) : (
        <View style={styles.actions}>
          {user.status === "incoming" ? (
            <Text muted>{`${user.displayName} wants to be friends.`}</Text>
          ) : null}
          <FriendButton
            userId={user.userId}
            displayName={user.displayName}
            status={user.status}
            requestId={user.requestId}
          />
          <Button
            title="Compare tastes"
            accessibilityLabel="Compare tastes"
            variant="ghost"
            onPress={() => router.push(comparePath(user.userId))}
          />
          {isFriend ? (
            <Button
              title="Invite to a trip"
              accessibilityLabel="Invite to a trip"
              variant="ghost"
              onPress={() => setInviting(true)}
            />
          ) : null}
        </View>
      )}

      {!profile.canSee ? (
        <EmptyState icon="lock" title="Add friend to see their rankings" />
      ) : (
        <>
          <TasteMeters summary={profile.tasteSummary} />
          {profile.lists.length === 0 ? (
            <EmptyState icon="star" title={`${user.displayName} hasn't ranked anything yet`} />
          ) : (
            <RankedLists lists={profile.lists} limit={5} />
          )}
          {profile.recentPosts.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Recent" />
              {profile.recentPosts.map((post) => (
                <PostCard key={post.postId} post={post} now={now} />
              ))}
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
  actions: { gap: spacing.sm },
  section: { gap: spacing.md },
});
