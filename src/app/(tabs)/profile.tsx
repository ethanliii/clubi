import { useQuery } from "convex/react";
import { router, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";
import { EmptyState, IconButton, Screen, Text, type IconName } from "../../components";
import { LinkRow, OutlineButton, PostCard, ProfileHeader, ProfileSkeleton, RankedLists, SectionLabel, TasteMeters } from "../../features/profile";
import { api } from "../../lib/api";
import { paths, rankingsPath } from "../../lib/links";
import { useNow } from "../../lib/useNow";
import { colors, fontWeight, palette, spacing } from "../../theme";

const SHORTCUTS: { label: string; icon: IconName; href: Href }[] = [
  { label: "Friends", icon: "users", href: paths.friends },
  { label: "Saved", icon: "bookmark", href: paths.saved },
  { label: "Following", icon: "music", href: paths.following },
  { label: "Trips", icon: "globe", href: paths.trips },
];

/** My profile: who I am, my taste, my counts and my ranked lists, all from `api.profile.get`. */
export default function ProfileScreen() {
  const profile = useQuery(api.profile.get, {});
  const now = useNow();

  const settings = (
    <IconButton icon="gear" size={40} accessibilityLabel="Settings" onPress={() => router.push(paths.settings)} />
  );

  // null only while signing out; the gate moves the user on.
  if (profile === undefined || profile === null) {
    return (
      <Screen>
        <View style={styles.loadingBar}>{settings}</View>
        <ProfileSkeleton />
      </Screen>
    );
  }

  // A post shows the place's photo when its author added none: the same `imageUrl` its ranked row has.
  const photoOf = new Map<string, string>();
  for (const list of profile.lists) {
    for (const item of list.items) if (item.imageUrl) photoOf.set(`${item.kind}-${item.id}`, item.imageUrl);
  }

  return (
    <Screen>
      <View style={styles.bar}>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.barName}>
          {profile.user.displayName}
        </Text>
        {settings}
      </View>
      <ProfileHeader
        user={profile.user}
        counts={profile.counts}
        showName={false}
        onPressFriends={() => router.push(paths.friends)}
      >
        <View style={styles.buttons}>
          <OutlineButton title="Edit profile" onPress={() => router.push(paths.settings)} />
          <OutlineButton title="My rankings" onPress={() => router.push(rankingsPath())} />
        </View>
      </ProfileHeader>

      <View style={styles.links}>
        {SHORTCUTS.map((shortcut, index) => (
          <LinkRow
            key={shortcut.label}
            icon={shortcut.icon}
            label={shortcut.label}
            count={shortcut.label === "Friends" ? profile.counts.friends : undefined}
            divider={index < SHORTCUTS.length - 1}
            onPress={() => router.push(shortcut.href)}
          />
        ))}
      </View>

      {profile.tasteSummary.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel title="Taste profile" />
          <TasteMeters summary={profile.tasteSummary} mine />
        </View>
      ) : null}

      {profile.lists.length === 0 ? (
        <EmptyState
          icon="star"
          title="Nothing ranked yet"
          body="Rank a place you've been and your lists start here."
          actionLabel="Rank your first place"
          onAction={() => router.push(paths.rate)}
        />
      ) : (
        <RankedLists lists={profile.lists} limit={5} onSeeAll={(category) => router.push(rankingsPath(category))} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingBar: { flexDirection: "row", justifyContent: "flex-end" },
  // Beli's top bar: the name at the left, settings at the right.
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 44 },
  barName: { flex: 1, fontSize: 22, lineHeight: 27, fontWeight: fontWeight.bold, letterSpacing: -0.4, color: colors.fg },
  buttons: { flexDirection: "row", gap: spacing.sm },
  // The list under the counts: one row per place to go, hairlines between and around.
  links: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  section: { gap: spacing.md, paddingTop: spacing.sm },
  posts: { gap: spacing.lg },
});
