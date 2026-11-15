import type { ComponentProps } from "react";
import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fontSize, radius, spacing } from "../theme";
import { Text } from "./Text";

export type TextFieldProps = Omit<ComponentProps<typeof TextInput>, "style"> & {
  /** Shown above the box. Also the accessibility label unless you pass one. */
  label?: string;
  /** Shown under the box in red. */
  error?: string | null;
  /** Shown under the box in grey when there is no error. */
  hint?: string;
  style?: StyleProp<ViewStyle>;
};

/** A labelled text box in the app's style. Takes every `TextInput` prop (placeholder, secureTextEntry, ref, …). */
export function TextField({
  label,
  error,
  hint,
  style,
  multiline,
  accessibilityLabel,
  placeholder,
  ...props
}: TextFieldProps) {
  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text variant="label">{label}</Text> : null}
      <TextInput
        accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, error ? styles.inputError : null]}
        {...props}
      />
      {error ? (
        <Text variant="caption" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2, width: "100%" },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.fg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    fontSize: fontSize.bodyLg,
  },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  inputError: { borderColor: "#ff6b6b" },
  error: { color: "#ff6b6b" },
});
