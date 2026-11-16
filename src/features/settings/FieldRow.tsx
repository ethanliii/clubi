import { useState, type ComponentProps } from "react";
import { Platform, StyleSheet, TextInput, View, type TextStyle } from "react-native";
import { Text } from "../../components";
import { colors, palette, spacing, type } from "../../theme";
import { ROW_INSET } from "./Group";

// The browser's own focus ring has no place inside a settings row.
const noOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as TextStyle) : null;

/**
 * A field inside a settings group: the name on the left, what you type beside it, the way a phone's
 * own settings edits a contact. The box is the row itself; nothing is drawn around the input.
 */
export function FieldRow({
  label,
  accessibilityLabel,
  error,
  hint,
  multiline,
  ...props
}: Omit<ComponentProps<typeof TextInput>, "style"> & {
  /** The short name shown in the row. */
  label: string;
  /** Shown in red under the input. */
  error?: string | null;
  /** Shown in grey under the input when there is no error, e.g. a character count. */
  hint?: string;
}) {
  // A bio grows with what is typed instead of scrolling inside two lines.
  const [grown, setGrown] = useState(0);
  return (
    <View style={styles.row}>
      <Text variant="bodyLg" numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      <View style={styles.field}>
        <TextInput
          accessibilityLabel={accessibilityLabel ?? label}
          placeholderTextColor={colors.low}
          selectionColor={colors.accent}
          multiline={multiline}
          numberOfLines={multiline ? 1 : undefined}
          onContentSizeChange={multiline ? (event) => setGrown(Math.ceil(event.nativeEvent.contentSize.height)) : undefined}
          style={[styles.input, multiline && styles.multiline, multiline && grown > 0 && { height: Math.max(40, grown) }, noOutline]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingHorizontal: ROW_INSET, paddingVertical: 5 },
  label: { width: 96, paddingTop: 9 },
  field: { flex: 1, gap: 2, paddingBottom: 2 },
  // 16 keeps iOS Safari from zooming the page when the box is focused.
  input: { ...type.bodyLg, minHeight: 40, paddingVertical: 9, paddingHorizontal: 0, color: colors.fg },
  multiline: { textAlignVertical: "top" },
  error: { color: palette.danger, paddingBottom: 6 },
});
