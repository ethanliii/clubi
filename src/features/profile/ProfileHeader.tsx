import { StyleSheet, View } from "react-native";
import { Avatar, Text } from "../../components";
import type { ProfileResult } from "../../lib/api";
import { colors, fontSize, fontWeight, spacing } from "../../theme";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View accessibilityLabel={`${value} ${label}`} style={styles.stat}>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text variant="caption">{label}</Text>
    </View>
  );
}

/** The top of a profile: photo with the accent ring, name and the three counts, then username, home city and bio. */
export function ProfileHeader({ user, counts }: Pick<ProfileResult, "user" | "counts">) {
  const facts = [user.username ? `@${user.username}` : "", user.homeCity ?? ""].filter((part) => part !== "").join(" · ");
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Avatar name={user.displayName} uri={user.avatarUrl} size={86} style={styles.ring} />
        <View style={styles.names}>
          <Text variant="title" numberOfLines={2}>
            {user.displayName}
          </Text>
          <View style={styles.stats}>
            <Stat value={counts.posts} label={counts.posts === 1 ? "post" : "posts"} />
            <Stat value={counts.friends} label={counts.friends === 1 ? "friend" : "friends"} />
            <Stat value={counts.ranked} label="ranked" />
          </View>
        </View>
      </View>
      {facts !== "" || user.bio ? (
        <View style={styles.about}>
          {facts !== "" ? (
            <Text muted numberOfLines={1}>
              {facts}
            </Text>
          ) : null}
          {user.bio ? <Text>{user.bio}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  ring: { borderWidth: 2, borderColor: colors.accent },
  names: { flex: 1, gap: 6 },
  stats: { flexDirection: "row" },
  stat: { flex: 1 },
  statValue: { fontSize: fontSize.title, lineHeight: 22, fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
  about: { gap: spacing.xxs },
});
