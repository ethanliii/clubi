import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  BackButton,
  Button,
  EmptyState,
  ErrorBoundary,
  Icon,
  IconButton,
  ListRow,
  Loading,
  Screen,
  Sheet,
  Text,
  goBack,
  useToast,
} from "../../components";
import { FriendButton } from "../../features/friends";
import { OutlineButton, PostCard, ProfileHeader, ProfileSkeleton, RankedLists, SectionLabel } from "../../features/profile";
import { FavoritesGallery } from "../../features/profile/FavoritesGallery";
import { api, type Id } from "../../lib/api";
import { formatDateRange, pluralize } from "../../lib/format";
import { comparePath, paths } from "../../lib/links";
import { useMutationToast } from "../../lib/useMutationToast";
import { useNow } from "../../lib/useNow";
import { colors, spacing } from "../../theme";

/** "Invite to a plan": pick one of the plans I'm in, from `api.trips.list`. */
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
    <Sheet visible={visible} onClose={onClose} title={`Invite ${displayName} to a plan`}>
      {mine === undefined ? (
        <Loading compact />
      ) : mine.length === 0 ? (
        <EmptyState
          title="No plans yet"
          body="Start one, then invite your friends."
          actionLabel="Plans"
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
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return (
    // A link with an id the backend does not recognise throws; show it as a person who is gone.
    <ErrorBoundary
      key={userId}
      fallback={() => (
        <Screen>
          <BackButton />
          <EmptyState icon="user" title="This person isn't on Vioma anymore" actionLabel="Back" onAction={goBack} />
        </Screen>
      )}
    >
      <UserLoader />
    </ErrorBoundary>
  );
}

function UserLoader() {
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
        <EmptyState icon="user" title="This person isn't on Vioma anymore" actionLabel="Back" onAction={goBack} />
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
      // Grey like the button beside it: the accent is kept for adding and accepting.
      variant="secondary"
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
          <IconButton
            icon="plusCircle"
            plain
            size={44}
            accessibilityLabel="Invite to a plan"
            style={styles.invite}
            onPress={() => setInviting(true)}
          />
        ) : null}
      </View>
      <ProfileHeader user={user} counts={profile.counts}>
        {user.isMe ? (
          <View style={styles.actions}>
            <OutlineButton title="Edit profile" onPress={() => router.push(paths.settings)} />
          </View>
        ) : user.status === "incoming" ? (
          // Accept and Decline are already a pair, so they get their own line.
          <View style={styles.stack}>
            <Text muted style={styles.wants}>{`${firstName} wants to be friends`}</Text>
            {friend}
            {compare}
          </View>
        ) : (
          <View style={styles.actions}>
            <View style={styles.half}>{friend}</View>
            <View style={styles.half}>{compare}</View>
          </View>
        )}
      </ProfileHeader>

      {!profile.canSee ? (
        <View style={styles.locked}>
          <Icon name="lock" size={20} color={colors.muted} />
          <Text muted style={styles.lockedText}>{`${firstName}'s rankings are for friends`}</Text>
        </View>
      ) : (
        <>
          <FavoritesGallery lists={profile.lists} />
          {profile.lists.length === 0 ? (
            <EmptyState icon="star" title={`${firstName} hasn't ranked anything yet`} />
          ) : (
            <RankedLists lists={profile.lists} limit={5} />
          )}
          {profile.recentPosts.length > 0 ? (
            <View style={styles.section}>
              <SectionLabel title="Recent" />
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
  wants: {},
  actions: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1 },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 36 },
  invite: { marginRight: -11 },
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
