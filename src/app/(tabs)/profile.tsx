import { useQuery } from "convex/react";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, EmptyState, IconButton, Screen, Text } from "../../components";
import { PostCard, ProfileHeader, ProfileSkeleton, RankedLists, TasteMeters } from "../../features/profile";
import { api } from "../../lib/api";
import { paths, rankingsPath } from "../../lib/links";
import { useNow } from "../../lib/useNow";
import { colors, radius, spacing } from "../../theme";

const SHORTCUTS: { label: string; href: Href }[] = [
  { label: "Friends", href: paths.friends },
  { label: "Saved", href: paths.saved },
  { label: "Following", href: paths.following },
  { label: "Trips", href: paths.trips },
];

/** My profile: who I am, my taste, my counts and my ranked lists, all from `api.profile.get`. */
export default function ProfileScreen() {
  const profile = useQuery(api.profile.get, {});
  const now = useNow();

  return (
    <Screen>
      <View style={styles.between}>
        <Text variant="heading" accessibilityRole="header">
          Profile
        </Text>
        <IconButton icon="gear" accessibilityLabel="Settings" onPress={() => router.push(paths.settings)} />
      </View>
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
              body="Rank the places you go and your lists build themselves here."
              actionLabel="Rank your first place"
              onAction={() => router.push(paths.rate)}
            />
          ) : (
            <RankedLists lists={profile.lists} limit={3} onSeeAll={(category) => router.push(rankingsPath(category))} />
          )}

          {profile.recentPosts.length > 0 ? (
            <View style={styles.section}>
              <Text variant="label" accessibilityRole="header">
                Recent
              </Text>
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
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  // His chips: pill, line border on the surface colour.
  shortcuts: { flexDirection: "row", gap: 6 },
  shortcut: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  shortcutText: { fontSize: 13, lineHeight: 17 },
  pressed: { opacity: 0.6 },
  section: { gap: spacing.md },
});
