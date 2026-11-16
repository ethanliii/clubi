import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { EmptyState, Icon, Screen, TabHeader, Text } from "../../components";
import { SpotRow, SpotRowsSkeleton } from "../../features/rate/SpotRow";
import { noFocusRing } from "../../features/rate/ui";
import { api, type NearbyItem } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { ratePath } from "../../lib/links";
import { useDebounced } from "../../lib/useDebounced";
import { useKeptQuery } from "../../lib/useKeptQuery";
import { useNearby } from "../../lib/useNearby";
import { colors, palette, spacing } from "../../theme";

/** How many nearby places to offer before the user types anything. */
const SUGGESTIONS = 15;

/** Rank flow, step 1: pick a spot. Tapping a row opens the rest of the flow for that place or event. */
export default function RateScreen() {
  const [input, setInput] = useState("");
  const text = useDebounced(input.trim(), 300);
  const searching = input.trim().length >= 2;
  const { lat, lng, ready } = useDemoLocation();
  const nearby = useNearby("all");
  const found = useKeptQuery(api.places.search, ready && text.length >= 2 ? { text, lat, lng } : "skip", text);

  // While the box and the debounced text disagree, the old results are for something else: show loading.
  // An event that has not started cannot be ranked yet, so it is not offered.
  const [now] = useState(() => Date.now());
  const happened = (item: NearbyItem) => item.startsAt === undefined || item.startsAt <= now;
  const results: NearbyItem[] | undefined = searching
    ? text === input.trim()
      ? found?.filter(happened)
      : undefined
    : nearby?.items.filter(happened).slice(0, SUGGESTIONS);

  // Coming back to this tab after a flow was opened from it: a clean box, not the last search.
  const left = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (left.current) {
        left.current = false;
        setInput("");
      }
    }, []),
  );

  const pick = (item: NearbyItem) => {
    left.current = true;
    router.push(ratePath(item.kind, item.id));
  };

  return (
    <Screen scroll={false}>
      <TabHeader title="Rank a spot" />
      <View style={styles.search}>
        <Icon name="search" size={16} color={colors.muted} />
        <TextInput
          placeholder="Where did you go?"
          accessibilityLabel="Where did you go?"
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          value={input}
          onChangeText={setInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={[styles.input, noFocusRing]}
        />
        {input !== "" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={12}
            onPress={() => setInput("")}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <Icon name="close" size={10} color={colors.bg} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {results === undefined ? (
          <SpotRowsSkeleton />
        ) : results.length === 0 ? (
          searching ? (
            <EmptyState title="No matches" body="Check the spelling, or try the name of the place." icon="search" />
          ) : (
            <EmptyState title="Nothing here yet. We're loading places for this area." body="Search for a place by name." icon="map" />
          )
        ) : (
          <>
            {searching ? null : <Text accessibilityRole="header" accessibilityLabel="Near you" style={styles.hint}>NEAR YOU</Text>}
            {results.map((item) => (
              <SpotRow key={`${item.kind}:${item.id}`} item={item} onPress={() => pick(item)} />
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: palette.field,
  },
  // 16 keeps iOS Safari from zooming the page when the box is focused.
  input: { flex: 1, height: 44, fontSize: 16, color: colors.fg },
  clear: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.low,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.xl },
  hint: { fontSize: 12, lineHeight: 16, fontWeight: "800", letterSpacing: 0.9, color: colors.fg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
});
