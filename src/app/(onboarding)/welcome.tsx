import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, Pressable, StyleSheet, View } from "react-native";
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
            style={({ pressed }) => [styles.button, pressed && styles.secondaryPressed]}
          >
            <Text style={styles.quietText}>
              Already have an account? <Text style={styles.quietStrong}>Log in</Text>
            </Text>
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
const SCRIM = ["rgba(0,0,0,0.3)", "rgba(0,0,0,0)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.94)", "rgba(0,0,0,1)"] as const;
const SCRIM_STOPS = [0, 0.22, 0.5, 0.68, 0.8] as const;

/** The wordmark is a bold serif, like the one in the home header; each platform ships one. */
const SERIF = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, 'Times New Roman', serif" });

const shadow = { textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 14, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  content: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 24 },
  brand: { paddingBottom: 32 },
  wordmark: { fontFamily: SERIF, fontSize: 64, lineHeight: 72, fontWeight: "700", letterSpacing: -2, color: palette.onPhoto, ...shadow },
  sub: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "500",
    letterSpacing: -0.2,
    color: palette.onPhoto,
    ...shadow,
  },
  actions: { gap: 6, paddingBottom: 8 },
  button: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: colors.accent },
  primaryPressed: { opacity: 0.85 },
  secondaryPressed: { opacity: 0.6 },
  buttonText: { fontSize: 17, lineHeight: 22, fontWeight: "700", letterSpacing: -0.2, color: palette.onPhoto },
  quietText: { fontSize: 15, lineHeight: 20, fontWeight: "500", color: palette.onPhotoMuted },
  quietStrong: { fontWeight: "700", color: palette.onPhoto },
  legal: { marginTop: 4, fontSize: 12, lineHeight: 16, textAlign: "center", color: "rgba(255,255,255,0.62)" },
});
