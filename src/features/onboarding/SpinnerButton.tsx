import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Button, type ButtonProps } from "../../components";
import { colors, spacing } from "../../theme";

/**
 * A `Button` that shows a spinner while `busy`. The label never changes (the phone tests find
 * buttons by their text), and a busy button cannot be pressed twice.
 */
export function SpinnerButton({
  busy,
  disabled,
  style,
  ...props
}: Omit<ButtonProps, "style"> & { busy: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.wrap, style]}>
      <Button
        {...props}
        disabled={disabled || busy}
        accessibilityState={{ busy, disabled: !!disabled || busy }}
        aria-busy={busy}
      />
      {busy ? (
        <View style={styles.spinner}>
          <ActivityIndicator size="small" color={colors.white} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: "center" },
  spinner: {
    position: "absolute",
    right: spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    pointerEvents: "none",
  },
});
