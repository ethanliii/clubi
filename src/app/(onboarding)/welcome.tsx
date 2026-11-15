import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components";
import { APP_NAME } from "../../constants/brand";
import { AuthButton } from "../../features/auth/AuthButton";
import { WELCOME_TAGLINE } from "../../features/onboarding/copy";
import { VideoBackground } from "../../features/onboarding/VideoBackground";
import { signInPath } from "../../lib/links";
import { colors } from "../../theme";

/**
 * The first screen: the footage, the name, one line about what the app is for, and two ways in.
 * Everything sits at the bottom, under the thumb, and leaves the top of the video clear.
 */
export default function Welcome() {
  return (
    <View style={styles.root}>
      <VideoBackground />
      <LinearGradient
        colors={["rgba(11,10,15,0.5)", "rgba(11,10,15,0)", "rgba(11,10,15,0.55)", "rgba(11,10,15,0.96)"]}
        locations={[0, 0.22, 0.56, 0.92]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.content}>
        <Text accessibilityRole="header" style={styles.wordmark}>
          {APP_NAME.toLowerCase()}
        </Text>
        <View style={styles.bottom}>
          <Text style={styles.headline}>Know where{"\n"}to go tonight.</Text>
          <Text style={styles.sub}>{WELCOME_TAGLINE}</Text>
          <View style={styles.actions}>
            <AuthButton title="Get started" onPress={() => router.push(signInPath("signup"))} />
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

const shadow = { textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 16, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  content: { flex: 1, justifyContent: "space-between", paddingHorizontal: 24 },
  wordmark: { marginTop: 14, fontSize: 26, lineHeight: 32, fontWeight: "800", letterSpacing: -1, color: colors.white, ...shadow },
  bottom: { paddingBottom: 12 },
  headline: { fontSize: 44, lineHeight: 46, fontWeight: "800", letterSpacing: -1.6, color: colors.white, ...shadow },
  sub: { marginTop: 14, maxWidth: 300, fontSize: 17, lineHeight: 24, color: "rgba(255,255,255,0.82)", ...shadow },
  actions: { marginTop: 30, gap: 4 },
  secondary: { alignSelf: "center", minHeight: 50, justifyContent: "center", paddingHorizontal: 20 },
  secondaryText: { fontSize: 16, fontWeight: "600", color: colors.white },
  legal: { marginTop: 6, fontSize: 12, lineHeight: 16, textAlign: "center", color: "rgba(255,255,255,0.5)" },
  pressed: { opacity: 0.55 },
});
