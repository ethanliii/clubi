import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Avatar, Icon, Text } from "../../components";
import { colors, fontWeight, spacing } from "../../theme";
import { GUTTER } from "./Page";

const FACE = 56;
const SLOT = 68;

/**
 * One person as a face with their first name under it. With `onPress` it is a button; with
 * `selected` set (true or false) it is a tick box: the pink ring and tick mean "picked".
 */
export function Face({
  name,
  uri,
  label,
  caption,
  selected,
  dim = false,
  onPress,
  accessibilityLabel,
}: {
  /** The full name: the avatar's initials and colour, and what screen readers hear. */
  name: string;
  uri?: string | null;
  /** Under the face. Default: the first name. */
  label?: string;
  /** A second, quieter line: "Organizer", "Invited". */
  caption?: string;
  selected?: boolean;
  /** Faded: invited or declined, not in yet. */
  dim?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const body = (
    <>
      <View style={[styles.ring, selected && styles.ringOn]}>
        <Avatar name={name} uri={uri} size={FACE} style={dim ? styles.dim : undefined} />
        {selected ? (
          <View style={styles.tick}>
            <Icon name="check" size={12} color={colors.white} />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={[styles.name, dim && styles.nameDim]}>
        {label ?? name.split(" ")[0]}
      </Text>
      {caption ? (
        <Text variant="caption" muted numberOfLines={1} style={styles.caption}>
          {caption}
        </Text>
      ) : null}
    </>
  );
  if (!onPress) {
    return (
      <View accessibilityLabel={accessibilityLabel ?? name} style={styles.slot}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole={selected === undefined ? "button" : "checkbox"}
      accessibilityLabel={accessibilityLabel ?? name}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.slot, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

/** The round "+" at the end of a row of faces: "Invite". */
export function AddFace({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.slot, pressed && styles.pressed]}
    >
      <View style={styles.ring}>
        <View style={styles.add}>
          <Icon name="plus" size={22} color={colors.fg} />
        </View>
      </View>
      <Text numberOfLines={1} style={styles.name}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Faces in one line that scrolls sideways, running off both edges of the screen. */
export function FaceRow({ children, inset = GUTTER }: { children: ReactNode; /** The side margin of whatever holds the row. */ inset?: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={[styles.scroller, { marginHorizontal: -inset }]}
      contentContainerStyle={[styles.row, { paddingHorizontal: inset - 6 }]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  row: { gap: spacing.xs, alignItems: "flex-start" },
  slot: { width: SLOT, alignItems: "center", gap: 2, paddingVertical: 2 },
  pressed: { opacity: 0.6 },
  // Room for the selection ring, so picking someone does not shift the row.
  ring: {
    width: FACE + 6,
    height: FACE + 6,
    borderRadius: (FACE + 6) / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
    marginBottom: 2,
  },
  ringOn: { borderColor: colors.accent },
  dim: { opacity: 0.55 },
  tick: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  add: {
    width: FACE - 4,
    height: FACE - 4,
    borderRadius: (FACE - 4) / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 13, lineHeight: 17, fontWeight: fontWeight.semibold, maxWidth: SLOT, textAlign: "center" },
  nameDim: { color: colors.muted },
  caption: { fontSize: 11, lineHeight: 14, maxWidth: SLOT, textAlign: "center" },
});
