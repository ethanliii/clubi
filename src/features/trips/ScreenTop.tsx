import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { BackButton, Text } from "../../components";
import { spacing } from "../../theme";

/**
 * The top of a pushed screen, the way Bryan's screens open: the round back button on its own
 * row (actions on the right), then a small uppercase kicker over the big heading.
 */
export function ScreenTop({
  title,
  kicker,
  right,
}: {
  title: string;
  /** The small uppercase line over the title ("Friends · live" on Home). */
  kicker?: string;
  /** Buttons on the right of the back button's row. */
  right?: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <BackButton />
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      <View>
        {kicker ? <Text variant="label">{kicker}</Text> : null}
        <Text variant="heading" accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
      </View>
    </View>
  );
}

/** A section's title in Bryan's style: the small uppercase muted label. "Who's in (3)". */
export function SectionLabel({ title, count }: { title: string; count?: number }) {
  return (
    <Text variant="label" accessibilityRole="header">
      {count === undefined ? title : `${title} (${count})`}
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 36 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
