import { useState } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fontWeight, palette } from "../theme";
import { initials } from "../lib/format";
import { Text } from "./Text";

function hueOf(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) % 360;
  return hash;
}

export type AvatarProps = {
  /** The person's display name: used for the initials and the fallback color. */
  name: string;
  /** Their photo. Falls back to initials when missing or when it fails to load. */
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** A round photo, or the person's initials on a color picked from their name. */
export function Avatar({ name, uri, size = 40, style }: AvatarProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const shape = { width: size, height: size, borderRadius: size / 2 };
  const imageUri = uri && failedUri !== uri ? uri : null;
  return (
    <View
      accessibilityLabel={name}
      style={[styles.base, shape, { backgroundColor: `hsl(${hueOf(name)}, 48%, 90%)` }, style]}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} resizeMode="cover" style={[styles.image, { borderRadius: size / 2 }]} onError={() => setFailedUri(imageUri)} />
      ) : (
        <Text
          style={[styles.initials, { fontSize: size * 0.36, lineHeight: size * 0.46, color: `hsl(${hueOf(name)}, 42%, 34%)` }]}
        >
          {initials(name)}
        </Text>
      )}
      <View style={[styles.hairline, { borderRadius: size / 2 }]} />
    </View>
  );
}

export type AvatarStackProps = {
  people: { displayName: string; avatarUrl?: string | null }[];
  /** How many faces to draw before "+2". Default 3. */
  max?: number;
  size?: number;
};

/** Overlapping avatars, e.g. the friends on a card. Draws nothing for an empty list. */
export function AvatarStack({ people, max = 3, size = 24 }: AvatarStackProps) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <View style={styles.stack}>
      {shown.map((person, index) => (
        <Avatar
          key={`${person.displayName}-${index}`}
          name={person.displayName}
          uri={person.avatarUrl}
          size={size}
          style={[styles.ring, index > 0 && { marginLeft: -size / 3 }]}
        />
      ))}
      {extra > 0 ? (
        <Text variant="caption" muted style={styles.extra}>
          +{extra}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // A photo, or initials on a deep tint of the person's own colour.
  base: { alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, flexGrow: 0 },
  // A hairline drawn over the photo's edge, so a pale photo still reads as a circle on white.
  hairline: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.hairline, pointerEvents: "none" },
  image: { width: "100%", height: "100%" },
  initials: { fontWeight: fontWeight.semibold, letterSpacing: 0.2 },
  stack: { flexDirection: "row", alignItems: "center" },
  ring: { borderWidth: 2, borderColor: colors.bg },
  extra: { marginLeft: 4 },
});
