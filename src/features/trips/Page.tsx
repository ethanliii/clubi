import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../../theme";

/** The side margin every section on these screens lines up on. */
export const GUTTER = spacing.lg;

/**
 * A scrolling screen with two things the shared `Screen` does not do: a picture that runs edge to
 * edge under the status bar (`hero`), and one action pinned above the home bar (`footer`) while
 * the content scrolls under it.
 */
export function Page({
  children,
  hero,
  footer,
}: {
  children: ReactNode;
  /** Drawn first, full width, starting at the very top of the screen. */
  hero?: ReactNode;
  /** Stays at the bottom, in thumb reach. */
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const footerSpace = footer ? 96 + insets.bottom : spacing.xxl + insets.bottom;
  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: footerSpace }}
      >
        {hero}
        <View style={[styles.content, !hero && { paddingTop: insets.top + spacing.xs }]}>{children}</View>
      </ScrollView>
      {footer ? (
        <View pointerEvents="box-none" style={styles.footer}>
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(255,255,255,0)", colors.bg]}
            locations={[0, 0.45]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.footerInner, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: GUTTER, gap: spacing.xl },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0 },
  footerInner: { paddingHorizontal: GUTTER, paddingTop: spacing.xl },
});
