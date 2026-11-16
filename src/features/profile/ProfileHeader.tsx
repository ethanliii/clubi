import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Text } from "../../components";
import type { ProfileResult } from "../../lib/api";
import { colors, fontWeight, palette, spacing } from "../../theme";

function Stat({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  const text = (
    <>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
 * The top of a profile: the photo, the name as the screen's heading, the handle and home city,
 * a short bio, then the three counts side by side (ranked, friends, posts).
 */
export function ProfileHeader({
  user,
  counts,
  onPressFriends,
}: Pick<ProfileResult, "user" | "counts"> & { onPressFriends?: () => void }) {
  const facts = [user.username ? `@${user.username}` : "", user.homeCity ?? ""].filter((part) => part !== "").join(" · ");
  return (
    <View style={styles.wrap}>
      <Avatar name={user.displayName} uri={user.avatarUrl} size={88} />
      <View style={styles.names}>
        <Text accessibilityRole="header" numberOfLines={2} style={styles.name}>
          {user.displayName}
        </Text>
        {facts !== "" ? (
          <Text numberOfLines={1} style={styles.facts}>
            {facts}
          </Text>
        ) : null}
      </View>
      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
      <View style={styles.stats}>
        <Stat value={counts.ranked} label="Ranked" />
        <View style={styles.rule} />
        <Stat value={counts.friends} label={counts.friends === 1 ? "Friend" : "Friends"} onPress={onPressFriends} />
        <View style={styles.rule} />
        <Stat value={counts.posts} label={counts.posts === 1 ? "Post" : "Posts"} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: spacing.md },
  names: { alignItems: "center", gap: spacing.xxs },
  name: { fontSize: 24, lineHeight: 29, fontWeight: fontWeight.bold, letterSpacing: -0.4, textAlign: "center" },
  facts: { fontSize: 15, lineHeight: 20, color: colors.muted, textAlign: "center" },
  bio: { fontSize: 15, lineHeight: 21, color: palette.soft, textAlign: "center", paddingHorizontal: spacing.md },
  stats: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", paddingTop: spacing.xs },
  stat: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 1 },
  rule: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.line },
  statValue: { fontSize: 19, lineHeight: 24, fontWeight: fontWeight.bold, color: colors.fg, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 13, lineHeight: 17, color: colors.muted },
  pressed: { opacity: 0.55 },
});
