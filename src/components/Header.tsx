import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "../theme";
import { BackButton } from "./BackButton";
import { Text } from "./Text";

export type HeaderProps = {
  title?: string;
  /** Show the back button. Default true; tab screens pass false. */
  back?: boolean;
  /** Replace what the back button does. */
  onBack?: () => void;
  /** Buttons on the right, e.g. an `IconButton`. */
  right?: ReactNode;
};

/**
 * The top of a screen, laid out the way Bryan does it. First child of `Screen`.
 * With a back button: the round back button and the actions share a row, and the title sits
 * under them as the big heading. Without (tab screens): the heading with the actions beside it.
 */
export function Header({ title, back = true, onBack, right }: HeaderProps) {
  const actions = right ? <View style={styles.right}>{right}</View> : null;
  if (!back) {
    return (
      <View style={styles.row}>
        <Text variant="heading" accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title ?? ""}
        </Text>
        {actions}
      </View>
    );
  }
  return (
    <View style={styles.stack}>
      <View style={styles.row}>
        <BackButton onPress={onBack} />
        <View style={styles.title} />
        {actions}
      </View>
      {title ? (
        <Text variant="heading" accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 36 },
  title: { flex: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
