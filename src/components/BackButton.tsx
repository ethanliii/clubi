import { router } from "expo-router";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors, palette } from "../theme";
import { Icon } from "./Icon";

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/** The round back button. `onPhoto` gives it white glass so it reads on top of a picture or the map. */
export function BackButton({
  onPress = goBack,
  onPhoto = false,
  style,
}: {
  onPress?: () => void;
  onPhoto?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.button, onPhoto && styles.onPhoto, pressed && styles.pressed, style]}
    >
      <Icon name="back" size={onPhoto ? 20 : 22} color={colors.fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.field,
    alignItems: "center",
    justifyContent: "center",
    // The chevron's point sits left of its box's centre; nudge it so it looks centred.
    paddingRight: 2,
  },
  onPhoto: { backgroundColor: palette.glass },
  pressed: { opacity: 0.6, transform: [{ scale: 0.94 }] },
});
