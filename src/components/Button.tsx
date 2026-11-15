import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { colors, fontWeight, radius, spacing } from "../theme";
import { Text } from "./Text";

type Variant = "primary" | "ghost" | "light" | "link";

export type ButtonProps = Omit<PressableProps, "style" | "children"> & {
  title: string;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, variant = "primary", disabled, style, ...props }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        (pressed || disabled) && styles.dimmed,
        style,
      ]}
      {...props}
    >
      <Text style={[styles.label, labelStyles[variant]]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.accent },
  ghost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  light: { backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: 15 },
  link: { backgroundColor: "transparent", paddingVertical: spacing.xs, width: "auto" },
  dimmed: { opacity: 0.6 },
  label: { fontWeight: fontWeight.semibold, textAlign: "center" },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.white },
  ghost: { color: colors.fg },
  light: { color: "#14111a" },
  link: { color: colors.fg },
});
