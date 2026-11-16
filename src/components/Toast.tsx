import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, elevation, fontWeight, radius, spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

export type ToastKind = "info" | "success" | "error";
type ToastState = { id: number; message: string; kind: ToastKind };

/** Show a short message over the screen. `kind` picks the color; errors stay up a little longer. */
export type ShowToast = (message: string, kind?: ToastKind) => void;

const ShowContext = createContext<ShowToast | null>(null);
type Current = {
  current: ToastState | null;
  dismiss: () => void;
  /** How many sheets are open. While one is, the toast is drawn inside it instead of behind it. */
  sheets: number;
  countSheet: (change: 1 | -1) => void;
};
const CurrentContext = createContext<Current>({
  current: null,
  dismiss: () => undefined,
  sheets: 0,
  countSheet: () => undefined,
});

const VISIBLE_MS: Record<ToastKind, number> = { info: 2600, success: 2200, error: 4200 };

/** Wraps the app once, in the root layout. Screens call `useToast()`. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastState | null>(null);
  const [sheets, setSheets] = useState(0);
  const countSheet = useCallback((change: 1 | -1) => setSheets((count) => Math.max(0, count + change)), []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setCurrent(null);
  }, []);

  const show = useCallback<ShowToast>((message, kind = "info") => {
    const text = message.trim();
    if (text === "") return;
    if (timer.current) clearTimeout(timer.current);
    setCurrent({ id: nextId.current++, message: text, kind });
    timer.current = setTimeout(() => {
      timer.current = null;
      setCurrent(null);
    }, VISIBLE_MS[kind]);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const state = useMemo(
    () => ({ current, dismiss, sheets, countSheet }),
    [current, dismiss, sheets, countSheet],
  );

  return (
    <ShowContext.Provider value={show}>
      <CurrentContext.Provider value={state}>
        {children}
        {sheets === 0 ? <ToastViewport /> : null}
      </CurrentContext.Provider>
    </ShowContext.Provider>
  );
}

/**
 * `const toast = useToast(); toast("Saved", "success"); toast(errorMessage(error), "error");`
 */
export function useToast(): ShowToast {
  const show = useContext(ShowContext);
  if (!show) throw new Error("useToast must be used inside ToastProvider");
  return show;
}

/** For `Sheet`: while `open` is true, toasts are drawn inside the sheet's modal, not behind it. */
export function useToastInSheet(open: boolean) {
  const { countSheet } = useContext(CurrentContext);
  useEffect(() => {
    if (!open) return;
    countSheet(1);
    return () => countSheet(-1);
  }, [open, countSheet]);
}

/**
 * Where the current toast is drawn. The provider renders one over the app; `Sheet` renders another
 * inside its modal, because a native modal covers everything behind it.
 */
export function ToastViewport() {
  const { current, dismiss } = useContext(CurrentContext);
  const insets = useSafeAreaInsets();
  if (!current) return null;
  return (
    <View style={[styles.viewport, { top: insets.top + spacing.sm }]}>
      <ToastCard key={current.id} toast={current} onPress={dismiss} />
    </View>
  );
}

function ToastCard({ toast, onPress }: { toast: ToastState; onPress: () => void }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== "web" }).start();
  }, [progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
      }}
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={toast.message}
        onPress={onPress}
        style={styles.card}
      >
        {toast.kind === "success" ? <Icon name="check" size={16} color="#5fd693" /> : null}
        {toast.kind === "error" ? <Icon name="alert" size={17} color="#ff8a80" /> : null}
        <Text style={styles.text}>{toast.message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    zIndex: 1000,
    elevation: 1000,
    pointerEvents: "box-none",
  },
  // One light capsule for every kind; a small icon says whether it went well.
  card: {
    maxWidth: 440,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xxl + 1,
    backgroundColor: colors.fg,
    ...elevation.floating,
  },
  text: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.semibold, flexShrink: 1, color: colors.white },
});
