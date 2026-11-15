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

/** The top row of a screen: back button, title, and actions on the right. First child of `Screen`. */
export function Header({ title, back = true, onBack, right }: HeaderProps) {
  return (
    <View style={styles.row}>
      {back ? <BackButton onPress={onBack} /> : null}
      <Text variant={back ? "title" : "heading"} accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title ?? ""}
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 40 },
  title: { flex: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
