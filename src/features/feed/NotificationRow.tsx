import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Icon, Text } from "../../components";
import type { NotificationItem } from "../../lib/api";
import { formatRelativeTime } from "../../lib/format";
import { colors, fontWeight, spacing } from "../../theme";
import { notificationLook } from "./notificationLook";

/**
 * One notification: who or what it is about, the backend's `title` and `body` as they came, and how
 * long ago. Unread reads at a glance: white, heavier title and a dot. Read rows step back to grey.
 */
export function NotificationRow({
  item,
  now,
  onPress,
}: {
  item: NotificationItem;
  now: number;
  onPress: () => void;
}) {
  const look = notificationLook(item.type);
  const { actor } = item;
  const unread = !item.read;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[item.title, item.body].filter(Boolean).join(". ")}
      accessibilityHint={unread ? "Unread" : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.lead}>
        {actor ? (
          <>
            <Avatar name={actor.displayName} uri={actor.avatarUrl} size={44} />
            <View style={styles.badge}>
              <Icon name={look.icon} size={11} color={look.tint} />
            </View>
          </>
        ) : (
          <View style={styles.icon}>
            <Icon name={look.icon} size={20} color={look.tint} />
          </View>
        )}
      </View>
      <View style={styles.text}>
        <Text numberOfLines={3} style={[styles.title, unread ? styles.unreadTitle : styles.readTitle]}>
          {item.title}
        </Text>
        {item.body ? (
          <Text muted numberOfLines={2} style={styles.body}>
            {item.body}
          </Text>
        ) : null}
      </View>
      <View style={styles.side}>
        <Text muted style={styles.time}>
          {formatRelativeTime(item.createdAt, now)}
        </Text>
        {unread ? <View accessibilityLabel="Unread" style={styles.dot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // No lines between rows: the round leads and the space keep them apart.
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, minHeight: 64, paddingVertical: spacing.md },
  pressed: { opacity: 0.6 },
  lead: { width: 44, height: 44 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 15, lineHeight: 20 },
  unreadTitle: { fontWeight: fontWeight.semibold, color: colors.fg },
  readTitle: { fontWeight: fontWeight.regular, color: colors.muted },
  body: { fontSize: 13, lineHeight: 18 },
  side: { alignItems: "flex-end", gap: spacing.sm, paddingTop: 1, minWidth: 28 },
  time: { fontSize: 13, lineHeight: 18 },
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.accent },
});
