/**
 * The search field over the map and the results under it. Results are `api.places.search` rows,
 * in the backend's order; tapping one opens its page.
 */
import { router } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Icon, SkeletonRows, Text } from "../../components";
import { api } from "../../lib/api";
import { venuePath } from "../../lib/links";
import { useDebounced } from "../../lib/useDebounced";
import { useKeptQuery } from "../../lib/useKeptQuery";
import { colors, fontWeight, spacing } from "../../theme";
import { MapRow } from "./MapRow";

export const SEARCH_PLACEHOLDER = "Search places and events";
export const SEARCH_HEIGHT = 48;
const MIN_LETTERS = 2;

export function SearchBox({ value, onChangeText }: { value: string; onChangeText: (text: string) => void }) {
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const open = focused || value !== "";
  const cancel = () => {
    onChangeText("");
    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  return (
    <View style={styles.bar}>
      <Pressable accessible={false} onPress={() => inputRef.current?.focus()} style={styles.box}>
        <Icon name="search" size={18} color={open ? colors.fg : colors.muted} />
        <TextInput
          ref={inputRef}
          accessibilityLabel={SEARCH_PLACEHOLDER}
          placeholder={SEARCH_PLACEHOLDER}
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.input}
        />
        {value !== "" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={12}
            onPress={() => {
              onChangeText("");
              inputRef.current?.focus();
            }}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <Icon name="close" size={11} color={colors.white} />
          </Pressable>
        ) : null}
      </Pressable>
      {open ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel search"
          hitSlop={8}
          onPress={cancel}
          style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * What shows under the field while the user types: nothing below two letters, then skeleton rows,
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
  const results = useKeptQuery(api.places.search, ready && asked ? { text: debounced, lat, lng } : "skip", debounced);
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
          <Text style={styles.none}>No matches</Text>
          <Text style={styles.noneBody}>Try a different name or a shorter word.</Text>
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled">
          {results.map((item, index) => (
            <MapRow
              key={item.id}
              item={item}
              last={index === results.length - 1}
              onPress={() => router.push(venuePath(item.kind, item.id))}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  box: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: SEARCH_HEIGHT,
    paddingRight: spacing.md,
    paddingLeft: 16,
    borderRadius: 14,
    backgroundColor: colors.bg,
    shadowColor: colors.black,
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  input: {
    flex: 1,
    height: SEARCH_HEIGHT,
    color: colors.fg,
    // 16 everywhere: a phone browser zooms the page in on a smaller text field, and it is the native size.
    fontSize: 16,
    paddingVertical: 0,
    // The rounded box around it is the field; the browser's own focus ring would draw a second one inside.
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  // The small filled cross of a native search field.
  clear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.low,
  },
  cancel: { height: SEARCH_HEIGHT, justifyContent: "center" },
  cancelText: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.medium, color: colors.accent },
  pressed: { opacity: 0.6 },
  results: {
    // The page behind is white while searching: the results are a plain list on it, edge to edge.
    marginHorizontal: -(spacing.lg - 2),
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  padded: { padding: spacing.lg, gap: 4 },
  none: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.semibold, color: colors.fg },
  noneBody: { fontSize: 14, lineHeight: 20, color: colors.muted },
});
