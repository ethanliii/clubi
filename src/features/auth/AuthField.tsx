import { useState, type ComponentProps, type ReactNode } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Text } from "../../components";
import { colors } from "../../theme";

/** Readable on the footage, where the app's usual red sinks into the dark scrim. */
export const AUTH_ERROR = "#ff8f8f";

export type AuthFieldProps = Omit<ComponentProps<typeof TextInput>, "style"> & {
  /** What the box is for. Read out by screen readers, and the placeholder unless you pass one. */
  label: string;
  /** Shown before the typed text, like the "@" of a username. */
  prefix?: string;
  /** Sits at the right end of the line, like "Show" on a password. */
  trailing?: ReactNode;
  /** Under the line, in red. */
  error?: string | null;
  /** Under the line when there is no error. */
  hint?: ReactNode;
};

/**
 * A text box for the sign-up and sign-in form: large type on a single line that lights up when
 * focused. No box and no label above it, so the form reads as a few lines over the video.
 */
export function AuthField({ ref, label, prefix, trailing, error, hint, placeholder, onFocus, onBlur, ...props }: AuthFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <View style={[styles.line, focused && styles.lineFocused, error ? styles.lineError : null]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholder={placeholder ?? label}
          placeholderTextColor="rgba(242,238,247,0.42)"
          selectionColor={colors.accent}
          keyboardAppearance="dark"
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
  line: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    borderBottomWidth: 1.5,
    borderBottomColor: "rgba(242,238,247,0.22)",
  },
  lineFocused: { borderBottomColor: colors.fg },
  lineError: { borderBottomColor: AUTH_ERROR },
  prefix: { fontSize: 20, lineHeight: 26, fontWeight: "500", color: "rgba(242,238,247,0.42)", marginRight: 2 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 54,
    paddingVertical: 0,
    paddingHorizontal: 0,
    color: colors.fg,
    fontSize: 20,
    fontWeight: "500",
    // The line under the box is the focus mark; without this the browser draws its own ring too.
    outlineStyle: "solid",
    outlineWidth: 0,
  },
  error: { color: AUTH_ERROR, fontSize: 13, lineHeight: 18 },
});
