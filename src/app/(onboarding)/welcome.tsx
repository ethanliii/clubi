import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components";
import { APP_NAME } from "../../constants/brand";
import { WELCOME_TAGLINE } from "../../features/onboarding/copy";
import { VideoBackground } from "../../features/onboarding/VideoBackground";
import { signInPath } from "../../lib/links";
import { colors, palette } from "../../theme";

/**
 * The first screen: the footage, the name, one line about what the app is for, and two ways in,
 * stacked at the bottom under the thumb so the top of the video stays clear.
 */
export default function Welcome() {
  return (
    <View style={styles.root}>
      <VideoBackground />
      <StatusBar style="light" />
      <LinearGradient colors={SCRIM} locations={SCRIM_STOPS} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <SafeAreaView style={styles.content}>
        <View style={styles.brand}>
          <Text accessibilityRole="header" style={styles.wordmark}>
            {APP_NAME.toLowerCase()}
          </Text>
          <Text style={styles.sub}>{WELCOME_TAGLINE}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create account"
            onPress={() => router.push(signInPath("signup"))}
            style={({ pressed }) => [styles.button, styles.primary, pressed && styles.primaryPressed]}
          >
            <Text style={styles.buttonText}>Create account</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log in"
            onPress={() => router.push(signInPath("signin"))}
            style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.secondaryPressed]}
          >
            <Text style={styles.buttonText}>Log in</Text>
          </Pressable>
          <Text style={styles.legal}>By continuing you agree to our Terms and Privacy Policy.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * The footage is a photo surface, so this screen stays dark under white text whatever the theme:
 * a little shade behind the name at the top, clear in the middle, near-black under the buttons
 * (the clips carry burned-in captions along the foot, which must not show through them).
 */
const SCRIM = ["rgba(0,0,0,0.35)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.95)", "rgba(0,0,0,0.98)"] as const;
const SCRIM_STOPS = [0, 0.25, 0.52, 0.74, 1] as const;

const shadow = { textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 14, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  content: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 24 },
  brand: { alignItems: "center", paddingBottom: 36 },
  wordmark: { fontSize: 68, lineHeight: 74, fontWeight: "800", letterSpacing: -3, color: palette.onPhoto, ...shadow },
  sub: {
    marginTop: 6,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "500",
    letterSpacing: -0.2,
    textAlign: "center",
    color: palette.onPhoto,
    ...shadow,
  },
  actions: { gap: 12, paddingBottom: 12 },
  button: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: colors.accent },
  primaryPressed: { opacity: 0.85 },
  secondary: { borderWidth: 1.5, borderColor: palette.onPhoto },
  secondaryPressed: { backgroundColor: "rgba(255,255,255,0.16)" },
  buttonText: { fontSize: 17, lineHeight: 22, fontWeight: "700", letterSpacing: -0.2, color: palette.onPhoto },
  legal: { marginTop: 4, fontSize: 12, lineHeight: 16, textAlign: "center", color: "rgba(255,255,255,0.62)" },
});
