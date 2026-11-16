import { useQuery } from "convex/react";
import { router, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { EmptyState, Icon, Screen, TabHeader, Text, type IconName } from "../../components";
import { OutlineButton, PostCard, ProfileHeader, ProfileSkeleton, RankedLists, SectionLabel } from "../../features/profile";
import { FavoritesGallery } from "../../features/profile/FavoritesGallery";
import { api } from "../../lib/api";
import { paths, rankingsPath } from "../../lib/links";
import { useNow } from "../../lib/useNow";
import { colors, fontWeight, palette, spacing } from "../../theme";

const SHORTCUTS: { label: string; icon: IconName; href: Href }[] = [
  { label: "Saved", icon: "bookmark", href: paths.saved },
  { label: "Plans", icon: "users", href: paths.trips },
  { label: "Artists", icon: "music", href: paths.following },
];

/** My profile: who I am, my taste, my counts and my ranked lists, all from `api.profile.get`. */
export default function ProfileScreen() {
  const profile = useQuery(api.profile.get, {});
  const now = useNow();

  // null only while signing out; the gate moves the user on.
  if (profile === undefined || profile === null) {
    return (
      <Screen>
        <TabHeader title="" style={styles.bar} />
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
      <TabHeader title="" style={styles.bar} />
      <ProfileHeader
        user={profile.user}
        counts={profile.counts}
        onPressFriends={() => router.push(paths.friends)}
      >
        <View style={styles.buttons}>
          <OutlineButton title="Edit profile" onPress={() => router.push(paths.settings)} />
          <OutlineButton title="My rankings" onPress={() => router.push(rankingsPath())} />
        </View>
      </ProfileHeader>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pills} contentContainerStyle={styles.pillRow}>
        {SHORTCUTS.map((shortcut) => (
          <Pressable
            key={shortcut.label}
            accessibilityRole="button"
            accessibilityLabel={shortcut.label}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => router.push(shortcut.href)}
            style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
          >
            <Icon name={shortcut.icon} size={16} color={colors.fg} />
            <Text style={styles.pillLabel}>{shortcut.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FavoritesGallery userId={profile.user.userId} mine hasRanked={profile.lists.length > 0} />

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
  // Only the icons: the name is in the header right under them.
  bar: { height: 40, marginBottom: -spacing.sm },
  buttons: { flexDirection: "row", gap: spacing.sm },
  // Light-grey icon pills in one row that scrolls sideways and bleeds to the screen edges.
  pills: { flexGrow: 0, marginHorizontal: -spacing.lg },
  pillRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: palette.field,
  },
  pillPressed: { backgroundColor: palette.fieldPressed },
  pillLabel: { fontSize: 14, lineHeight: 18, fontWeight: fontWeight.semibold, color: colors.fg },
  section: { gap: spacing.md, paddingTop: spacing.sm },
  posts: { gap: spacing.lg },
});
