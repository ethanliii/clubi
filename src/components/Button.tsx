import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { colors, fontWeight, palette, radius, spacing } from "../theme";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

/**
 * `primary` the one main action on a screen (solid accent, white label) · `secondary` a light grey
 * action beside it (`ghost` is the old name for the same thing) · `quiet` text only, for the least
 * important action · `destructive` red outline, red label: delete, leave, sign out · `light` white, for use on
 * photos and video · `link` inline text in the accent.
 */
type Variant = "primary" | "secondary" | "ghost" | "quiet" | "destructive" | "light" | "link";

export type ButtonProps = Omit<PressableProps, "style" | "children"> & {
  title: string;
  variant?: Variant;
  /** `lg` (default) 50 tall for the main action, `md` 44 for actions in a row, `sm` 36 for inline ones. */
  size?: "lg" | "md" | "sm";
  /** Shows a spinner in place of the label and ignores taps. The label stays for screen readers and tests. */
  loading?: boolean;
  /** An icon in front of the label. */
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, variant = "primary", size = "lg", loading = false, icon, disabled, style, ...props }: ButtonProps) {
  const kind = variant === "ghost" ? "secondary" : variant;
  const ink = INK[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        kind !== "link" && sizes[size],
        styles[kind],
        pressed && (kind === "link" || kind === "quiet" ? styles.pressedText : styles.pressed),
        disabled && !loading && styles.disabled,
        style,
      ]}
      {...props}
    >
      <View style={[styles.content, loading && styles.hidden]}>
        {icon ? <Icon name={icon} size={size === "sm" ? 15 : 18} color={ink} /> : null}
        <Text numberOfLines={1} style={[styles.label, size === "sm" && styles.labelSm, kind === "link" && styles.labelLink, { color: ink }]}>
          {title}
        </Text>
      </View>
      {loading ? (
        <View style={styles.spinner}>
          <ActivityIndicator size="small" color={ink} />
        </View>
      ) : null}
    </Pressable>
  );
}

const INK: Record<Exclude<Variant, "ghost">, string> = {
  primary: colors.white,
  secondary: colors.fg,
  quiet: colors.fg,
  destructive: palette.danger,
  light: colors.fg,
  link: colors.accent,
};

const sizes = StyleSheet.create({
  lg: { minHeight: 50, paddingHorizontal: spacing.xl - 2 },
  md: { minHeight: 44, paddingHorizontal: spacing.lg },
  sm: { minHeight: 36, paddingHorizontal: spacing.md + 2 },
});

const styles = StyleSheet.create({
  base: {
    width: "100%",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  hidden: { opacity: 0 },
  spinner: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: palette.field },
  quiet: { backgroundColor: "transparent" },
  destructive: { backgroundColor: colors.bg, borderWidth: 1.5, borderColor: palette.danger },
  light: { backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.hairline },
  link: { backgroundColor: "transparent", paddingVertical: spacing.xs, width: "auto", minHeight: 32 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  pressedText: { opacity: 0.55 },
  disabled: { opacity: 0.38 },
  label: { fontSize: 16, lineHeight: 21, fontWeight: fontWeight.bold, letterSpacing: -0.2, textAlign: "center" },
  labelSm: { fontSize: 14, lineHeight: 18 },
  labelLink: { fontSize: 14, lineHeight: 20 },
});
