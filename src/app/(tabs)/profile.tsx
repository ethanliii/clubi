import { useQuery } from "convex/react";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, EmptyState, Header, Icon, IconButton, Screen, SectionHeader, Text, type IconName } from "../../components";
import { PostCard, ProfileHeader, ProfileSkeleton, RankedLists, TasteMeters } from "../../features/profile";
import { api } from "../../lib/api";
import { paths, rankingsPath } from "../../lib/links";
import { useNow } from "../../lib/useNow";
import { colors, radius, spacing } from "../../theme";

const SHORTCUTS: { label: string; icon: IconName; href: Href }[] = [
  { label: "Friends", icon: "users", href: paths.friends },
  { label: "Saved", icon: "bookmark", href: paths.saved },
  { label: "Following", icon: "music", href: paths.following },
  { label: "Trips", icon: "calendar", href: paths.trips },
];

/** My profile: who I am, my taste, my counts and my ranked lists, all from `api.profile.get`. */
export default function ProfileScreen() {
  const profile = useQuery(api.profile.get, {});
  const now = useNow();

  return (
    <Screen>
      <Header
        title="Profile"
        back={false}
        right={<IconButton icon="gear" accessibilityLabel="Settings" onPress={() => router.push(paths.settings)} />}
      />
      {/* null only while signing out; the gate moves the user on. */}
      {profile === undefined || profile === null ? (
        <ProfileSkeleton />
      ) : (
        <>
          <ProfileHeader user={profile.user} counts={profile.counts} />
          <TasteMeters summary={profile.tasteSummary} />
          <Button
            title="Edit profile"
            accessibilityLabel="Edit profile"
            variant="ghost"
            onPress={() => router.push(paths.settings)}
          />
          <View style={styles.shortcuts}>
            {SHORTCUTS.map((shortcut) => (
              <Pressable
                key={shortcut.label}
                accessibilityRole="button"
                accessibilityLabel={shortcut.label}
                onPress={() => router.push(shortcut.href)}
                style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
              >
                <Icon name={shortcut.icon} size={20} color={colors.fg} />
                <Text variant="caption" numberOfLines={1}>
                  {shortcut.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {profile.lists.length === 0 ? (
            <EmptyState
              icon="star"
              title="Nothing ranked yet"
              body="Rank the places you go and your lists build themselves here."
              actionLabel="Rank your first place"
              onAction={() => router.push(paths.rate)}
            />
          ) : (
            <RankedLists lists={profile.lists} limit={3} onSeeAll={(category) => router.push(rankingsPath(category))} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  shortcuts: { flexDirection: "row", gap: spacing.sm },
  shortcut: {
    flex: 1,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs + 2,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pressed: { opacity: 0.6 },
  section: { gap: spacing.md },
});
