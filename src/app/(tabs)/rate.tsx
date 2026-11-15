import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { EmptyState, Header, Icon, Screen, Text } from "../../components";
import { SpotRow, SpotRowsSkeleton } from "../../features/rate/SpotRow";
import { noFocusRing, type } from "../../features/rate/ui";
import { api, type NearbyItem } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { ratePath } from "../../lib/links";
import { useDebounced } from "../../lib/useDebounced";
import { useKeptQuery } from "../../lib/useKeptQuery";
import { useNearby } from "../../lib/useNearby";
import { colors, fontSize, radius, spacing } from "../../theme";

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
  const results: NearbyItem[] | undefined = searching ? (text === input.trim() ? found : undefined) : nearby?.items.slice(0, SUGGESTIONS);

  const pick = (item: NearbyItem) => router.push(ratePath(item.kind, item.id));

  return (
    <Screen scroll={false}>
      <Header title="Rank a spot" back={false} />
      <View style={styles.search}>
        <Icon name="search" size={20} color={colors.muted} />
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
            <Icon name="close" size={12} color={colors.bg} />
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
            {searching ? null : <Text style={[type.meta, styles.hint]}>Near you</Text>}
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
    gap: spacing.sm + 2,
    height: 50,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  // 16 keeps iOS Safari from zooming the page when the box is focused.
  input: { flex: 1, height: 50, fontSize: fontSize.bodyLg, color: colors.fg },
  clear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.xl },
  hint: { paddingBottom: spacing.xs },
});
