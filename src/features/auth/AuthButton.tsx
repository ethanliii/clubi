import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../components";
import { colors } from "../../theme";

const INK = "#14111a";

/**
 * The one main button of Welcome, Sign up and Sign in: a white pill, which reads on any frame of
 * the footage. While `busy` it shows a spinner and cannot be pressed again; the label never
 * changes (the phone tests find buttons by their text).
 */
export function AuthButton({ title, busy = false, onPress }: { title: string; busy?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy, disabled: busy }}
      aria-busy={busy}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.busy]}
    >
      <Text style={styles.label}>{title}</Text>
      {busy ? (
        <View style={styles.spinner}>
          <ActivityIndicator size="small" color={INK} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  busy: { opacity: 0.7 },
  label: { fontSize: 16, lineHeight: 22, fontWeight: "700", color: INK },
  spinner: { position: "absolute", right: 20, top: 0, bottom: 0, justifyContent: "center", pointerEvents: "none" },
});
