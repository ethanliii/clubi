import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components";
import { APP_NAME } from "../../constants/brand";
import { AuthButton } from "../../features/auth/AuthButton";
import { WELCOME_TAGLINE } from "../../features/onboarding/copy";
import { VideoBackground } from "../../features/onboarding/VideoBackground";
import { signInPath } from "../../lib/links";
import { colors, palette } from "../../theme";

/**
 * The first screen: the footage, the name, one line about what the app is for, and two ways in.
 * Everything sits at the bottom, under the thumb, and leaves the top of the video clear.
 */
export default function Welcome() {
  return (
    <View style={styles.root}>
      <VideoBackground />
      <StatusBar style="light" />
      <LinearGradient colors={SCRIM} locations={SCRIM_STOPS} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <SafeAreaView style={styles.content}>
        <Text accessibilityRole="header" style={styles.wordmark}>
          {APP_NAME.toLowerCase()}
        </Text>
        <View style={styles.bottom}>
          <Text style={styles.headline}>Know where{"\n"}to go tonight.</Text>
          <Text style={styles.sub}>{WELCOME_TAGLINE}</Text>
          <View style={styles.actions}>
            <AuthButton tone="onPhoto" title="Get started" onPress={() => router.push(signInPath("signup"))} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="I have an account"
              onPress={() => router.push(signInPath("signin"))}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>I have an account</Text>
            </Pressable>
          </View>
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
const SCRIM = ["rgba(0,0,0,0.5)", "rgba(0,0,0,0)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.93)", "rgba(0,0,0,0.97)"] as const;
const SCRIM_STOPS = [0, 0.22, 0.56, 0.8, 1] as const;

const shadow = { textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 16, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  content: { flex: 1, justifyContent: "space-between", paddingHorizontal: 20 },
  wordmark: { marginTop: 14, fontSize: 26, lineHeight: 32, fontWeight: "800", letterSpacing: -1, color: palette.onPhoto, ...shadow },
  bottom: { paddingBottom: 12 },
  headline: { fontSize: 42, lineHeight: 45, fontWeight: "800", letterSpacing: -1.4, color: palette.onPhoto, ...shadow },
  sub: { marginTop: 12, maxWidth: 300, fontSize: 17, lineHeight: 24, color: palette.onPhotoMuted, ...shadow },
  actions: { marginTop: 28, gap: 10 },
  secondary: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 16, lineHeight: 22, fontWeight: "700", color: palette.onPhoto },
  legal: { marginTop: 14, fontSize: 12, lineHeight: 16, textAlign: "center", color: "rgba(255,255,255,0.6)" },
  pressed: { opacity: 0.55 },
});
