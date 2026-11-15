import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text, type IconName } from "../../components/bryan";
import { colors } from "../../theme";

// Home = friend feed (landing), Search = tonight picks. Decisions D2/D3 in the merge doc.
const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: "Home", icon: "home" },
  map: { label: "Map", icon: "map" },
  rate: { label: "Add", icon: "plus" },
  search: { label: "Search", icon: "search" },
  profile: { label: "Profile", icon: "user" },
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="rate" options={{ title: "Add" }} />
      <Tabs.Screen name="search" options={{ title: "Search" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        const focused = state.index === index;
        const color = focused ? colors.fg : colors.muted;
        const onPress = () => {
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };

        if (route.name === "rate") {
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              style={styles.item}
            >
              <View style={styles.plus}>
                <Icon name="plus" size={24} color={colors.white} />
              </View>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={styles.item}
          >
            <Icon name={tab.icon} color={color} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  item: { width: 60, alignItems: "center", gap: 3 },
  label: { fontSize: 10.5, lineHeight: 13 },
  plus: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -6,
  },
});
