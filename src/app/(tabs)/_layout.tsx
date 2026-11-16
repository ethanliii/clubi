import { useConvexAuth, useQuery } from "convex/react";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import { Avatar, Icon, Text } from "../../components";
import { TabIcon, type TabIconName } from "../../features/home/TabIcon";
import { colors, fontWeight } from "../../theme";

/** Idle tabs: the body-muted grey, dark enough to read at 11pt on white. The open tab is black and bold. */
const IDLE = colors.muted;

const TABS: Record<string, { label: string; icon: TabIconName | null }> = {
  index: { label: "Home", icon: "home" },
  map: { label: "Map", icon: "map" },
  rate: { label: "", icon: null },
  recs: { label: "Search", icon: "compass" },
  profile: { label: "Profile", icon: "profile" },
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="rate" options={{ title: "Rate" }} />
      <Tabs.Screen name="recs" options={{ title: "Search" }} />
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
            aria-selected={focused}
            onPress={onPress}
            style={styles.item}
          >
            {({ pressed }) =>
              tab.icon === null ? (
                // The one accented thing in the bar: rank a place. No word under it, so the plus
                // sits in the middle of the bar's height. Open: a gap and an accent ring.
                <View style={[styles.rankRing, pressed && styles.rankPressed]}>
                  {focused ? <View style={styles.rankRingOn} /> : null}
                  <View style={[styles.rank, focused && styles.rankOn]}>
                    <Icon name="plus" size={24} color={colors.white} />
                  </View>
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
    backgroundColor: colors.bg,
  },
  item: { flex: 1, height: 52, alignItems: "center", justifyContent: "center" },
  tab: { alignItems: "center", gap: 3 },
  tabPressed: { opacity: 0.55 },
  // Every tab's picture sits in the same 34pt box, so the five labels share one baseline.
  glyph: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  face: { padding: 1.5, borderRadius: 16, borderWidth: 1.5, borderColor: "transparent" },
  faceOn: { borderColor: colors.fg },
  label: { fontSize: 11, lineHeight: 13, fontWeight: fontWeight.medium },
  labelOn: { fontWeight: fontWeight.bold },
  // 46pt, centred in the 52pt item: the other four tabs' icon and label together are about as tall.
  rankRing: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  rankRingOn: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 23, borderWidth: 1.5, borderColor: colors.accent },
  rank: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  rankOn: { width: 38, height: 38, borderRadius: 19 },
  rankPressed: { opacity: 0.85, transform: [{ scale: 0.94 }] },
});
