/**
 * The search box over the map and the results under it. Results are `api.places.search` rows,
 * in the backend's order; tapping one opens its page.
 */
import { useQuery } from "convex/react";
import { Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Icon, IconButton, ItemCard, SkeletonRows, Text } from "../../components";
import { api } from "../../lib/api";
import { useDebounced } from "../../lib/useDebounced";
import { colors, fontSize, radius, spacing } from "../../theme";

export const SEARCH_PLACEHOLDER = "Search places and events";
const MIN_LETTERS = 2;

export function SearchBox({ value, onChangeText }: { value: string; onChangeText: (text: string) => void }) {
  return (
    <View style={styles.box}>
      <Icon name="search" size={18} color={colors.muted} />
      <TextInput
        accessibilityLabel={SEARCH_PLACEHOLDER}
        placeholder={SEARCH_PLACEHOLDER}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.input}
      />
      {value !== "" ? (
        <IconButton icon="close" accessibilityLabel="Clear search" size={32} plain onPress={() => onChangeText("")} />
      ) : null}
    </View>
  );
}

/**
 * What shows under the box while the user types: nothing below two letters, then skeleton rows,
 * then the matches or "No matches".
 */
export function SearchResults({
  text,
  lat,
  lng,
  ready,
  maxHeight,
}: {
  text: string;
  lat: number;
  lng: number;
  ready: boolean;
  maxHeight: number;
}) {
  const typed = text.trim();
  const debounced = useDebounced(typed, 300);
  const active = typed.length >= MIN_LETTERS;
  const asked = debounced.length >= MIN_LETTERS;
  const results = useQuery(api.places.search, ready && asked ? { text: debounced, lat, lng } : "skip");
  if (!active) return null;

  // Still waiting when the query is loading, or the user has typed on since the last request.
  const waiting = results === undefined || debounced !== typed;
  return (
    <View style={[styles.results, { maxHeight }]}>
      {waiting ? (
        <View style={styles.padded}>
          <SkeletonRows count={3} />
        </View>
      ) : results.length === 0 ? (
        <View accessibilityRole="text" style={styles.padded}>
          <Text muted center>
            No matches
          </Text>
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
          {results.map((item, index) => (
            <ItemCard key={item.id} item={item} style={index === results.length - 1 ? styles.lastRow : undefined} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    paddingLeft: spacing.md + 2,
    paddingRight: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  input: {
    flex: 1,
    minHeight: 46,
    color: colors.fg,
    fontSize: fontSize.bodyLg,
    paddingVertical: 0,
    // The rounded box around it is the field; the browser's own focus ring would draw a second one inside.
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  results: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    overflow: "hidden",
    shadowColor: colors.black,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  padded: { padding: spacing.lg },
  list: { paddingHorizontal: spacing.md },
  lastRow: { borderBottomWidth: 0 },
});
