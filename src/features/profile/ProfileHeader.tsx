import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Text } from "../../components";
import type { ProfileResult } from "../../lib/api";
import { colors, fontWeight, spacing } from "../../theme";

function Stat({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  const text = (
    <Text style={styles.statLabel}>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      {` ${label}`}
    </Text>
  );
  if (!onPress) {
    return (
      <View accessibilityLabel={`${value} ${label}`} style={styles.stat}>
        {text}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
    >
      {text}
    </Pressable>
  );
}

/**
 * The top of a profile: the photo and the name as the screen's heading, the handle and home city,
 * the bio, then the three counts in one line. `aside` sits to the right of the photo (my own
 * profile puts "Edit profile" and the settings gear there).
 */
export function ProfileHeader({
  user,
  counts,
  aside,
  onPressFriends,
}: Pick<ProfileResult, "user" | "counts"> & { aside?: ReactNode; onPressFriends?: () => void }) {
  const facts = [user.username ? `@${user.username}` : "", user.homeCity ?? ""].filter((part) => part !== "").join(" · ");
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Avatar name={user.displayName} uri={user.avatarUrl} size={84} style={styles.avatar} />
        {aside ? <View style={styles.aside}>{aside}</View> : null}
      </View>
      <View style={styles.names}>
        <Text accessibilityRole="header" numberOfLines={2} style={styles.name}>
          {user.displayName}
        </Text>
        {facts !== "" ? (
          <Text muted numberOfLines={1} style={styles.facts}>
            {facts}
          </Text>
        ) : null}
      </View>
      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
      <View style={styles.stats}>
        <Stat value={counts.ranked} label="ranked" />
        <Stat value={counts.friends} label={counts.friends === 1 ? "friend" : "friends"} onPress={onPressFriends} />
        <Stat value={counts.posts} label={counts.posts === 1 ? "post" : "posts"} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  // The avatar's own ring is the page colour; pull it out so the photo lines up with the text below.
  avatar: { marginLeft: -2 },
  aside: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  names: { gap: spacing.xxs },
  name: { fontSize: 28, lineHeight: 34, fontWeight: fontWeight.bold, letterSpacing: -0.5 },
  facts: { fontSize: 15, lineHeight: 20 },
  bio: { fontSize: 15, lineHeight: 21 },
  stats: { flexDirection: "row", alignItems: "center", gap: spacing.xl, paddingTop: spacing.xxs },
  stat: { minHeight: 28, justifyContent: "center" },
  statLabel: { fontSize: 15, lineHeight: 20, color: colors.muted },
  statValue: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.bold, color: colors.fg, fontVariant: ["tabular-nums"] },
  pressed: { opacity: 0.6 },
});
