import { StyleSheet, View } from "react-native";
import { Avatar, Text } from "../../components";
import type { ProfileResult } from "../../lib/api";
import { colors, fontWeight, radius, spacing } from "../../theme";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View accessibilityLabel={`${value} ${label}`} style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );
}

/** The top of a profile: photo, name, username, home city, bio and the three counts. */
export function ProfileHeader({ user, counts }: Pick<ProfileResult, "user" | "counts">) {
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Avatar name={user.displayName} uri={user.avatarUrl} size={72} />
        <View style={styles.names}>
          <Text variant="heading" numberOfLines={2}>
            {user.displayName}
          </Text>
          <Text muted numberOfLines={1}>
            {[user.username ? `@${user.username}` : "", user.homeCity ?? ""].filter((part) => part !== "").join(" · ")}
          </Text>
        </View>
      </View>
      {user.bio ? <Text>{user.bio}</Text> : null}
      <View style={styles.stats}>
        <Stat value={counts.ranked} label="ranked" />
        <Stat value={counts.friends} label={counts.friends === 1 ? "friend" : "friends"} />
        <Stat value={counts.posts} label={counts.posts === 1 ? "post" : "posts"} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  names: { flex: 1, gap: 2 },
  stats: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.md,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 20, lineHeight: 24, fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
});
