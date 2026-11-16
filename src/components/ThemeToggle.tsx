import { Pressable, StyleSheet } from "react-native";
import { colors, isLight, setThemeMode } from "../theme";
import { Icon } from "./Icon";

/** Round sun / moon button: switches light ↔ dark (the app reloads to apply it). */
export function ThemeToggle({ size = 36 }: { size?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isLight ? "Switch to dark mode" : "Switch to light mode"}
      onPress={() => setThemeMode(isLight ? "dark" : "light")}
      hitSlop={8}
      style={[styles.btn, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Icon name={isLight ? "moon" : "sun"} size={18} color={colors.fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
});
