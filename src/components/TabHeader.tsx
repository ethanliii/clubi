import { useQuery } from "convex/react";
import { router } from "expo-router";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { APP_NAME } from "../constants/brand";
import { api } from "../lib/api";
import { paths } from "../lib/links";
import { colors, wordmark } from "../theme";
import { IconButton } from "./IconButton";
import { Text } from "./Text";
import { ThemeToggle } from "./ThemeToggle";

/** The backend caps the count at 99; at the cap there may be more. */
const UNREAD_CAP = 99;

/**
 * The four icons at the top right of every tab: light or dark, plans with friends, notifications
 * (with the unread count) and settings. The last one lines up with the page's right edge.
 */
export function TabActions({ style }: { style?: StyleProp<ViewStyle> }) {
  const unread = useQuery(api.notifications.unreadCount, {});
  const badge = unread ? (unread >= UNREAD_CAP ? `${UNREAD_CAP}+` : String(unread)) : null;
  return (
    <View style={[styles.icons, style]}>
      <ThemeToggle />
      <IconButton icon="calendar" size={40} plain accessibilityLabel="Trips" onPress={() => router.push(paths.trips)} />
      <IconButton
        icon="bell"
        size={40}
        plain
        accessibilityLabel="Notifications"
        badge={badge}
        onPress={() => router.push(paths.notifications)}
      />
      <IconButton icon="menu" size={40} plain accessibilityLabel="Settings" onPress={() => router.push(paths.settings)} />
    </View>
  );
}

/**
 * The top of a tab: its name at the left in the app's bold serif and the four icons at the right.
 * Without a `title` the name is the app's wordmark, in the accent colour (the Home tab); a tab with
 * nothing to name passes an empty `title` and gets the icons alone.
 */
export function TabHeader({ title, style }: { title?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.header, style]}>
      <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, title === undefined && styles.wordmark]}>
        {title ?? APP_NAME}
      </Text>
      <TabActions />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 48 },
  title: { ...wordmark, flex: 1, fontSize: 28, lineHeight: 34, color: colors.fg },
  wordmark: { color: colors.accent },
  // The icons sit close together and the last one's glyph ends at the gutter.
  icons: { flexDirection: "row", alignItems: "center", marginRight: -9 },
});
