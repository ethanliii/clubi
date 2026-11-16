import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, elevation, palette, radius, spacing } from "../theme";
import { IconButton } from "./IconButton";
import { Text } from "./Text";
import { ToastViewport, useToastInSheet } from "./Toast";

export type SheetProps = {
  /** Draw the sheet. Keep the component mounted and flip this, so it can animate away. */
  visible: boolean;
  /** Called by the close button, a tap outside, the Android back button and Escape on web. */
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Wrap the content in a scroll view. Default true. Pass false when the content is its own list. */
  scroll?: boolean;
};

/**
 * A panel that slides up from the bottom over the current screen: menus, pickers, forms, comments.
 * Same component on iOS, Android and web. Toasts shown while it is open appear on top of it.
 */
export function Sheet({ visible, onClose, title, children, scroll = true }: SheetProps) {
  const insets = useSafeAreaInsets();
  useToastInSheet(visible);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={styles.backdrop} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text variant="headline" accessibilityRole="header" numberOfLines={1} style={styles.title}>
              {title ?? ""}
            </Text>
            <IconButton icon="close" accessibilityLabel="Close sheet" size={32} color={colors.muted} onPress={onClose} />
          </View>
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.scroller}
              contentContainerStyle={styles.content}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.content, styles.fill]}>{children}</View>
          )}
        </View>
        <ToastViewport />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: palette.backdrop },
  sheet: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88%",
    // White, with rounded top corners and a soft shadow.
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.sm,
    ...elevation.floating,
    // The shadow falls upward, onto the page behind the sheet.
    shadowOffset: { width: 0, height: -6 },
  },
  handle: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: colors.line },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    minHeight: 56,
  },
  title: { flex: 1, fontSize: 20, lineHeight: 25 },
  scroller: { flexGrow: 0 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  fill: { flexShrink: 1 },
});
