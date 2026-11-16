import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Icon, Text } from "../../components";
import { api, type Id } from "../../lib/api";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, fontWeight, radius, spacing } from "../../theme";

/**
 * "Follow" / "Following" as a small outline button: a teal outline to follow, a grey one with a
 * tick once I do. The label is whatever the backend says in `following`; a tap asks
 * `api.performers.follow` for the opposite and the live query brings the new label back.
 */
export function FollowButton({
  performerId,
  following,
  style,
}: {
  performerId: Id<"performers">;
  following: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { run, pending } = useMutationToast(api.performers.follow);
  const title = following ? "Following" : "Follow";
  const ink = following ? colors.fg : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected: following, disabled: pending }}
      disabled={pending}
      hitSlop={4}
      onPress={() => void run({ performerId, follow: !following })}
      style={({ pressed }) => [styles.button, following ? styles.on : styles.off, (pressed || pending) && styles.pressed, style]}
    >
      {following ? <Icon name="check" size={15} color={ink} /> : null}
      <Text numberOfLines={1} style={[styles.label, { color: ink }]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.bg,
  },
  off: { borderColor: colors.accent },
  on: { borderColor: colors.line },
  pressed: { opacity: 0.55 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.bold, letterSpacing: -0.1 },
});
