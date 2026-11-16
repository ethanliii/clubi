import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from "react-native";
import { colors, palette, type } from "../theme";

type Variant = "display" | "heading" | "headline" | "title" | "bodyLg" | "body" | "caption" | "label" | "overline";

export type TextProps = RNTextProps & {
  /**
   * `display` a splash wordmark · `heading` the one big title of a screen · `headline` a section
   * title · `title` a card or row title · `bodyLg`/`body` running text · `caption` supporting
   * text · `label` the quiet name of a field or group (sentence case, never shouted).
   */
  variant?: Variant;
  muted?: boolean;
  /** Between normal and muted: second-level text that still has to be read (a reason line). */
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
  base: { color: colors.fg, ...type.body },
  display: type.display,
  heading: type.heading,
  headline: type.headline,
  title: type.title,
  bodyLg: type.bodyLg,
  body: {},
  caption: type.caption,
  // Was tiny, uppercase and letter-spaced. Now a calm sentence-case label.
  label: { ...type.label, color: colors.muted },
  // The small bold uppercase section label ("YOUR FEED").
  overline: { fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" },
  soft: { color: palette.soft },
  muted: { color: colors.muted },
  center: { textAlign: "center" },
});
