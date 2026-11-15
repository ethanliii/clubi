import type { ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { BackButton, Button, Screen, Text, type ButtonProps } from "../../components";
import { colors, spacing } from "../../theme";
import { Steps, type } from "./ui";

/**
 * The frame every step of the rank flow shares. A slim top row (back, the place being ranked, an
 * optional action), an optional row of progress bars, the step's question as the one big line,
 * content that scrolls, and the step's main button pinned to the bottom where a thumb reaches it.
 * Taps on buttons work while the keyboard is up, and the keyboard never covers the note box.
 */
export function FlowScreen({
  title,
  heading,
  sub,
  progress,
  back = true,
  onBack,
  right,
  children,
  footer,
}: {
  /** The small line in the top row: the place being ranked. */
  title?: string;
  /** The step's question, e.g. "Which was better?". */
  heading?: string;
  /** One muted line under the question. */
  sub?: string;
  /** Bars under the top row: `current` of `total` are lit. */
  progress?: { current: number; total: number };
  /** Show the back button. The result and question steps have none: the ranking is already saved. */
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const hasTop = back || !!right || !!title;
  return (
    <Screen scroll={false} edges={["top", "bottom"]}>
      {hasTop ? (
        <View style={styles.top}>
          <View style={styles.side}>{back ? <BackButton onPress={onBack} /> : null}</View>
          <Text numberOfLines={1} style={styles.topTitle}>
            {title ?? ""}
          </Text>
          <View style={[styles.side, styles.sideRight]}>{right}</View>
        </View>
      ) : null}
      {progress ? <Steps current={progress.current} total={progress.total} /> : null}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {heading ? (
            <View style={styles.titles}>
              <Text accessibilityRole="header" style={type.question}>
                {heading}
              </Text>
              {sub ? <Text muted>{sub}</Text> : null}
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
  top: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44 },
  // Both sides are the same width, so the place's name stays centred whatever sits beside it.
  side: { width: 88, flexDirection: "row", alignItems: "center" },
  sideRight: { justifyContent: "flex-end" },
  topTitle: { flex: 1, textAlign: "center", fontSize: 15, lineHeight: 20, fontWeight: "600", color: colors.fg },
  titles: { gap: spacing.xs + 2 },
  content: { flexGrow: 1, gap: spacing.xl, paddingTop: spacing.xs, paddingBottom: spacing.lg },
  footer: { gap: spacing.sm, paddingTop: spacing.md },
  busyWrap: { width: "100%", justifyContent: "center" },
  spinner: { position: "absolute", right: spacing.lg, top: 0, bottom: 0, justifyContent: "center", pointerEvents: "none" },
});
