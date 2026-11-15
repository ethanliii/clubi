import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, spacing } from "../theme";
import { Text } from "./Text";

export type ListRowProps = {
  title: string;
  subtitle?: string;
  /** In front of the text: an `Avatar`, a rank number, an icon. */
  left?: ReactNode;
  /** After the text: a `ScoreBadge`, buttons, a time. Buttons here stay tappable on their own. */
  right?: ReactNode;
  /** Makes the whole row tappable. */
  onPress?: () => void;
  onLongPress?: () => void;
  /** What tests and screen readers find for the row. Defaults to `title`. */
  accessibilityLabel?: string;
  /** Extra content under the subtitle (chips, a second line). */
  children?: ReactNode;
  /** A thin line under the row. Default true. */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** One line of a list: left thing, title and subtitle, right thing. At least 56 tall so it is easy to tap. */
export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
  onLongPress,
  accessibilityLabel,
  children,
  divider = true,
  style,
}: ListRowProps) {
  const text = (
    <View style={styles.text}>
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="caption" muted numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );

  // The tappable part is the left thing and the text. `right` sits beside it, so buttons placed
  // there ("Accept", "Follow") get their own taps on web and on native.
  return (
    <View style={[styles.row, divider && styles.divider, style]}>
      {onPress || onLongPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? title}
          onPress={onPress}
          onLongPress={onLongPress}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        >
          {left}
          {text}
        </Pressable>
      ) : (
        <View style={styles.main}>
          {left}
          {text}
        </View>
      )}
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 56 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm + 2 },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: "600" },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
