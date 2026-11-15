import { useQuery } from "convex/react";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, EmptyState, Icon, IconButton, Screen, SectionHeader, Text, type IconName } from "../../components";
import { PostCard, ProfileHeader, ProfileSkeleton, RankedLists, TasteMeters } from "../../features/profile";
import { api } from "../../lib/api";
import { paths, rankingsPath } from "../../lib/links";
import { useNow } from "../../lib/useNow";
import { colors, fontWeight, spacing } from "../../theme";

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
      <View style={styles.top} />
      <ProfileHeader
        user={profile.user}
        counts={profile.counts}
        onPressFriends={() => router.push(paths.friends)}
        aside={
          <>
            <Button
              title="Edit profile"
              accessibilityLabel="Edit profile"
              variant="ghost"
              style={styles.edit}
              onPress={() => router.push(paths.settings)}
            />
            {settings}
          </>
        }
      />

      <TasteMeters summary={profile.tasteSummary} mine />

      <View style={styles.shortcuts}>
        {SHORTCUTS.map((shortcut) => (
          <Pressable
            key={shortcut.label}
            accessibilityRole="button"
            accessibilityLabel={shortcut.label}
            onPress={() => router.push(shortcut.href)}
            style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
          >
            <Icon name={shortcut.icon} size={22} color={colors.fg} />
            <Text numberOfLines={1} style={styles.shortcutText}>
              {shortcut.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {profile.lists.length === 0 ? (
        <EmptyState
          icon="star"
          title="Nothing ranked yet"
          body="Rank a place you've been and your lists start here."
          actionLabel="Rank your first place"
          onAction={() => router.push(paths.rate)}
        />
      ) : (
        <RankedLists lists={profile.lists} limit={3} onSeeAll={(category) => router.push(rankingsPath(category))} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingBar: { flexDirection: "row", justifyContent: "flex-end" },
  // No bar above the photo on this tab, so give it a little air under the status bar.
  top: { height: 0, marginBottom: -spacing.sm },
  edit: { width: "auto", minHeight: 40, paddingVertical: 0, paddingHorizontal: spacing.lg, borderRadius: 20 },
  // Four plain shortcuts between two hairlines: no pills, the icons carry it.
  shortcuts: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  shortcut: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, minHeight: 72 },
  shortcutText: { fontSize: 13, lineHeight: 17, fontWeight: fontWeight.medium },
  pressed: { opacity: 0.5 },
  section: { gap: spacing.md, paddingTop: spacing.sm },
  posts: { gap: spacing.lg },
});
