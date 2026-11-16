import { useMutation, useQuery } from "convex/react";
import { StyleSheet, View } from "react-native";
import { EmptyState, Header, IconButton, Screen, SkeletonRows, Text, useToast } from "../components";
import { NotificationRow } from "../features/feed/NotificationRow";
import { api, type NotificationItem } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { openLink } from "../lib/links";
import { useMutationToast } from "../lib/useMutationToast";
import { useNow } from "../lib/useNow";
import { colors, fontWeight, palette, spacing } from "../theme";

export default function NotificationsScreen() {
  const items = useQuery(api.notifications.list, {});
  // The list holds the newest 50; older ones can still be unread, so the button asks the count too.
  const unreadCount = useQuery(api.notifications.unreadCount, {});
  const markRead = useMutation(api.notifications.markRead);
  const { run: markAllRead, pending } = useMutationToast(api.notifications.markAllRead);
  const toast = useToast();
  const now = useNow();

  const hasUnread = (unreadCount ?? 0) > 0 || (items?.some((item) => !item.read) ?? false);

  const open = (item: NotificationItem) => {
    // Not awaited: the row opens right away and the dot clears when the backend answers.
    if (!item.read) markRead({ id: item.id }).catch((error) => toast(errorMessage(error), "error"));
    if (item.link && !openLink(item.link)) toast("That link can't be opened in this version of the app.");
  };

  const groups = groupNotifications(items ?? [], now);

  return (
    <Screen>
      <Header
        title="Notifications"
        right={
          // Only there while something is unread: a button that would do nothing is not shown.
          hasUnread ? (
            <IconButton
              icon="checkCircle"
              size={44}
              plain
              color={colors.fg}
              accessibilityLabel="Mark all read"
              disabled={pending}
              onPress={() => void markAllRead({})}
              style={styles.markAll}
            />
          ) : undefined
        }
      />
      {items === undefined ? (
        <SkeletonRows count={6} />
      ) : items.length === 0 ? (
        <EmptyState icon="bell" title="Nothing yet" body="Rank a place and your friends will hear about it." />
      ) : (
        <View>
          {groups.map((group, groupIndex) => (
            <View key={group.label}>
              <Text accessibilityRole="header" style={[styles.label, groupIndex > 0 && styles.nextGroup]}>
                {group.label}
              </Text>
              {group.items.map((item, index) => (
                <View key={item.id}>
                  <NotificationRow item={item} now={now} onPress={() => open(item)} />
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Instagram's activity sections: everything unread under "New", then what was already seen by age.
 * The order inside a section is the backend's (newest first).
 */
function groupNotifications(items: NotificationItem[], now: number): { label: string; items: NotificationItem[] }[] {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const sections: { label: string; items: NotificationItem[] }[] = [
    { label: "New", items: [] },
    { label: "Today", items: [] },
    { label: "This week", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const item of items) {
    const index = !item.read ? 0 : item.createdAt >= startOfToday ? 1 : item.createdAt >= startOfToday - 6 * DAY ? 2 : 3;
    sections[index]!.items.push(item);
  }
  return sections.filter((section) => section.items.length > 0);
}

const styles = StyleSheet.create({
  // The icon's glyph lines up with the page's right gutter.
  markAll: { marginRight: -10 },
  // The reference's section label: small, bold, uppercase, spaced.
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.fg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  // A hairline sets one group apart from the next.
  nextGroup: { marginTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.hairline },
});
