import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { BackButton } from "./BackButton";
import { Screen } from "./Screen";
import { Text } from "./Text";

export type PlaceholderLink = { label: string; href: Href };

export function PlaceholderScreen({
  title,
  description,
  back,
  links = [],
  children,
}: {
  title: string;
  description: string;
  back?: boolean;
  links?: PlaceholderLink[];
  children?: ReactNode;
}) {
  return (
    <Screen>
      {back && <BackButton />}
      <Text variant="heading">{title}</Text>
      {children}
      <View style={styles.card}>
        <Text variant="label">Coming soon</Text>
        <Text muted>{description}</Text>
      </View>
      {links.map((link) => (
        <Link key={link.label} href={link.href} style={styles.link}>
          <Text>{link.label} →</Text>
        </Link>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  link: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
});
