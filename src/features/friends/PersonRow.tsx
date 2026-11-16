import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Text } from "../../components";
import type { UserCard } from "../../lib/api";
import { userPath } from "../../lib/links";
import { colors, fontWeight, spacing } from "../../theme";

const AVATAR = 48;

/**
 * One person in a list: face, name, one quiet line of facts, and whatever the row offers on the
 * right (a button, their taste match). Tapping the face or the name opens their profile; what sits
 * in `right` keeps its own taps. No dividers: a list reads as one column of faces.
 */
export function PersonRow({
  user,
  subtitle,
  right,
}: {
  user: UserCard;
  subtitle?: string;
  right?: ReactNode;
  /** Kept for callers; rows carry no dividers. */
  last?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={user.displayName}
        onPress={() => router.push(userPath(user.userId))}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <Avatar name={user.displayName} uri={user.avatarUrl} size={AVATAR} />
        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.name}>
            {user.displayName}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

/** "@albert · 3 mutual friends": the facts under a name, skipping the ones that are missing. */
export function personFacts(parts: (string | null | undefined | false)[]): string {
  return parts.filter((part): part is string => typeof part === "string" && part !== "").join(" · ");
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 64 },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 8 },
  pressed: { opacity: 0.55 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: colors.fg },
  subtitle: { fontSize: 14, lineHeight: 19, color: colors.muted },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
});
