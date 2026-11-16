import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "../theme";
import { BackButton } from "./BackButton";
import { Text } from "./Text";

export type HeaderProps = {
  title?: string;
  /** One quiet line under the title: a date, a count, where you are. */
  subtitle?: string;
  /** Show the back button. Default true; tab screens pass false. */
  back?: boolean;
  /** Replace what the back button does. */
  onBack?: () => void;
  /** Buttons on the right, e.g. an `IconButton`. */
  right?: ReactNode;
};

/**
 * The top of a screen. First child of `Screen`.
 * With a back button: the back button and the actions share a row, and the title sits under them
 * as the screen's one big heading. Without (tab screens): the heading with the actions beside it.
 */
export function Header({ title, subtitle, back = true, onBack, right }: HeaderProps) {
  const actions = right ? <View style={styles.right}>{right}</View> : null;
  const sub = subtitle ? (
    <Text muted numberOfLines={1}>
      {subtitle}
    </Text>
  ) : null;
  if (!back) {
    return (
      <View style={styles.tabRow}>
        <View style={styles.title}>
          <Text variant="heading" accessibilityRole="header" numberOfLines={1}>
            {title ?? ""}
          </Text>
          {sub}
        </View>
        {actions}
      </View>
    );
  }
  return (
    <View style={styles.stack}>
      <View style={styles.row}>
        <BackButton onPress={onBack} style={styles.back} />
        <View style={styles.title} />
        {actions}
      </View>
      {title ? (
        <View style={styles.titles}>
          <Text variant="heading" accessibilityRole="header" numberOfLines={2}>
            {title}
          </Text>
          {sub}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 44 },
  // A plain chevron, no grey disc; its glyph lines up with the page gutter.
  back: { backgroundColor: "transparent", width: 44, height: 44, borderRadius: 22, marginLeft: -12 },
  tabRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 44, paddingTop: spacing.xs },
  title: { flex: 1 },
  titles: { gap: spacing.xs },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
