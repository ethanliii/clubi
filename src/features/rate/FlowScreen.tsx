import type { ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Button, Header, Screen, type ButtonProps } from "../../components";
import { colors, spacing } from "../../theme";

/**
 * The frame every step of the rank flow shares: a header, content that scrolls, and the step's
 * main buttons pinned to the bottom where a thumb reaches them. Taps on buttons work while the
 * keyboard is up, and the keyboard never covers the caption box.
 */
export function FlowScreen({
  title,
  back = true,
  onBack,
  right,
  children,
  footer,
}: {
  title: string;
  /** Show the back button. The result and question steps have none: the ranking is already saved. */
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Screen scroll={false} edges={["top", "bottom"]}>
      <Header title={title} back={back} onBack={onBack} right={right} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
  content: { gap: spacing.lg, paddingBottom: spacing.lg },
  footer: { gap: spacing.sm, paddingTop: spacing.md },
  busyWrap: { width: "100%", justifyContent: "center" },
  spinner: { position: "absolute", right: spacing.lg, top: 0, bottom: 0, justifyContent: "center", pointerEvents: "none" },
});
