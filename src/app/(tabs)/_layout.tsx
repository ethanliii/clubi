import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text } from "../../components";
import { TabIcon, type TabIconName } from "../../features/home/TabIcon";
import { colors, fontWeight } from "../../theme";

const TABS: Record<string, { label: string; icon: TabIconName | null }> = {
  index: { label: "Home", icon: "home" },
  map: { label: "Map", icon: "map" },
  rate: { label: "Rank a place", icon: null },
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
  return (
    // A phone with a home indicator already leaves room under the bar; one without gets a little.
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom - 8, 8) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        const focused = state.index === index;
        const color = focused ? colors.fg : colors.muted;
        const onPress = () => {
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={styles.item}
          >
            {({ pressed }) =>
              tab.icon === null ? (
                // The one accented thing in the bar: rank a place.
                <View style={[styles.rank, pressed && styles.rankPressed]}>
                  <Icon name="plus" size={22} color={colors.white} />
                </View>
              ) : (
                <View style={[styles.tab, pressed && styles.tabPressed]}>
                  <TabIcon name={tab.icon} active={focused} color={color} />
                  <Text style={[styles.label, { color }, focused && styles.labelOn]}>{tab.label}</Text>
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
    paddingTop: 4,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  item: { flex: 1, height: 52, alignItems: "center", justifyContent: "center" },
  tab: { alignItems: "center", gap: 2 },
  tabPressed: { opacity: 0.55 },
  label: { fontSize: 11, lineHeight: 14, fontWeight: fontWeight.medium },
  labelOn: { fontWeight: fontWeight.bold },
  rank: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  rankPressed: { opacity: 0.85, transform: [{ scale: 0.94 }] },
});
