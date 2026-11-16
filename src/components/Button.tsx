import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { colors, fontWeight, palette, radius, spacing } from "../theme";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

/**
 * Bryan's button look (rounded-rect, accent primary, outlined ghost, white pill `light`) with the
 * extra API main's screens use: `secondary` / `quiet` / `destructive`, `size`, `loading`, `icon`.
 */
type Variant = "primary" | "secondary" | "ghost" | "quiet" | "destructive" | "light" | "link";

export type ButtonProps = Omit<PressableProps, "style" | "children"> & {
  title: string;
  variant?: Variant;
  /** `lg` (default) the main action, `md` actions in a row, `sm` inline ones. */
  size?: "lg" | "md" | "sm";
  /** Spinner in place of the label; ignores taps. The label stays for screen readers and tests. */
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, variant = "primary", size = "lg", loading = false, icon, disabled, style, ...props }: ButtonProps) {
  const kind = variant === "secondary" ? "ghost" : variant;
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
        (pressed || (disabled && !loading)) && styles.dimmed,
        style,
      ]}
      {...props}
    >
      <View style={[styles.content, loading && styles.hidden]}>
        {icon ? <Icon name={icon} size={size === "sm" ? 15 : 18} color={ink} /> : null}
        <Text numberOfLines={1} style={[styles.label, size === "sm" && styles.labelSm, { color: ink }]}>{title}</Text>
      </View>
      {loading ? (
        <View style={styles.spinner}>
          <ActivityIndicator size="small" color={ink} />
        </View>
      ) : null}
    </Pressable>
  );
}

const INK: Record<Exclude<Variant, "secondary">, string> = {
  primary: colors.white,
  ghost: colors.fg,
  quiet: colors.fg,
  destructive: palette.danger,
  light: "#14111a",
  link: colors.fg,
};

const sizes = StyleSheet.create({
  lg: { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.lg },
  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
});

const styles = StyleSheet.create({
  base: { width: "100%", borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  hidden: { opacity: 0 },
  spinner: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: colors.accent },
  ghost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  quiet: { backgroundColor: "transparent" },
  destructive: { backgroundColor: palette.dangerSoft, borderWidth: 1, borderColor: colors.line },
  light: { backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: 15 },
  link: { backgroundColor: "transparent", paddingVertical: spacing.xs, width: "auto" },
  dimmed: { opacity: 0.6 },
  label: { fontWeight: fontWeight.semibold, textAlign: "center" },
  labelSm: { fontSize: 13 },
});
