import { Pressable, StyleSheet } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "../theme";
import { isDark, toggleThemeMode } from "../theme/mode";

/**
 * The little sun or moon at the top right: tap it to switch between light and dark. It shows what a
 * tap gives you (a moon in light mode, a sun in dark). The app reloads into the other mode.
 */
export function ThemeToggle({ size = 40 }: { size?: number }) {
  const stroke = { stroke: colors.fg, strokeWidth: 1.7, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
      hitSlop={8}
      onPress={toggleThemeMode}
      style={({ pressed }) => [styles.wrap, { width: size, height: size }, pressed && styles.pressed]}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24">
        {isDark ? (
          <>
            <Circle cx={12} cy={12} r={4} {...stroke} />
            <Path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" {...stroke} />
          </>
        ) : (
          <Path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" {...stroke} />
        )}
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.55 },
});
