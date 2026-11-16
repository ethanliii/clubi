import { useMutation, useQuery } from "convex/react";
import { StyleSheet, View } from "react-native";
import { Button, EmptyState, Header, Screen, SkeletonRows, Text, useToast } from "../components";
import { dayLabel } from "../features/feed/dayLabel";
import { NotificationRow } from "../features/feed/NotificationRow";
import { api, type NotificationItem } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { openLink } from "../lib/links";
import { useMutationToast } from "../lib/useMutationToast";
import { useNow } from "../lib/useNow";
import { fontWeight, spacing } from "../theme";

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

  return (
    <Screen>
      <Header
        title="Notifications"
        right={
          // Only there while something is unread: a button that would do nothing is not shown.
          hasUnread ? (
            <Button
              title="Mark all read"
              accessibilityLabel="Mark all read"
              variant="link"
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
          {items.map((item, index) => {
            const previous = items[index - 1];
            const day = dayLabel(item.createdAt, now);
            const showDay = !previous || dayLabel(previous.createdAt, now) !== day;
            return (
              <View key={item.id}>
                {showDay ? (
                  <Text accessibilityRole="header" style={[styles.day, index > 0 && styles.nextDay]}>
                    {day}
                  </Text>
                ) : null}
                <NotificationRow item={item} now={now} onPress={() => open(item)} />
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  markAll: { minHeight: 44, justifyContent: "center" },
  day: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.semibold, paddingBottom: spacing.xs },
  nextDay: { marginTop: spacing.xl },
});
