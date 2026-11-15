import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from "react-native";
import { colors, fontSize, fontWeight } from "../theme";

type Variant = "display" | "heading" | "title" | "body" | "caption" | "label";

export type TextProps = RNTextProps & {
  variant?: Variant;
  muted?: boolean;
  center?: boolean;
};

export function Text({ variant = "body", muted, center, style, ...props }: TextProps) {
  return (
    <RNText
      style={[styles.base, styles[variant], muted && styles.muted, center && styles.center, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: { color: colors.fg, fontSize: fontSize.body, lineHeight: 20 },
  display: { fontSize: fontSize.display, lineHeight: 46, fontWeight: fontWeight.bold, letterSpacing: -1 },
  heading: { fontSize: fontSize.heading, lineHeight: 32, fontWeight: fontWeight.bold, letterSpacing: -0.3 },
  title: { fontSize: fontSize.title, lineHeight: 22, fontWeight: fontWeight.bold },
  body: {},
  caption: { fontSize: fontSize.caption, lineHeight: 16 },
  label: {
    fontSize: fontSize.label,
    lineHeight: 14,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.muted,
  },
  muted: { color: colors.muted },
  center: { textAlign: "center" },
});
