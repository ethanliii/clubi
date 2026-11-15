import type { ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { BackButton, Button, Screen, Text, type ButtonProps } from "../../components";
import { colors, spacing } from "../../theme";

/**
 * The frame every step of the rank flow shares: the round back button on its own row, content that
 * scrolls, and the step's main buttons pinned to the bottom where a thumb reaches them. Taps on
 * buttons work while the keyboard is up, and the keyboard never covers the caption box.
 *
 * The step's name is drawn the way the Home tab draws its header: a small uppercase label, with the
 * big heading (when the step has one) right under it. Steps that show their name inside a card
 * pass an empty `title`.
 */
export function FlowScreen({
  title,
  heading,
  center,
  back = true,
  onBack,
  right,
  children,
  footer,
}: {
  title: string;
  /** The big line under the label, e.g. the venue's name. */
  heading?: string;
  /** Center the label and the heading. */
  center?: boolean;
  /** Show the back button. The result and question steps have none: the ranking is already saved. */
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Screen scroll={false} edges={["top", "bottom"]}>
      {back || right ? (
        <View style={styles.top}>
          {back ? <BackButton onPress={onBack} /> : null}
          <View style={styles.fill} />
          {right}
        </View>
      ) : null}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {title || heading ? (
            <View style={styles.titles}>
              {title ? (
                <Text variant="label" center={center} accessibilityRole={heading ? undefined : "header"}>
                  {title}
                </Text>
              ) : null}
              {heading ? (
                <Text variant="heading" center={center} accessibilityRole="header">
                  {heading}
                </Text>
              ) : null}
            </View>
          ) : null}
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * A `Button` that shows a spinner and cannot be pressed while `busy`. The label never changes,
 * so tests and screen readers keep finding it.
 */
export function BusyButton({ busy, disabled, style, ...props }: ButtonProps & { busy: boolean }) {
  return (
    <View style={[styles.busyWrap, style]}>
      <Button {...props} disabled={disabled || busy} accessibilityState={{ busy, disabled: !!disabled || busy }} />
      {busy ? (
        <View style={styles.spinner}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 36 },
  titles: { gap: spacing.xs },
  content: { gap: spacing.lg, paddingBottom: spacing.lg },
  footer: { gap: spacing.sm, paddingTop: spacing.md },
  busyWrap: { width: "100%", justifyContent: "center" },
  spinner: { position: "absolute", right: spacing.lg, top: 0, bottom: 0, justifyContent: "center", pointerEvents: "none" },
});
