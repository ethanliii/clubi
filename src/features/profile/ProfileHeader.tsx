import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Text } from "../../components";
import type { ProfileResult } from "../../lib/api";
import { colors, fontWeight, palette, spacing } from "../../theme";

function Stat({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  const text = (
    <>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text numberOfLines={1} style={styles.statLabel}>
        {label}
      </Text>
    </>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={`${value} ${label}`} style={styles.stat}>
        {text}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
    >
      {text}
    </Pressable>
  );
}

/**
 * The top of a profile, the same on mine and on anyone else's: the photo at the left with the
 * three counts beside it (ranked, friends, posts), then the name, the handle and home city and a
 * short bio, all left aligned, and the screen's buttons under them.
 */
export function ProfileHeader({
  user,
  counts,
  onPressFriends,
  children,
}: Pick<ProfileResult, "user" | "counts"> & {
  onPressFriends?: () => void;
  /** The buttons under the bio ("Edit profile", "Compare tastes"). */
  children?: ReactNode;
}) {
  const facts = [user.username ? `@${user.username}` : "", user.homeCity ?? ""].filter((part) => part !== "").join(" · ");
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Avatar name={user.displayName} uri={user.avatarUrl} size={80} />
        <View style={styles.stats}>
          <Stat value={counts.ranked} label="Ranked" />
          <Stat value={counts.friends} label={counts.friends === 1 ? "Friend" : "Friends"} onPress={onPressFriends} />
          <Stat value={counts.posts} label={counts.posts === 1 ? "Post" : "Posts"} />
        </View>
      </View>
      <View style={styles.names}>
        <Text accessibilityRole="header" numberOfLines={2} style={styles.name}>
          {user.displayName}
        </Text>
        {facts !== "" ? (
          <Text numberOfLines={1} style={styles.facts}>
            {facts}
          </Text>
        ) : null}
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
      </View>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  stats: { flex: 1, flexDirection: "row", alignItems: "center" },
  stat: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 1 },
  statValue: { fontSize: 18, lineHeight: 23, fontWeight: fontWeight.bold, color: colors.fg, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 12, lineHeight: 16, color: colors.muted },
  names: { gap: 1 },
  name: { fontSize: 17, lineHeight: 22, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: colors.fg },
  facts: { fontSize: 14, lineHeight: 19, color: colors.muted },
  bio: { fontSize: 15, lineHeight: 21, color: palette.soft, paddingTop: spacing.xs },
  actions: { alignSelf: "stretch" },
  pressed: { opacity: 0.55 },
});
