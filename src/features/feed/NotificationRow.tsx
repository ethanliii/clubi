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
            <Avatar name={actor.displayName} uri={actor.avatarUrl} size={44} />
            <View style={styles.badge}>
              <Icon name={look.icon} size={12} color={look.tint} />
            </View>
          </>
        ) : (
          <View style={styles.icon}>
            <Icon name={look.icon} size={20} color={look.tint} />
          </View>
        )}
      </View>
      <View style={styles.text}>
        <Text numberOfLines={3} style={[styles.title, !item.read && styles.unreadTitle]}>
          {item.title}
        </Text>
        {item.body ? (
          <Text muted numberOfLines={3}>
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

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  pressed: { opacity: 0.6 },
  lead: { width: 44, height: 44 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
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
    backgroundColor: colors.raised,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.regular },
  unreadTitle: { fontWeight: fontWeight.bold },
  dotSlot: { width: 10, alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
