import { Image, Pressable, StyleSheet, View } from "react-native";
import { APPLE_MARK, GOOGLE_MARK } from "../constants/socialMarks";
import { Text } from "./Text";

/** White pill "Continue with Google / Apple" button, logo on the left (official marks, see socialMarks.ts). */
export function SocialButton({ provider, onPress }: { provider: "google" | "apple"; onPress: () => void }) {
  const label = provider === "google" ? "Continue with Google" : "Continue with Apple";
  const mark = provider === "google" ? GOOGLE_MARK : APPLE_MARK;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}>
      <View style={styles.inner}>
        {mark ? <Image source={mark} style={styles.mark} resizeMode="contain" /> : null}
        <Text style={styles.label}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: "100%", backgroundColor: "#ffffff", borderRadius: 999, borderWidth: 1, borderColor: "#d5d5dc", paddingVertical: 14 },
  inner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  mark: { width: 22, height: 22 },
  label: { color: "#111111", fontSize: 16, lineHeight: 20, fontWeight: "700" },
});
