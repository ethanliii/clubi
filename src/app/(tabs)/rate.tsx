import { router } from "expo-router";
import { useQuery } from "convex/react";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { EmptyState, Header, ItemCard, Screen, SkeletonRows, Text, TextField } from "../../components";
import { api, type NearbyItem } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { ratePath } from "../../lib/links";
import { useDebounced } from "../../lib/useDebounced";
import { useNearby } from "../../lib/useNearby";
import { spacing } from "../../theme";

/** How many nearby places to offer before the user types anything. */
const SUGGESTIONS = 15;

/** Rank flow, step 1: pick a spot. Tapping a row opens the rest of the flow for that place or event. */
export default function RateScreen() {
  const [input, setInput] = useState("");
  const text = useDebounced(input.trim(), 300);
  const searching = input.trim().length >= 2;
  const { lat, lng, ready } = useDemoLocation();
  const nearby = useNearby("all");
  const found = useQuery(api.places.search, ready && text.length >= 2 ? { text, lat, lng } : "skip");

  // While the box and the debounced text disagree, the old results are for something else: show loading.
  const results: NearbyItem[] | undefined = searching ? (text === input.trim() ? found : undefined) : nearby?.items.slice(0, SUGGESTIONS);

  const pick = (item: NearbyItem) => router.push(ratePath(item.kind, item.id));

  return (
    <Screen scroll={false}>
      <Header title="Rank a spot" back={false} />
      <TextField
        placeholder="Where did you go?"
        accessibilityLabel="Where did you go?"
        value={input}
        onChangeText={setInput}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text variant="label">{searching ? "Results" : "Nearby"}</Text>
        {results === undefined ? (
          <SkeletonRows count={6} />
        ) : results.length === 0 ? (
          searching ? (
            <EmptyState title="No matches" body="Check the spelling, or try the name of the place." icon="search" />
          ) : (
            <EmptyState title="Nothing here yet. We're loading places for this area." body="Search for a place by name." icon="map" />
          )
        ) : (
          <View>
            {results.map((item) => (
              <ItemCard key={`${item.kind}:${item.id}`} item={item} onPress={() => pick(item)} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { gap: spacing.sm, paddingBottom: spacing.xl },
});
