import { useConvexAuth, useQuery } from "convex/react";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import { Avatar, Icon, Text } from "../../components";
import { TabIcon, type TabIconName } from "../../features/home/TabIcon";
import { colors, fontWeight } from "../../theme";

/** Idle tabs: a grey a step lighter than body-muted text, so the open tab reads at a glance. */
const IDLE = "#8a8a93";

const TABS: Record<string, { label: string; icon: TabIconName | null }> = {
  index: { label: "Home", icon: "home" },
  map: { label: "Map", icon: "map" },
  rate: { label: "Rank", icon: null },
  feed: { label: "Feed", icon: "feed" },
  profile: { label: "Profile", icon: "profile" },
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Tonight" }} />
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="rate" options={{ title: "Rate" }} />
      <Tabs.Screen name="feed" options={{ title: "Feed" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  // The signed-in user's own face is the Profile tab. Same query the session already holds open.
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  return (
    // A phone with a home indicator already leaves room under the bar; one without gets a little.
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom - 10, 6) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        const focused = state.index === index;
        const color = focused ? colors.fg : IDLE;
        const onPress = () => {
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.icon === null ? "Rank a place" : tab.label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={styles.item}
          >
            {({ pressed }) =>
              tab.icon === null ? (
                // The one accented thing in the bar: rank a place.
                <View style={styles.tab}>
                  <View style={[styles.rank, pressed && styles.rankPressed]}>
                    <Icon name="plus" size={20} color={colors.white} />
                  </View>
                  <Text numberOfLines={1} allowFontScaling={false} style={[styles.label, { color }, focused && styles.labelOn]}>
                    {tab.label}
                  </Text>
                </View>
              ) : (
                <View style={[styles.tab, pressed && styles.tabPressed]}>
                  <View style={styles.glyph}>
                    {tab.icon === "profile" && me ? (
                      <View style={[styles.face, focused && styles.faceOn]}>
                        <Avatar name={me.displayName} uri={me.avatarUrl} size={26} />
                      </View>
                    ) : (
                      <TabIcon name={tab.icon} active={focused} color={color} />
                    )}
                  </View>
                  <Text numberOfLines={1} allowFontScaling={false} style={[styles.label, { color }, focused && styles.labelOn]}>
                    {tab.label}
                  </Text>
                </View>
              )
            }
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 6,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
  },
  item: { flex: 1, height: 52, alignItems: "center", justifyContent: "center" },
  tab: { alignItems: "center", gap: 3 },
  tabPressed: { opacity: 0.55 },
  // Every tab's picture sits in the same 32pt box, so the five labels share one baseline.
  glyph: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  face: { padding: 1.5, borderRadius: 16, borderWidth: 1.5, borderColor: "transparent" },
  faceOn: { borderColor: colors.fg },
  label: { fontSize: 10, lineHeight: 12, fontWeight: fontWeight.medium, letterSpacing: 0.1 },
  labelOn: { fontWeight: fontWeight.bold },
  rank: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  rankPressed: { opacity: 0.85, transform: [{ scale: 0.94 }] },
});
