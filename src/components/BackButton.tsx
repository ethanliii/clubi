import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";
import { Icon } from "./Icon";

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export function BackButton({ onPress = goBack }: { onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} style={styles.button}>
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
});
