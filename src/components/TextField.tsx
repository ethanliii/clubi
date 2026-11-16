import { useState, type ComponentProps } from "react";
import { Platform, StyleSheet, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { colors, palette, radius, spacing } from "../theme";
import { Text } from "./Text";

export type TextFieldProps = Omit<ComponentProps<typeof TextInput>, "style"> & {
  /** The field's name, shown small inside the top of the box. Also the accessibility label unless you pass one. */
  label?: string;
  /** Shown under the box in red. */
  error?: string | null;
  /** Shown under the box in grey when there is no error. */
  hint?: string;
  style?: StyleProp<ViewStyle>;
};

// The browser's own focus ring would double up with ours.
const noOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as TextStyle) : null;

/**
 * A grey rounded text box with no border until it is focused. The label sits inside the box above the text, so a form reads as a short
 * list of fields rather than a stack of captions and boxes. Takes every `TextInput` prop
 * (placeholder, secureTextEntry, ref, …).
 */
export function TextField({
  label,
  error,
  hint,
  style,
  multiline,
  accessibilityLabel,
  placeholder,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  // A placeholder that only repeats the label says the same thing twice inside one box.
  const hintText = label && placeholder && placeholder.trim().toLowerCase() === label.trim().toLowerCase() ? undefined : placeholder;
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.box, focused && styles.boxFocused, error ? styles.boxError : null]}>
        <TextInput
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
          placeholder={hintText}
          placeholderTextColor={colors.low}
          selectionColor={colors.accent}
          multiline={multiline}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, label ? styles.inputLabelled : null, multiline && styles.multiline, noOutline]}
          {...props}
        />
        {label ? (
          <Text variant="caption" numberOfLines={1} style={[styles.label, error ? styles.labelError : null]}>
            {label}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" muted style={styles.below}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, width: "100%" },
  box: {
    borderRadius: radius.lg,
    backgroundColor: palette.field,
    borderWidth: 1.5,
    borderColor: "transparent",
    overflow: "hidden",
  },
  boxFocused: { borderColor: colors.fg, backgroundColor: colors.bg },
  boxError: { borderColor: palette.danger },
  // The label is drawn over the input and lets taps through, so the whole box focuses the input.
  label: {
    position: "absolute",
    top: 9,
    left: spacing.md + 2,
    right: spacing.md + 2,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 15,
    pointerEvents: "none",
  },
  labelError: { color: palette.danger },
  input: {
    minHeight: 50,
    color: colors.fg,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    // 16 keeps iOS Safari from zooming the page when the box is focused.
    fontSize: 16,
  },
  inputLabelled: { minHeight: 60, paddingTop: 27, paddingBottom: 9 },
  multiline: { minHeight: 104, textAlignVertical: "top" },
  error: { color: palette.danger, paddingHorizontal: spacing.xs },
  below: { paddingHorizontal: spacing.xs },
});
