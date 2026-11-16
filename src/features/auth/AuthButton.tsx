import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../components";
import { colors } from "../../theme";

/** Dark label for the white button that sits on the welcome footage. */
const INK = "#14111a";

type Tone = "accent" | "onPhoto";

/**
 * The one main button of Welcome, Sign up and Sign in. `accent` (default) is the solid dark-red pill
 * for the white form screens; `onPhoto` is a white pill, which reads on any frame of the welcome
 * footage. While `busy` it shows a spinner and cannot be pressed again; the label never changes
 * (the phone tests find buttons by their text).
 */
export function AuthButton({
  title,
  busy = false,
  disabled = false,
  tone = "accent",
  onPress,
}: {
  title: string;
  busy?: boolean;
  /** Dimmed and not pressable, while the form is not ready to send. */
  disabled?: boolean;
  tone?: Tone;
  onPress: () => void;
}) {
  const onPhoto = tone === "onPhoto";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy, disabled: busy || disabled }}
      aria-busy={busy}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, onPhoto && styles.onPhoto, pressed && styles.pressed, busy && styles.busy, disabled && !busy && styles.disabled]}
    >
      <Text style={[styles.label, onPhoto && styles.labelOnPhoto]}>{title}</Text>
      {busy ? (
        <View style={styles.spinner}>
          <ActivityIndicator size="small" color={onPhoto ? INK : colors.white} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  onPhoto: { backgroundColor: colors.white },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  busy: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  label: { fontSize: 16, lineHeight: 22, fontWeight: "700", color: colors.white },
  labelOnPhoto: { color: INK },
  spinner: { position: "absolute", right: 20, top: 0, bottom: 0, justifyContent: "center", pointerEvents: "none" },
});
