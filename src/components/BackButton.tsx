import { router } from "expo-router";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors, palette } from "../theme";
import { Icon } from "./Icon";

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/** Bryan's round back button. `onPhoto` / `style` are for main's screens (glass on a photo or the map). */
export function BackButton({ onPress = goBack, onPhoto = false, style }: { onPress?: () => void; onPhoto?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} hitSlop={6} style={[styles.button, onPhoto && styles.onPhoto, style]}>
      <Icon name="back" size={18} color={colors.fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  onPhoto: { backgroundColor: palette.glass },
});
