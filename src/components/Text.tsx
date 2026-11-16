import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from "react-native";
import { colors, fontSize, fontWeight, palette, type } from "../theme";

/**
 * Bryan's type styles for the original variants; `headline`, `bodyLg` and `soft` were added by
 * main's design-system pass and are kept so those screens work (merge: Bryan's look wins).
 */
type Variant = "display" | "heading" | "headline" | "title" | "bodyLg" | "body" | "caption" | "label";

export type TextProps = RNTextProps & {
  variant?: Variant;
  muted?: boolean;
  /** Between normal and muted: second-level text that still has to be read. */
  soft?: boolean;
  center?: boolean;
};

export function Text({ variant = "body", muted, soft, center, style, ...props }: TextProps) {
  return (
    <RNText
      style={[styles.base, styles[variant], soft && styles.soft, muted && styles.muted, center && styles.center, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: { color: colors.fg, fontSize: fontSize.body, lineHeight: 20 },
  display: { fontSize: fontSize.display, lineHeight: 46, fontWeight: fontWeight.bold, letterSpacing: -1 },
  heading: { fontSize: fontSize.heading, lineHeight: 32, fontWeight: fontWeight.bold, letterSpacing: -0.3 },
  headline: { fontSize: 20, lineHeight: 25, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  title: { fontSize: fontSize.title, lineHeight: 22, fontWeight: fontWeight.bold },
  bodyLg: { fontSize: type.bodyLg.fontSize, lineHeight: type.bodyLg.lineHeight },
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
  soft: { color: palette.soft },
  muted: { color: colors.muted },
  center: { textAlign: "center" },
});
