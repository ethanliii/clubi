import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Icon, Text } from "../../components";
import type { NotificationItem } from "../../lib/api";
import { formatRelativeTime } from "../../lib/format";
import { colors, fontWeight, spacing } from "../../theme";
import { notificationLook } from "./notificationLook";

/**
 * One notification: who or what it is about, the backend's `title` and `body` as they came,
 * the kind of news and how long ago, and a dot while it is unread.
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[item.title, item.body].filter(Boolean).join(". ")}
      accessibilityHint={item.read ? undefined : "Unread"}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.lead}>
        {actor ? (
          <>
            <Avatar name={actor.displayName} uri={actor.avatarUrl} size={40} />
            <View style={styles.badge}>
              <Icon name={look.icon} size={11} color={look.tint} />
            </View>
          </>
        ) : (
          <View style={styles.icon}>
            <Icon name={look.icon} size={18} color={look.tint} />
          </View>
        )}
      </View>
      <View style={styles.text}>
        <Text numberOfLines={3} style={[styles.title, !item.read && styles.unreadTitle]}>
          {item.title}
        </Text>
        {item.body ? (
          <Text variant="caption" muted numberOfLines={3}>
            {item.body}
          </Text>
        ) : null}
        <Text variant="caption" muted>
          {look.kind} · {formatRelativeTime(item.createdAt, now)}
        </Text>
      </View>
      <View style={styles.dotSlot}>{item.read ? null : <View accessibilityLabel="Unread" style={styles.dot} />}</View>
    </Pressable>
  );
}

// Bryan's list row: 40 round lead, body-size text, muted captions, a full line underneath.
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 64,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: { opacity: 0.6 },
  lead: { width: 40, height: 40 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: spacing.xxs },
  title: { fontWeight: fontWeight.regular },
  unreadTitle: { fontWeight: fontWeight.bold },
  dotSlot: { width: 8, alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
