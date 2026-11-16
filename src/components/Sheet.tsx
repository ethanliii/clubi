import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, elevation, motion, palette, radius, spacing } from "../theme";
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
  // The backdrop fades (the Modal does that); the panel itself slides up from the bottom edge.
  const [slide] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!visible) {
      slide.setValue(0);
      return;
    }
    Animated.timing(slide, {
      toValue: 1,
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [visible, slide]);
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [360, 0] });
  // "Comments 7": a trailing count is drawn quieter than the words before it.
  const counted = title ? /^(.*\S)\s+(\d+)$/.exec(title) : null;
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
        <Animated.View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg), transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          <View style={[styles.header, !!title && styles.ruled]}>
            <Text accessibilityRole="header" accessibilityLabel={title ?? ""} numberOfLines={1} style={styles.title}>
              {counted ? counted[1] : (title ?? "")}
              {counted ? <Text style={[styles.title, styles.count]}>{`  ${counted[2]}`}</Text> : null}
            </Text>
            <IconButton icon="close" accessibilityLabel="Close sheet" plain size={40} color={colors.fg} onPress={onClose} style={styles.close} />
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
        </Animated.View>
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
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line },
  // A centred title under the grab handle, a plain cross at the right, a hairline under both.
  header: { height: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 52, marginTop: spacing.xs, marginBottom: spacing.md },
  ruled: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  title: { fontSize: 16, lineHeight: 21, fontWeight: "700", letterSpacing: -0.2, color: colors.fg, textAlign: "center" },
  count: { color: colors.low, fontWeight: "400", letterSpacing: 0 },
  close: { position: "absolute", right: 6, top: 2 },
  scroller: { flexGrow: 0 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  fill: { flexShrink: 1 },
});
