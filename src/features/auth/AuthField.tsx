import { useState, type ComponentProps, type ReactNode } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Text } from "../../components";
import { colors, palette, radius } from "../../theme";

/** The red of a field that needs fixing, and of the line that says why. */
export const AUTH_ERROR = palette.danger;

/** The field's grey, one shade darker, while it has the cursor. */
const FOCUS_FILL = "#e8e8ec";

export type AuthFieldProps = Omit<ComponentProps<typeof TextInput>, "style"> & {
  /** What the box is for: shown above it and read out by screen readers. */
  label: string;
  /** Shown before the typed text, like the "@" of a username. */
  prefix?: string;
  /** Sits at the right end of the box, like "Show" on a password. */
  trailing?: ReactNode;
  /** Under the box, in red. */
  error?: string | null;
  /** Under the box when there is no error. */
  hint?: ReactNode;
};

/**
 * A text box for the sign-up and sign-in form: a small label, then a grey rounded box that turns a
 * shade darker while it is being typed in and gets a red outline when it needs fixing.
 */
export function AuthField({ ref, label, prefix, trailing, error, hint, placeholder, onFocus, onBlur, ...props }: AuthFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.boxFocused, error ? styles.boxError : null]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholder={placeholder}
          placeholderTextColor={colors.low}
          selectionColor={colors.accent}
          keyboardAppearance="light"
          style={styles.input}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...props}
        />
        {trailing}
      </View>
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : (
        hint
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase", color: colors.fg },
  box: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.field,
    backgroundColor: palette.field,
  },
  boxFocused: { borderColor: FOCUS_FILL, backgroundColor: FOCUS_FILL },
  boxError: { borderColor: AUTH_ERROR },
  prefix: { fontSize: 16, lineHeight: 22, fontWeight: "500", color: colors.muted, marginRight: 1 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 47,
    paddingVertical: 0,
    paddingHorizontal: 0,
    color: colors.fg,
    fontSize: 16,
    fontWeight: "500",
    // The outline of the box is the focus mark; without this the browser draws its own ring too.
    outlineStyle: "solid",
    outlineWidth: 0,
  },
  error: { color: AUTH_ERROR, fontSize: 13, lineHeight: 18 },
});
