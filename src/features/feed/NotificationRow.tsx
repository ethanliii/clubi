import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Icon, Text } from "../../components";
import type { NotificationItem } from "../../lib/api";
import { formatRelativeTime } from "../../lib/format";
import { colors, fontWeight, spacing } from "../../theme";
import { notificationLook } from "./notificationLook";

/**
 * One notification: who or what it is about, the backend's `title` and `body` as they came, and how
 * long ago. The actor's name is bold; an unread row carries a small accent dot at the right.
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
  // The actor's name leads the backend's sentence when it is there; it is set bold, the rest as written.
  const lead = actor && item.title.startsWith(actor.displayName) ? actor.displayName : "";
  const rest = item.title.slice(lead.length);
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
            <Avatar name={actor.displayName} uri={actor.avatarUrl} size={48} />
            <View style={styles.badge}>
              <Icon name={look.icon} size={11} color={look.tint} />
            </View>
          </>
        ) : (
          <View style={styles.icon}>
            <Icon name={look.icon} size={22} color={look.tint} />
          </View>
        )}
      </View>
      <View style={styles.text}>
        {/* One sentence, the way Instagram and Beli write it: what happened, then how long ago in grey. */}
        <Text numberOfLines={3} style={[styles.title, unread ? styles.unreadTitle : styles.readTitle]}>
          {lead ? <Text style={styles.actor}>{lead}</Text> : null}
          {rest}
          <Text style={styles.time}>  {formatRelativeTime(item.createdAt, now)}</Text>
        </Text>
        {item.body ? (
          <Text muted numberOfLines={2} style={styles.body}>
            {item.body}
          </Text>
        ) : null}
      </View>
      <View style={styles.side}>{unread ? <View accessibilityLabel="Unread" style={styles.dot} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 72, paddingVertical: spacing.md },
  pressed: { opacity: 0.6 },
  lead: { width: 48, height: 48 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, lineHeight: 20 },
  unreadTitle: { fontWeight: fontWeight.regular, color: colors.fg },
  readTitle: { fontWeight: fontWeight.regular, color: colors.fg },
  actor: { fontWeight: fontWeight.bold, color: colors.fg },
  body: { fontSize: 13, lineHeight: 18 },
  side: { width: 10, alignItems: "center", justifyContent: "center" },
  time: { fontSize: 13, lineHeight: 20, fontWeight: fontWeight.regular, color: colors.muted },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
